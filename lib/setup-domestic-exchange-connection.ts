import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import {
  mapUpbitWsTickToVM,
  mapUpbitRestTickerToVM,
  mapClosePriceWsTickToVM,
  mapBithumbRestTickerToVM,
  mapCoinoneRestTickerToVM,
  type ClosePriceWsTick,
  type DomesticTickerVM,
} from "@/lib/domestic-ticker-vm";
import {
  DOMESTIC_EXCHANGE_TIMING,
  type ConnectionStatus,
  type DomesticExchangeKind,
} from "@/lib/domestic-exchange-timing";

/** @public 타이밍 상수 재노출 (한 곳에서 import 가능) */
export { DOMESTIC_EXCHANGE_TIMING } from "@/lib/domestic-exchange-timing";

const T = DOMESTIC_EXCHANGE_TIMING;

const LABEL: Record<DomesticExchangeKind, string> = {
  upbit: "업비트 KRW",
  bithumb: "빗썸 KRW",
  coinone: "코인원 KRW",
};

export interface DomesticExchangeConnectionDeps {
  selectedExchange: string;
  currentExchangeRef: MutableRefObject<string | null>;
  isDomesticReadyRef: MutableRefObject<boolean>;
  setIsDomesticReady: Dispatch<SetStateAction<boolean>>;
  /** 상장 목록 심볼 키만 사용 */
  coinsRef: MutableRefObject<Map<string, { symbol: string }>>;
  upbitMarketsRef: MutableRefObject<string[]>;
  applyDomesticTicker: (
    symbol: string,
    vm: DomesticTickerVM,
    incoming: { connId: number; ts: number; seq: number },
  ) => void;
  markCoinsFlushDirty: () => void;
  canStopRestFallbackWhileWsLive: () => boolean;
  logThrottled: (key: string, message: string, data?: unknown) => void;
  exchangeLoadingStartTimeRef: MutableRefObject<number | null>;
  setShowExchangeLoading: Dispatch<SetStateAction<boolean>>;
  hideLoadingAfterMinTime: (
    startTimeRef: MutableRefObject<number | null>,
    setShowLoading: Dispatch<SetStateAction<boolean>>,
  ) => void;
  /** 거래소별 연결 상태 */
  statusRef: MutableRefObject<ConnectionStatus>;
  setStatus: Dispatch<SetStateAction<ConnectionStatus>>;
}

/**
 * 국내 거래소 하나에 대해: Worker(WS) + adaptive REST 폴백을 동일 프로세스로 연결한다.
 * (선택된 거래소가 바뀌면 effect cleanup으로 중단)
 */
export function setupDomesticExchangeConnection(
  kind: DomesticExchangeKind,
  workerUrl: URL,
  deps: DomesticExchangeConnectionDeps,
): () => void {
  const label = LABEL[kind];
  const logKey = (suffix: string) => `${kind}_${suffix}`;

  deps.setStatus("connecting");
  deps.statusRef.current = "connecting";
  console.log(`[${kind}] WS connecting…`);
  deps.hideLoadingAfterMinTime(
    deps.exchangeLoadingStartTimeRef,
    deps.setShowExchangeLoading,
  );

  let worker: Worker | null = null;
  let restFallbackTimer: ReturnType<typeof setTimeout> | null = null;
  let backoffMs: number = T.restBackoffInitialMs;

  const clearRestTimer = () => {
    if (restFallbackTimer !== null) {
      clearTimeout(restFallbackTimer);
      restFallbackTimer = null;
    }
  };

  const startAdaptiveFallback = () => {
    if (restFallbackTimer !== null) return;
    console.warn(`[${kind}] REST fallback started (adaptive)`);
    scheduleRestFallback(T.fallbackFirstScheduleMs);
  };

  const scheduleRestFallback = (delay: number) => {
    clearRestTimer();
    deps.logThrottled(
      logKey("fallback_schedule"),
      `[${kind}] REST fallback scheduled in ${delay}ms`,
    );
    restFallbackTimer = setTimeout(async () => {
      restFallbackTimer = null;
      if (deps.selectedExchange !== label) return;
      if (
        deps.isDomesticReadyRef.current &&
        deps.statusRef.current === "live" &&
        deps.canStopRestFallbackWhileWsLive()
      ) {
        deps.logThrottled(
          logKey("fallback_stop_ws_live"),
          `[${kind}] REST fallback stopped: WS live + all listed symbols have domestic price`,
        );
        return;
      }

      if (kind === "upbit") {
        await fetchUpbitRestOnce();
      } else if (kind === "bithumb") {
        await fetchBithumbRestOnce();
      } else {
        await fetchCoinoneRestOnce();
      }

      if (!deps.isDomesticReadyRef.current) {
        backoffMs = Math.min(T.restBackoffMaxMs, backoffMs * 2);
      } else {
        backoffMs = Math.min(T.restBackoffMaxMs, backoffMs * 1.25);
      }
      deps.logThrottled(
        logKey("fallback_next_delay"),
        `[${kind}] REST fallback next backoff=${backoffMs}ms (ready=${deps.isDomesticReadyRef.current})`,
      );
      scheduleRestFallback(backoffMs);
    }, delay);
  };

  // --- Upbit ---
  const ensureUpbitMarkets = async () => {
    if (deps.upbitMarketsRef.current.length) return;
    try {
      const res = await fetch("/api/upbit/markets");
      if (!res.ok) return;
      const arr = (await res.json()) as { market: string }[];
      deps.upbitMarketsRef.current = arr
        .map((m) => m.market)
        .filter((m) => typeof m === "string");
    } catch {
      // ignore
    }
  };

  const fetchUpbitRestOnce = async () => {
    try {
      if (deps.currentExchangeRef.current !== label) return;
      let upbitKrwMarkets = deps.upbitMarketsRef.current.filter((m) =>
        m.startsWith("KRW-"),
      );
      if (!upbitKrwMarkets.length) {
        await ensureUpbitMarkets();
      }
      const freshMarkets = deps.upbitMarketsRef.current.filter((m) =>
        m.startsWith("KRW-"),
      );
      if (!freshMarkets.length) {
        deps.logThrottled(
          logKey("fallback_skip_empty_markets"),
          `[${kind}] REST fallback skipped: empty markets list`,
        );
        return;
      }

      deps.logThrottled(
        logKey("fallback_fetch"),
        `[${kind}] REST fallback fetch (markets=${freshMarkets.length})`,
      );
      const nowTs = Date.now();
      let seq = 0;
      const UPBIT_TICKER_CHUNK = 45;
      for (let i = 0; i < freshMarkets.length; i += UPBIT_TICKER_CHUNK) {
        const chunk = freshMarkets.slice(i, i + UPBIT_TICKER_CHUNK);
        const marketsParam = chunk.join(",");
        const res = await fetch(`/api/upbit?markets=${marketsParam}`);
        if (!res.ok) {
          deps.logThrottled(
            logKey("fallback_http_error"),
            `[${kind}] REST fallback HTTP ${res.status}`,
          );
          return;
        }
        const arr = (await res.json()) as Array<{
          market?: string;
          code?: string;
          trade_price: number;
          signed_change_rate: number;
          signed_change_price: number;
          acc_trade_price_24h: number;
        }>;
        if (deps.currentExchangeRef.current !== label) return;
        for (const item of arr) {
          const marketCode = item.market ?? item.code;
          if (!marketCode) continue;
          const symbol = marketCode.split("-")[1];
          if (!symbol) continue;
          if (
            typeof item.trade_price !== "number" ||
            !Number.isFinite(item.trade_price)
          )
            continue;
          const ts =
            (typeof (item as { trade_timestamp?: number }).trade_timestamp ===
              "number" &&
              (item as { trade_timestamp?: number }).trade_timestamp) ||
            (typeof (item as { timestamp?: number }).timestamp === "number" &&
              (item as { timestamp?: number }).timestamp) ||
            nowTs;
          seq += 1;
          const { vm } = mapUpbitRestTickerToVM(item, symbol);
          deps.applyDomesticTicker(symbol, vm, { connId: 0, ts, seq });
        }
      }
      if (deps.currentExchangeRef.current !== label) return;
      deps.setIsDomesticReady(true);
      deps.isDomesticReadyRef.current = true;
      deps.markCoinsFlushDirty();
      deps.setStatus((prev) => {
        const next = prev === "live" ? "live" : "degraded";
        deps.statusRef.current = next;
        return next;
      });
      backoffMs = T.restBackoffInitialMs;
    } catch {
      deps.logThrottled(
        logKey("fallback_exception"),
        `[${kind}] REST fallback exception`,
      );
    }
  };

  // --- Bithumb ---
  const ensureBithumbSymbols = async (): Promise<string[]> => {
    const fromRef = Array.from(deps.coinsRef.current.keys()).filter(Boolean);
    if (fromRef.length) return fromRef;
    try {
      const res = await fetch("/api/bithumb/all-krw");
      if (!res.ok) return [];
      const json = (await res.json()) as { data?: Record<string, unknown> };
      const data = json.data ?? {};
      return Object.keys(data).filter((k) => k !== "date");
    } catch {
      return [];
    }
  };

  const fetchBithumbRestOnce = async () => {
    try {
      if (deps.currentExchangeRef.current !== label) return;
      deps.logThrottled(
        logKey("fallback_fetch"),
        `[${kind}] REST fallback fetch (/api/bithumb/all-krw)`,
      );
      const response = await fetch("/api/bithumb/all-krw");
      if (response.ok) {
        const data = await response.json();
        if (data.status === "0000" && data.data) {
          const rootTsRaw = (data?.data?.date ?? data?.date) as
            | string
            | number
            | undefined;
          const rootTsNum =
            typeof rootTsRaw === "number"
              ? rootTsRaw
              : typeof rootTsRaw === "string"
                ? Number.parseInt(rootTsRaw, 10)
                : undefined;
          const rootTs =
            typeof rootTsNum === "number" && Number.isFinite(rootTsNum)
              ? rootTsNum < 10_000_000_000
                ? rootTsNum * 1000
                : rootTsNum
              : Date.now();
          const tickers = data.data as Record<
            string,
            {
              closing_price: string;
              prev_closing_price: string;
              acc_trade_value_24H?: string;
              acc_trade_value?: string;
            }
          >;
          if (deps.currentExchangeRef.current !== label) return;
          let seq = 0;
          for (const [symbol, ticker] of Object.entries(tickers)) {
            if (symbol === "date") continue;
            seq += 1;
            const mapped = mapBithumbRestTickerToVM(ticker, symbol);
            if (!mapped) continue;
            deps.applyDomesticTicker(mapped.symbol, mapped.vm, {
              connId: 0,
              ts: rootTs,
              seq,
            });
          }
          if (deps.currentExchangeRef.current !== label) return;
          deps.setIsDomesticReady(true);
          deps.isDomesticReadyRef.current = true;
          deps.markCoinsFlushDirty();
          deps.setStatus((prev) => {
            const next = prev === "live" ? "live" : "degraded";
            deps.statusRef.current = next;
            return next;
          });
        }
      } else {
        deps.logThrottled(
          logKey("fallback_http_error"),
          `[${kind}] REST fallback HTTP ${response.status}`,
        );
      }
    } catch (e) {
      console.error(`[${kind}] REST fallback error:`, e);
    }
  };

  // --- Coinone ---
  const ensureCoinoneSymbols = async (): Promise<string[]> => {
    const fromRef = Array.from(deps.coinsRef.current.keys()).filter(Boolean);
    if (fromRef.length) return fromRef;
    try {
      const res = await fetch("/api/coinone/all-krw");
      if (!res.ok) return [];
      const json = await res.json();
      const tickers = (json?.tickers ?? []) as Array<{
        target_currency?: string;
      }>;
      return tickers
        .map((t) => t.target_currency?.toUpperCase?.())
        .filter((s): s is string => !!s);
    } catch {
      return [];
    }
  };

  const fetchCoinoneRestOnce = async () => {
    try {
      if (deps.currentExchangeRef.current !== label) return;
      const res = await fetch("/api/coinone/all-krw");
      if (deps.currentExchangeRef.current !== label) return;
      if (!res.ok) {
        deps.setStatus("degraded");
        deps.statusRef.current = "degraded";
        return;
      }
      const json = await res.json();
      if (json?.result !== "success" || !Array.isArray(json?.tickers)) {
        deps.setStatus("degraded");
        deps.statusRef.current = "degraded";
        return;
      }
      const tickers = json.tickers as Array<{
        target_currency: string;
        last: string;
        first: string;
        quote_volume?: string;
      }>;
      if (deps.currentExchangeRef.current !== label) return;
      const nowTs = Date.now();
      let seq = 0;
      for (const t of tickers) {
        const mapped = mapCoinoneRestTickerToVM(t);
        if (!mapped) continue;
        seq += 1;
        deps.applyDomesticTicker(mapped.symbol, mapped.vm, {
          connId: 0,
          ts: nowTs,
          seq,
        });
      }
      if (deps.currentExchangeRef.current !== label) return;
      deps.setIsDomesticReady(true);
      deps.isDomesticReadyRef.current = true;
      deps.markCoinsFlushDirty();
      deps.setStatus((prev) => {
        const next = prev === "live" ? "live" : "degraded";
        deps.statusRef.current = next;
        return next;
      });
      backoffMs = T.restBackoffInitialMs;
    } catch {
      deps.setStatus("degraded");
      deps.statusRef.current = "degraded";
    }
  };

  // --- Worker ---
  worker = new Worker(workerUrl);

  worker.onmessage = (ev: MessageEvent) => {
    const msg = ev.data as { type: string; data?: unknown; message?: string };

    if (msg.type === "open") {
      deps.setStatus("live");
      deps.statusRef.current = "live";
      console.log(`[${kind}] WS live (worker open)`);
      return;
    }
    if (msg.type === "close" || msg.type === "error") {
      if (!deps.isDomesticReadyRef.current) {
        deps.setStatus("degraded");
        deps.statusRef.current = "degraded";
      }
      console.warn(
        `[${kind}] WS ${msg.type} -> degraded (fallback eligible)`,
        msg.type === "error" && msg.message
          ? { message: msg.message }
          : undefined,
      );
      return;
    }
    if (msg.type === "reconnect_failed") {
      deps.setStatus("degraded");
      deps.statusRef.current = "degraded";
      console.warn(`[${kind}] WS reconnect_failed -> start REST fallback`);
      startAdaptiveFallback();
      return;
    }

    if (msg.type !== "tick" || !msg.data) return;
    if (deps.currentExchangeRef.current !== label) return;

    const d = msg.data as Record<string, unknown>;

    if (kind === "upbit") {
      const marketCode = d.market as string;
      const symbol = marketCode.split("-")[1];
      if (!symbol) return;
      const vm = mapUpbitWsTickToVM(
        d as unknown as Parameters<typeof mapUpbitWsTickToVM>[0],
      );
      const incoming = {
        connId: (d.connId as number) ?? 1,
        ts: (d.ts as number) ?? Date.now(),
        seq: (d.seq as number) ?? 0,
      };
      deps.applyDomesticTicker(symbol, vm, incoming);
    } else {
      const symbol = d.symbol as string;
      if (!symbol) return;
      const vm = mapClosePriceWsTickToVM(d as unknown as ClosePriceWsTick);
      const incoming = {
        connId: (d.connId as number) ?? 1,
        ts: (d.ts as number) ?? Date.now(),
        seq: (d.seq as number) ?? 0,
      };
      deps.applyDomesticTicker(symbol, vm, incoming);
    }

    deps.setIsDomesticReady(true);
    deps.isDomesticReadyRef.current = true;
    deps.markCoinsFlushDirty();
  };

  // Worker start (async)
  const startWorker = async () => {
    if (kind === "upbit") {
      await ensureUpbitMarkets();
      const fresh = deps.upbitMarketsRef.current.filter((m) =>
        m.startsWith("KRW-"),
      );
      if (!fresh.length) {
        console.warn(
          `[${kind}] WS skipped: empty markets list (will rely on REST fallback)`,
        );
        startAdaptiveFallback();
        return;
      }
      worker?.postMessage({ type: "start", markets: fresh });
    } else if (kind === "bithumb") {
      const symbols = await ensureBithumbSymbols();
      if (!symbols.length) {
        console.warn(
          `[${kind}] WS skipped: empty symbols list (will rely on REST fallback)`,
        );
        startAdaptiveFallback();
        return;
      }
      worker?.postMessage({ type: "start", symbols });
    } else {
      const symbols = await ensureCoinoneSymbols();
      if (!symbols.length) {
        console.warn(
          `[${kind}] WS skipped: empty symbols list (will rely on REST fallback)`,
        );
        startAdaptiveFallback();
        return;
      }
      worker?.postMessage({ type: "start", symbols });
    }
  };

  void startWorker();

  const delayedFallback = setTimeout(() => {
    if (deps.selectedExchange !== label) return;
    startAdaptiveFallback();
  }, T.adaptiveFallbackAfterMs);

  return () => {
    clearTimeout(delayedFallback);
    clearRestTimer();
    if (worker) {
      try {
        worker.postMessage({ type: "stop" });
      } catch {
        /* ignore */
      }
      worker.terminate();
      worker = null;
    }
  };
}
