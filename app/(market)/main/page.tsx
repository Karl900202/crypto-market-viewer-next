"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { useT } from "@/hooks/useT";
import Loading from "./loading";
import {
  CoinListTable,
  type SortKey,
  type SortState,
} from "./components/CoinListTable";
import { COIN_LIST_ROW_GRID_CLASS } from "./components/CoinRow";

interface CoinData {
  symbol: string;
  name: string;
  // 국내 거래소 (기준 거래소) 데이터
  koreanPrice?: number; // KRW 현재가
  korp?: number;
  domesticChangePercent?: number; // 선택 국내 거래소 기준 전일대비(%)
  domesticChangeAmount?: number; // 선택 국내 거래소 기준 전일대비(가격차, KRW)
  domesticTradeValueKrw?: number; // 선택 국내 거래소 기준 거래대금(24H, KRW)

  // 글로벌(바이낸스 USDT) 매칭 데이터 (없으면 undefined)
  globalPriceUsdt?: number;
}

interface BithumbTicker {
  opening_price: string; // 시가
  closing_price: string; // 종가 (현재가)
  min_price: string; // 저가
  max_price: string; // 고가
  units_traded: string; // 거래량
  acc_trade_value: string; // 거래금액
  acc_trade_value_24H?: string; // 24시간 거래금액 (API에 따라 존재)
  prev_closing_price: string; // 전일종가
  fluctate_24H: string; // 24시간 변동금액
  fluctate_rate_24H: string; // 24시간 변동률
}

interface UpbitTicker {
  // REST: market, WS: code
  market?: string;
  code?: string;
  timestamp?: number;
  trade_timestamp?: number;
  opening_price: number;
  trade_price: number;
  trade_volume: number;
  high_price: number;
  low_price: number;
  prev_closing_price: number;
  change: string;
  change_price: number;
  change_rate: number;
  signed_change_price: number;
  signed_change_rate: number;
  acc_trade_price: number; // UTC 0시 기준 누적 거래대금 (KST 오전 9시 리셋)
  acc_trade_price_24h: number; // 24h 롤링
  acc_trade_volume: number; // UTC 0시 기준 누적 거래량 (KST 오전 9시 리셋)
  acc_trade_volume_24h: number; // 24h 롤링
}

type UpbitMarket = {
  market: string; // e.g. KRW-BTC
  korean_name: string;
  english_name: string;
};

// 유틸리티 함수들
const MIN_LOADING_DISPLAY_TIME = 200; // 최소 로딩 표시 시간 (ms)

/**
 * 가격 변동 감지 및 깜빡임 효과 설정
 */
const handlePriceChange = (
  symbol: string,
  newPrice: number,
  prevPrice: number | undefined,
  setPriceFlash: React.Dispatch<
    React.SetStateAction<Map<string, "up" | "down" | null>>
  >,
) => {
  if (prevPrice !== undefined && prevPrice !== newPrice) {
    const direction = newPrice > prevPrice ? "up" : "down";
    setPriceFlash((prev) => {
      const newFlash = new Map(prev);
      newFlash.set(symbol, direction);
      return newFlash;
    });

    setTimeout(() => {
      setPriceFlash((prev) => {
        const newFlash = new Map(prev);
        newFlash.set(symbol, null);
        return newFlash;
      });
    }, 500);
  }
};

/**
 * 최소 시간 후 로딩 숨기기
 */
const hideLoadingAfterMinTime = (
  startTimeRef: React.MutableRefObject<number | null>,
  setShowLoading: React.Dispatch<React.SetStateAction<boolean>>,
) => {
  const elapsed = Date.now() - (startTimeRef.current || 0);
  const remaining = Math.max(0, MIN_LOADING_DISPLAY_TIME - elapsed);
  setTimeout(() => {
    setShowLoading(false);
  }, remaining);
};

/**
 * KorP (Korean Premium) 계산
 */
const calculateKorP = (
  koreanPrice: number,
  globalPrice: number,
): number | undefined => {
  if (!Number.isFinite(koreanPrice) || !Number.isFinite(globalPrice)) return;
  if (globalPrice <= 0) return;
  const v = ((koreanPrice - globalPrice) / globalPrice) * 100;
  return Number.isFinite(v) ? v : undefined;
};

export default function MainPage() {
  const t = useT();
  const [coins, setCoins] = useState<Map<string, CoinData>>(new Map());
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedExchange, setSelectedExchange] = useState<string>("빗썸 KRW");
  const [selectedSymbol, setSelectedSymbol] = useState<string>("BTC");
  const [sort, setSort] = useState<SortState>({ mode: "default" });
  const hasInitializedSelectedSymbolRef = useRef(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const exchangeLoadingStartTimeRef = useRef<number | null>(null);
  const [showExchangeLoading, setShowExchangeLoading] = useState(false);
  const [isDomesticReady, setIsDomesticReady] = useState(false);
  const isDomesticReadyRef = useRef(false);
  type UpbitConnectionStatus = "idle" | "connecting" | "live" | "degraded";
  const [upbitConnectionStatus, setUpbitConnectionStatus] =
    useState<UpbitConnectionStatus>("idle");
  const upbitConnectionStatusRef = useRef<UpbitConnectionStatus>("idle");
  // WS 재연결/폴백은 자동으로 처리한다.
  type BithumbConnectionStatus = "idle" | "connecting" | "live" | "degraded";
  const [bithumbConnectionStatus, setBithumbConnectionStatus] =
    useState<BithumbConnectionStatus>("idle");
  const bithumbConnectionStatusRef = useRef<BithumbConnectionStatus>("idle");
  const [priceFlash, setPriceFlash] = useState<
    Map<string, "up" | "down" | null>
  >(new Map());
  const coinsRef = useRef<Map<string, CoinData>>(new Map());
  const koreanExchangePricesRef = useRef<Map<string, number>>(new Map());
  const koreanExchangeChangePercentRef = useRef<Map<string, number>>(new Map());
  const koreanExchangeChangeAmountRef = useRef<Map<string, number>>(new Map());
  const koreanExchangeTradeValueRef = useRef<Map<string, number>>(new Map());
  const domesticLastKeyRef = useRef<
    Map<string, { connId: number; ts: number; seq: number }>
  >(new Map()); // symbol -> last applied key
  const upbitNameMapRef = useRef<Map<string, string>>(new Map()); // symbol -> korean_name
  const upbitMarketsRef = useRef<string[]>([]);
  const binancePricesRef = useRef<Map<string, number>>(new Map()); // base -> usdt price
  // listingsCount is derivable from coins.size when needed

  // 환율 변경 콜백 메모이제이션
  const handleRateChange = useCallback(() => {
    // 글로벌 환산은 렌더링 시점에 계산하므로 여기서는 no-op
  }, []);

  // 실시간 환율 가져오기 (10초 마다 업데이트, useRef 사용)
  const usdtToKrwRateRef = useExchangeRate(10 * 1000, 1400, handleRateChange);

  // 기준 거래소 상장 목록 로드
  useEffect(() => {
    const loadListings = async () => {
      setIsInitialLoading(true);
      try {
        const ensureUpbitNameMap = async () => {
          if (upbitNameMapRef.current.size > 0) return;
          const res = await fetch("/api/upbit/markets");
          if (!res.ok) throw new Error("Failed to fetch upbit markets");
          const markets = (await res.json()) as UpbitMarket[];
          upbitNameMapRef.current = new Map(
            markets.map((m) => [m.market.split("-")[1], m.korean_name]),
          );
          // 업비트 마켓 코드 목록은 업비트 기준일 때만 필요
          if (selectedExchange === "업비트 KRW") {
            upbitMarketsRef.current = markets.map((m) => m.market);
          }
        };

        // 빗썸도 한글명을 위해 업비트 마켓 목록을 "이름 사전"으로 재사용
        await ensureUpbitNameMap();

        if (selectedExchange === "업비트 KRW") {
          // 업비트 기준: 이미 ensureUpbitNameMap()에서 name map이 채워짐.
          // markets 목록은 다시 불러오지 않고, upbitMarketsRef.current를 사용.
          const res = await fetch("/api/upbit/markets");
          if (!res.ok) throw new Error("Failed to fetch upbit markets");
          const markets = (await res.json()) as UpbitMarket[];
          upbitMarketsRef.current = markets.map((m) => m.market);

          const map = new Map<string, CoinData>();
          for (const m of markets) {
            const symbol = m.market.split("-")[1];
            map.set(symbol, { symbol, name: m.korean_name });
          }
          coinsRef.current = map;
          setCoins(map);
        } else {
          // 빗썸: ALL_KRW 티커 keys가 상장 목록 역할
          const res = await fetch("/api/bithumb/all-krw");
          if (!res.ok) throw new Error("Failed to fetch bithumb tickers");
          const json = await res.json();
          const data = (json?.data ?? {}) as Record<
            string,
            BithumbTicker | string
          >;
          const symbols = Object.keys(data).filter((k) => k !== "date");
          const map = new Map<string, CoinData>();
          for (const s of symbols) {
            map.set(s, {
              symbol: s,
              name: upbitNameMapRef.current.get(s) ?? s,
            });
          }
          coinsRef.current = map;
          setCoins(map);
        }

        // 선택 코인 초기화
        if (
          !hasInitializedSelectedSymbolRef.current &&
          coinsRef.current.size > 0
        ) {
          const first = coinsRef.current.keys().next().value as
            | string
            | undefined;
          if (first) setSelectedSymbol(first);
          hasInitializedSelectedSymbolRef.current = true;
        }
      } catch (e) {
        console.error("Error loading listings:", e);
      } finally {
        setIsInitialLoading(false);
      }
    };

    loadListings();
  }, [selectedExchange]);

  // 바이낸스 글로벌 가격 맵(USDT) 주기적 갱신
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    const fetchPrices = async () => {
      try {
        const res = await fetch("/api/binance/prices?quote=USDT");
        if (!res.ok) return;
        const json = (await res.json()) as { prices: Record<string, number> };
        binancePricesRef.current = new Map(Object.entries(json.prices ?? {}));
      } catch {
        // ignore
      }
    };
    fetchPrices();
    interval = setInterval(fetchPrices, 10_000);
    return () => {
      if (interval) clearInterval(interval);
    };
  }, []);

  // 거래소별 WebSocket 연결 및 데이터 업데이트
  useEffect(() => {
    // 로딩 시작
    exchangeLoadingStartTimeRef.current = Date.now();
    setShowExchangeLoading(true);
    setIsDomesticReady(false);
    isDomesticReadyRef.current = false;
    if (selectedExchange !== "업비트 KRW") {
      setUpbitConnectionStatus("idle");
      upbitConnectionStatusRef.current = "idle";
    }
    if (selectedExchange !== "빗썸 KRW") {
      setBithumbConnectionStatus("idle");
      bithumbConnectionStatusRef.current = "idle";
    }
    koreanExchangePricesRef.current.clear();
    koreanExchangeChangePercentRef.current.clear();
    koreanExchangeChangeAmountRef.current.clear();
    koreanExchangeTradeValueRef.current.clear();
    domesticLastKeyRef.current.clear();

    const shouldApply = (
      symbol: string,
      incoming: { connId: number; ts: number; seq: number },
    ) => {
      const prev = domesticLastKeyRef.current.get(symbol);
      if (!prev) return true;
      if (incoming.connId !== prev.connId) return incoming.connId > prev.connId;
      if (incoming.ts !== prev.ts) return incoming.ts > prev.ts;
      return incoming.seq > prev.seq;
    };

    /** 상장 목록 대비 아직 국내가가 없는 심볼 수 (WS만으로는 저유동 종목이 비는 경우가 있음) */
    const countMissingDomesticPrices = () => {
      let n = 0;
      for (const s of coinsRef.current.keys()) {
        if (!koreanExchangePricesRef.current.has(s)) n++;
      }
      return n;
    };

    /** REST 폴백 중단: WS 정상 + 목록이 있고 + 모든 종목에 가격이 들어온 뒤에만 */
    const canStopRestFallbackWhileWsLive = () =>
      coinsRef.current.size > 0 && countMissingDomesticPrices() === 0;

    // 거래소 전환 시 이전 거래소 값이 남아 보이는(stale) 현상 방지
    // 국내 거래소 기준 필드는 즉시 초기화하고, 새 데이터 수신 후 채운다.
    const clearedCoins = new Map(coinsRef.current);
    clearedCoins.forEach((coin, symbol) => {
      clearedCoins.set(symbol, {
        ...coin,
        koreanPrice: undefined,
        korp: undefined,
        domesticChangePercent: undefined,
        domesticChangeAmount: undefined,
        domesticTradeValueKrw: undefined,
      });
    });
    coinsRef.current = clearedCoins;
    setCoins(clearedCoins);

    let upbitWorker: Worker | null = null;
    let bithumbWorker: Worker | null = null;
    let updateInterval: NodeJS.Timeout | null = null;
    let upbitFallbackTimer: NodeJS.Timeout | null = null;
    let bithumbFallbackTimer: NodeJS.Timeout | null = null;

    const lastLogRef = { current: new Map<string, number>() };
    const logThrottled = (key: string, message: string, data?: unknown) => {
      const now = Date.now();
      const last = lastLogRef.current.get(key) ?? 0;
      if (now - last < 1200) return;
      lastLogRef.current.set(key, now);
      if (data !== undefined) console.log(message, data);
      else console.log(message);
    };

    const connectKoreanExchangeWebSocket = () => {
      try {
        if (selectedExchange === "업비트 KRW") {
          setUpbitConnectionStatus("connecting");
          upbitConnectionStatusRef.current = "connecting";
          console.log("[Upbit] WS connecting…");
          hideLoadingAfterMinTime(
            exchangeLoadingStartTimeRef,
            setShowExchangeLoading,
          );

          const ensureUpbitMarkets = async () => {
            if (upbitMarketsRef.current.length) return;
            try {
              const res = await fetch("/api/upbit/markets");
              if (!res.ok) return;
              const arr = (await res.json()) as { market: string }[];
              upbitMarketsRef.current = arr
                .map((m) => m.market)
                .filter((m) => typeof m === "string");
            } catch {
              // ignore
            }
          };

          // Ensure markets are ready BEFORE starting WS (avoid starting with empty list).
          // If it still fails, REST fallback will take over.
          void ensureUpbitMarkets();

          // WS in Web Worker
          upbitWorker = new Worker(
            new URL("./upbit-ticker.worker.ts", import.meta.url),
          );
          upbitWorker.onmessage = (ev: MessageEvent) => {
            const msg = ev.data as
              | {
                  type: "tick";
                  data: {
                    market: string;
                    connId: number;
                    ts: number;
                    seq: number;
                    tradePrice: number;
                    signedChangeRate: number;
                    signedChangePrice: number;
                    accTradePrice24h: number;
                  };
                }
              | {
                  type:
                    | "open"
                    | "close"
                    | "error"
                    | "reconnect_failed";
                  message?: string;
                };

            if (msg.type === "open") {
              setUpbitConnectionStatus("live");
              upbitConnectionStatusRef.current = "live";
              console.log("[Upbit] WS live (worker open)");
              return;
            }
            if (msg.type === "close" || msg.type === "error") {
              // WS가 닫히거나 에러가 나면 REST fallback을 사용(있다면).
              // isDomesticReady가 이미 true면 "live" 유지, 아니면 degraded로 표시한다.
              if (!isDomesticReadyRef.current) {
                setUpbitConnectionStatus("degraded");
                upbitConnectionStatusRef.current = "degraded";
              }
              console.warn(
                `[Upbit] WS ${msg.type} -> degraded (fallback eligible)`,
                msg.message ? { message: msg.message } : undefined,
              );
              return;
            }
            if (msg.type === "reconnect_failed") {
              setUpbitConnectionStatus("degraded");
              upbitConnectionStatusRef.current = "degraded";
              console.warn("[Upbit] WS reconnect_failed -> start REST fallback");
              startUpbitAdaptiveFallback();
              return;
            }
            if (msg.type === "tick") {
              const marketCode = msg.data.market;
              const symbol = marketCode.split("-")[1];
              if (!symbol) return;
              const price = msg.data.tradePrice;
              if (typeof price !== "number" || !Number.isFinite(price)) return;
              const incoming = {
                connId: msg.data.connId ?? 1,
                ts: msg.data.ts ?? Date.now(),
                seq: msg.data.seq ?? 0,
              };
              if (!shouldApply(symbol, incoming)) return;
              domesticLastKeyRef.current.set(symbol, incoming);
              const prevPrice = koreanExchangePricesRef.current.get(symbol);
              handlePriceChange(symbol, price, prevPrice, setPriceFlash);

              koreanExchangePricesRef.current.set(symbol, price);
              koreanExchangeChangePercentRef.current.set(
                symbol,
                msg.data.signedChangeRate * 100,
              );
              koreanExchangeChangeAmountRef.current.set(
                symbol,
                msg.data.signedChangePrice,
              );
              koreanExchangeTradeValueRef.current.set(
                symbol,
                msg.data.accTradePrice24h,
              );

              setIsDomesticReady(true);
              isDomesticReadyRef.current = true;
            }
          };
          // If the list is empty right now, wait briefly for ensureUpbitMarkets()
          // then start the worker with a fresh list.
          const startUpbitWorker = async () => {
            await ensureUpbitMarkets();
            const fresh = upbitMarketsRef.current.filter((m) =>
              m.startsWith("KRW-"),
            );
            if (!fresh.length) {
              console.warn(
                "[Upbit] WS skipped: empty markets list (will rely on REST fallback)",
              );
              return;
            }
            upbitWorker?.postMessage({ type: "start", markets: fresh });
          };
          void startUpbitWorker();

          // If WS doesn't deliver quickly, start adaptive fallback polling.
          let upbitBackoffMs = 800;
          const fetchFallbackOnce = async () => {
            try {
              const upbitKrwMarkets = upbitMarketsRef.current.filter((m) =>
                m.startsWith("KRW-"),
              );
              if (!upbitKrwMarkets.length) {
                await ensureUpbitMarkets();
              }
              const freshMarkets = upbitMarketsRef.current.filter((m) =>
                m.startsWith("KRW-"),
              );
              if (!freshMarkets.length) {
                logThrottled(
                  "upbit_fallback_skip_empty_markets",
                  "[Upbit] REST fallback skipped: empty markets list",
                );
                return;
              }

              logThrottled(
                "upbit_fallback_fetch",
                `[Upbit] REST fallback fetch (markets=${freshMarkets.length})`,
              );
              const nowTs = Date.now();
              let seq = 0;
              const UPBIT_TICKER_CHUNK = 45;
              for (let i = 0; i < freshMarkets.length; i += UPBIT_TICKER_CHUNK) {
                const chunk = freshMarkets.slice(i, i + UPBIT_TICKER_CHUNK);
                const marketsParam = chunk.join(",");
                const res = await fetch(`/api/upbit?markets=${marketsParam}`);
                if (!res.ok) {
                  logThrottled(
                    "upbit_fallback_http_error",
                    `[Upbit] REST fallback HTTP ${res.status}`,
                  );
                  return;
                }
                const arr = (await res.json()) as UpbitTicker[];
                for (const item of arr) {
                  const marketCode = item.market ?? item.code;
                  if (!marketCode) continue;
                  const symbol = marketCode.split("-")[1];
                  if (!symbol) continue;
                  if (
                    typeof item.trade_price !== "number" ||
                    !Number.isFinite(item.trade_price)
                  ) {
                    continue;
                  }
                  const ts =
                    (typeof item.trade_timestamp === "number" &&
                      item.trade_timestamp) ||
                    (typeof item.timestamp === "number" && item.timestamp) ||
                    nowTs;
                  seq += 1;
                  const incoming = { connId: 0, ts, seq };
                  if (!shouldApply(symbol, incoming)) continue;
                  domesticLastKeyRef.current.set(symbol, incoming);
                  koreanExchangePricesRef.current.set(symbol, item.trade_price);
                  koreanExchangeChangePercentRef.current.set(
                    symbol,
                    item.signed_change_rate * 100,
                  );
                  koreanExchangeChangeAmountRef.current.set(
                    symbol,
                    item.signed_change_price,
                  );
                  koreanExchangeTradeValueRef.current.set(
                    symbol,
                    item.acc_trade_price_24h,
                  );
                }
              }
              setIsDomesticReady(true);
              isDomesticReadyRef.current = true;
              setUpbitConnectionStatus((prev) => {
                const next = prev === "live" ? "live" : "degraded";
                upbitConnectionStatusRef.current = next;
                return next;
              });
              // success -> reset backoff (keep adaptive)
              upbitBackoffMs = 800;
            } catch {
              logThrottled(
                "upbit_fallback_exception",
                "[Upbit] REST fallback exception",
              );
              // ignore
            }
          };

          const scheduleUpbitFallback = (delay: number) => {
            if (upbitFallbackTimer) clearTimeout(upbitFallbackTimer);
            logThrottled(
              "upbit_fallback_schedule",
              `[Upbit] REST fallback scheduled in ${delay}ms`,
            );
            upbitFallbackTimer = setTimeout(async () => {
              if (selectedExchange !== "업비트 KRW") return;
              if (
                isDomesticReadyRef.current &&
                upbitConnectionStatusRef.current === "live" &&
                canStopRestFallbackWhileWsLive()
              )
                return logThrottled(
                  "upbit_fallback_stop_ws_live",
                  "[Upbit] REST fallback stopped: WS live + all listed symbols have domestic price",
                );
              await fetchFallbackOnce();
              if (!isDomesticReadyRef.current) {
                upbitBackoffMs = Math.min(5_000, upbitBackoffMs * 2);
              } else {
                upbitBackoffMs = Math.min(5_000, upbitBackoffMs * 1.25);
              }
              logThrottled(
                "upbit_fallback_next_delay",
                `[Upbit] REST fallback next backoff=${upbitBackoffMs}ms (ready=${isDomesticReadyRef.current})`,
              );
              scheduleUpbitFallback(upbitBackoffMs);
            }, delay);
          };

          const startUpbitAdaptiveFallback = () => {
            // start only once
            if (upbitFallbackTimer) return;
            console.warn("[Upbit] REST fallback started (adaptive)");
            scheduleUpbitFallback(1500);
          };

          // WS가 먼저 살아도 저유동 종목은 틱이 늦을 수 있어, REST로 빈 종목을 채울 때까지 폴백 유지
          setTimeout(() => {
            if (selectedExchange !== "업비트 KRW") return;
            startUpbitAdaptiveFallback();
          }, 2500);
        } else if (selectedExchange === "빗썸 KRW") {
          setBithumbConnectionStatus("connecting");
          bithumbConnectionStatusRef.current = "connecting";
          console.log("[Bithumb] WS connecting…");
          hideLoadingAfterMinTime(
            exchangeLoadingStartTimeRef,
            setShowExchangeLoading,
          );

          bithumbWorker = new Worker(
            new URL("./bithumb-ticker.worker.ts", import.meta.url),
          );

          bithumbWorker.onmessage = (ev: MessageEvent) => {
            const msg = ev.data as
              | {
                  type: "tick";
                  data: {
                    symbol: string;
                    connId: number;
                    ts: number;
                    seq: number;
                    closePrice: number;
                    changeRatePercent?: number;
                    changeAmount?: number;
                    tradeValueKrw?: number;
                  };
                }
              | {
                  type:
                    | "open"
                    | "close"
                    | "error"
                    | "reconnect_failed";
                  message?: string;
                };

            if (msg.type === "open") {
              setBithumbConnectionStatus("live");
              bithumbConnectionStatusRef.current = "live";
              console.log("[Bithumb] WS live (worker open)");
              return;
            }
            if (msg.type === "close" || msg.type === "error") {
              if (!isDomesticReadyRef.current) {
                setBithumbConnectionStatus("degraded");
                bithumbConnectionStatusRef.current = "degraded";
              }
              console.warn(
                `[Bithumb] WS ${msg.type} -> degraded (fallback eligible)`,
                msg.message ? { message: msg.message } : undefined,
              );
              return;
            }
            if (msg.type === "reconnect_failed") {
              setBithumbConnectionStatus("degraded");
              bithumbConnectionStatusRef.current = "degraded";
              console.warn("[Bithumb] WS reconnect_failed -> start REST fallback");
              startBithumbAdaptiveFallback();
              return;
            }
            if (msg.type === "tick") {
              const symbol = msg.data.symbol;
              if (!symbol) return;
              const close = msg.data.closePrice;
              if (typeof close !== "number" || !Number.isFinite(close)) return;
              const incoming = {
                connId: msg.data.connId ?? 1,
                ts: msg.data.ts ?? Date.now(),
                seq: msg.data.seq ?? 0,
              };
              if (!shouldApply(symbol, incoming)) return;
              domesticLastKeyRef.current.set(symbol, incoming);
              const prevPrice = koreanExchangePricesRef.current.get(symbol);
              handlePriceChange(symbol, close, prevPrice, setPriceFlash);
              koreanExchangePricesRef.current.set(symbol, close);

              if (typeof msg.data.changeRatePercent === "number") {
                koreanExchangeChangePercentRef.current.set(
                  symbol,
                  msg.data.changeRatePercent,
                );
              }
              if (typeof msg.data.changeAmount === "number") {
                koreanExchangeChangeAmountRef.current.set(
                  symbol,
                  msg.data.changeAmount,
                );
              }
              if (typeof msg.data.tradeValueKrw === "number") {
                koreanExchangeTradeValueRef.current.set(
                  symbol,
                  msg.data.tradeValueKrw,
                );
              }

              setIsDomesticReady(true);
              isDomesticReadyRef.current = true;
            }
          };

          // coinsRef는 loadListings와 레이스할 수 있음(첫 진입 시 빈 Map).
          // 업비트와 같이 심볼이 준비된 뒤에만 WS를 시작한다.
          const ensureBithumbSymbols = async (): Promise<string[]> => {
            const fromRef = Array.from(coinsRef.current.keys()).filter(Boolean);
            if (fromRef.length) return fromRef;
            try {
              const res = await fetch("/api/bithumb/all-krw");
              if (!res.ok) return [];
              const json = (await res.json()) as {
                data?: Record<string, unknown>;
              };
              const data = json.data ?? {};
              return Object.keys(data).filter((k) => k !== "date");
            } catch {
              return [];
            }
          };

          const startBithumbWorker = async () => {
            const symbols = await ensureBithumbSymbols();
            if (!symbols.length) {
              console.warn(
                "[Bithumb] WS skipped: empty symbols list (will rely on REST fallback)",
              );
              return;
            }
            bithumbWorker?.postMessage({ type: "start", symbols });
          };
          void startBithumbWorker();

          // WS가 빠르게 안 오면 REST 폴백(adaptive)
          let bithumbBackoffMs = 1200;
          const fetchBithumbFallbackOnce = async () => {
            try {
              logThrottled(
                "bithumb_fallback_fetch",
                "[Bithumb] REST fallback fetch (/api/bithumb/all-krw)",
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
                  const tickers = data.data as Record<string, BithumbTicker>;
                  let seq = 0;
                  for (const [symbol, ticker] of Object.entries(tickers)) {
                    if (symbol === "date") continue;
                    seq += 1;
                    const incoming = { connId: 0, ts: rootTs, seq };
                    if (!shouldApply(symbol, incoming)) continue;
                    domesticLastKeyRef.current.set(symbol, incoming);
                    const close = parseFloat(ticker.closing_price);
                    const prevClose = parseFloat(ticker.prev_closing_price);
                    const prevPrice =
                      koreanExchangePricesRef.current.get(symbol);

                    handlePriceChange(symbol, close, prevPrice, setPriceFlash);
                    if (Number.isFinite(close)) {
                      koreanExchangePricesRef.current.set(symbol, close);
                    }

                    if (
                      Number.isFinite(close) &&
                      Number.isFinite(prevClose) &&
                      prevClose !== 0
                    ) {
                      const changeAmount = close - prevClose;
                      const changePercent = (changeAmount / prevClose) * 100;
                      koreanExchangeChangeAmountRef.current.set(
                        symbol,
                        changeAmount,
                      );
                      koreanExchangeChangePercentRef.current.set(
                        symbol,
                        changePercent,
                      );
                    }

                    const tradeValue = parseFloat(
                      (ticker.acc_trade_value_24H ??
                        ticker.acc_trade_value) as string,
                    );
                    if (Number.isFinite(tradeValue)) {
                      koreanExchangeTradeValueRef.current.set(
                        symbol,
                        tradeValue,
                      );
                    }
                  }
                  setIsDomesticReady(true);
                  isDomesticReadyRef.current = true;
                  setBithumbConnectionStatus((prev) => {
                    const next = prev === "live" ? "live" : "degraded";
                    bithumbConnectionStatusRef.current = next;
                    return next;
                  });
                  // Do NOT reset backoff on success while WS isn't live.
                  // Let scheduleBithumbFallback() adapt (and cap at 5s) to reduce log/network spam.
                }
              } else {
                logThrottled(
                  "bithumb_fallback_http_error",
                  `[Bithumb] REST fallback HTTP ${response.status}`,
                );
              }
            } catch (error) {
              console.error("Error fetching Bithumb data:", error);
            }
          };

          const scheduleBithumbFallback = (delay: number) => {
            if (bithumbFallbackTimer) clearTimeout(bithumbFallbackTimer);
            logThrottled(
              "bithumb_fallback_schedule",
              `[Bithumb] REST fallback scheduled in ${delay}ms`,
            );
            bithumbFallbackTimer = setTimeout(async () => {
              if (selectedExchange !== "빗썸 KRW") return;
              if (
                isDomesticReadyRef.current &&
                bithumbConnectionStatusRef.current === "live" &&
                canStopRestFallbackWhileWsLive()
              )
                return logThrottled(
                  "bithumb_fallback_stop_ws_live",
                  "[Bithumb] REST fallback stopped: WS live + all listed symbols have domestic price",
                );
              await fetchBithumbFallbackOnce();
              if (!isDomesticReadyRef.current) {
                bithumbBackoffMs = Math.min(5_000, bithumbBackoffMs * 2);
              } else {
                bithumbBackoffMs = Math.min(5_000, bithumbBackoffMs * 1.25);
              }
              logThrottled(
                "bithumb_fallback_next_delay",
                `[Bithumb] REST fallback next backoff=${bithumbBackoffMs}ms (ready=${isDomesticReadyRef.current})`,
              );
              scheduleBithumbFallback(bithumbBackoffMs);
            }, delay);
          };

          const startBithumbAdaptiveFallback = () => {
            if (bithumbFallbackTimer) return;
            console.warn("[Bithumb] REST fallback started (adaptive)");
            scheduleBithumbFallback(1500);
          };

          setTimeout(() => {
            if (selectedExchange !== "빗썸 KRW") return;
            startBithumbAdaptiveFallback();
          }, 2500);
        }
      } catch (error) {
        console.error("Korean Exchange WebSocket 연결 실패:", error);
        hideLoadingAfterMinTime(
          exchangeLoadingStartTimeRef,
          setShowExchangeLoading,
        );
      }
    };

    connectKoreanExchangeWebSocket();

    // 500ms마다 ref의 데이터를 state로 업데이트
    updateInterval = setInterval(() => {
      const updatedCoins = new Map(coinsRef.current);
      updatedCoins.forEach((coin, symbol) => {
        const koreanPrice = koreanExchangePricesRef.current.get(symbol);
        const domesticChangePercent =
          koreanExchangeChangePercentRef.current.get(symbol);
        const domesticChangeAmount =
          koreanExchangeChangeAmountRef.current.get(symbol);
        const domesticTradeValueKrw =
          koreanExchangeTradeValueRef.current.get(symbol);
        const globalPriceUsdt = binancePricesRef.current.get(symbol);
        const globalKrw =
          globalPriceUsdt !== undefined
            ? globalPriceUsdt * usdtToKrwRateRef.current
            : undefined;
        const korp =
          koreanPrice !== undefined && globalKrw !== undefined
            ? calculateKorP(koreanPrice, globalKrw)
            : undefined;

        // 값이 없으면 undefined로 덮어써서 "이전 거래소 값"이 남지 않게 한다.
        updatedCoins.set(symbol, {
          ...coin,
          koreanPrice: koreanPrice,
          korp,
          domesticChangePercent: domesticChangePercent,
          domesticChangeAmount: domesticChangeAmount,
          domesticTradeValueKrw: domesticTradeValueKrw,
          globalPriceUsdt: globalPriceUsdt,
        });
      });
      setCoins(updatedCoins);
    }, 500);

    return () => {
      if (updateInterval) {
        clearInterval(updateInterval);
      }
      if (upbitFallbackTimer) clearTimeout(upbitFallbackTimer);
      if (bithumbFallbackTimer) clearTimeout(bithumbFallbackTimer);
      if (upbitWorker) {
        try {
          upbitWorker.postMessage({ type: "stop" });
        } catch {}
        upbitWorker.terminate();
      }
      if (bithumbWorker) {
        try {
          bithumbWorker.postMessage({ type: "stop" });
        } catch {}
        bithumbWorker.terminate();
      }
    };
  }, [selectedExchange, usdtToKrwRateRef]);

  const collator = new Intl.Collator("ko-KR", { sensitivity: "base" });
  const toggleSort = (key: SortKey) => {
    setSort((prev) => {
      if (prev.mode === "default" || prev.key !== key) {
        return { mode: "custom", key, dir: "asc" };
      }
      if (prev.dir === "asc") {
        return { mode: "custom", key, dir: "desc" };
      }
      return { mode: "default" };
    });
  };

  const coinsArray = Array.from(coins.values());
  const filteredCoins = coinsArray
    .filter(
      (coin) =>
        coin.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        coin.symbol.toLowerCase().includes(searchQuery.toLowerCase()),
    )
    .sort((a, b) => {
      const compareOptionalNumber = (
        av: number | undefined,
        bv: number | undefined,
        dirMul: number,
      ) => {
        const aUndef = av === undefined || !Number.isFinite(av);
        const bUndef = bv === undefined || !Number.isFinite(bv);
        if (aUndef && bUndef) return 0;
        if (aUndef) return 1; // undefined는 항상 아래
        if (bUndef) return -1;
        return (av - bv) * dirMul;
      };

      if (sort.mode === "default") {
        return compareOptionalNumber(
          a.domesticTradeValueKrw,
          b.domesticTradeValueKrw,
          -1,
        );
      }

      const dirMul = sort.dir === "asc" ? 1 : -1;

      if (sort.key === "name") {
        const an = a.name || a.symbol;
        const bn = b.name || b.symbol;
        return collator.compare(an, bn) * dirMul;
      }
      if (sort.key === "korp")
        return compareOptionalNumber(a.korp, b.korp, dirMul);
      if (sort.key === "price")
        return compareOptionalNumber(a.koreanPrice, b.koreanPrice, dirMul);
      if (sort.key === "change")
        return compareOptionalNumber(
          a.domesticChangePercent,
          b.domesticChangePercent,
          dirMul,
        );
      return compareOptionalNumber(
        a.domesticTradeValueKrw,
        b.domesticTradeValueKrw,
        dirMul,
      );
    });

  const formatPrice = (price: number) => {
    if (!Number.isFinite(price)) return "-";
    const abs = Math.abs(price);
    // Small-price coins (e.g. BTT 0.000524) need more precision.
    const maximumFractionDigits =
      abs >= 1000
        ? 0
        : abs >= 1
          ? 2
          : abs >= 0.01
            ? 4
            : abs >= 0.0001
              ? 6
              : 8;
    return price.toLocaleString("ko-KR", {
      minimumFractionDigits: 0,
      maximumFractionDigits,
    });
  };

  const formatTradeValueInMillionsKrw = (valueKrw: number) => {
    const millions = Math.round(valueKrw / 1_000_000);
    return `${millions.toLocaleString("ko-KR")}백만`;
  };

  const onSelectSymbol = useCallback((symbol: string) => {
    setSelectedSymbol(symbol);
  }, []);

  // 첫 로딩 시에만 loading.tsx 표시
  if (isInitialLoading) {
    return <Loading />;
  }

  const selectedCoin = coins.get(selectedSymbol) ?? filteredCoins[0];
  const selectedCoinSymbol = selectedCoin?.symbol ?? "BTC";

  const SkeletonRow = ({ keyProp }: { keyProp: number }) => (
    <div
      key={keyProp}
      className="border-b border-[#eef1f5] bg-white px-3 py-2 dark:border-gray-800"
    >
      <div className={COIN_LIST_ROW_GRID_CLASS}>
        <div className="min-w-0">
          <div className="h-3 w-28 bg-gray-200 dark:bg-gray-700 rounded animate-skeleton" />
          <div className="mt-1 h-2.5 w-12 bg-gray-200 dark:bg-gray-700 rounded animate-skeleton" />
        </div>
        <div className="h-3 w-16 ml-auto bg-gray-200 dark:bg-gray-700 rounded animate-skeleton" />
        <div className="ml-1 flex justify-end">
          <div className="h-3 w-10 bg-gray-200 dark:bg-gray-700 rounded animate-skeleton" />
        </div>
        <div className="h-3 w-12 ml-auto bg-gray-200 dark:bg-gray-700 rounded animate-skeleton" />
        <div className="h-3 w-14 ml-auto bg-gray-200 dark:bg-gray-700 rounded animate-skeleton" />
      </div>
    </div>
  );

  return (
    <div className="h-full overflow-hidden bg-gray-100 text-gray-900 dark:bg-gray-950 dark:text-white">
      <div className="flex h-full w-full min-h-0">
        <div className="flex h-full min-h-0 w-full gap-4">
          {/* Left: market list — 종목명 한 줄 표시를 위해 폭 여유 */}
          <aside className="flex w-[462px] shrink-0 flex-col overflow-hidden border-r border-[#e5e8eb] bg-white dark:border-gray-800 dark:bg-gray-900 min-h-0 min-w-0">
            <div className="shrink-0 border-b border-[#e5e8eb] px-3 py-3 dark:border-gray-800">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="shrink-0 text-[13px] text-gray-500 dark:text-gray-400">
                      {t("market.baseExchange")}
                    </span>
                    <select
                      value={selectedExchange}
                      onChange={(e) => setSelectedExchange(e.target.value)}
                      className="shrink-0 rounded border border-gray-200 bg-gray-50 px-2 py-1 text-[13px] text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    >
                      <option value="빗썸 KRW">빗썸 KRW</option>
                      <option value="업비트 KRW">업비트 KRW</option>
                    </select>
                  </div>

                  <div
                    className="mt-1.5 pt-2 text-[13px] leading-snug text-gray-500 dark:text-gray-400"
                    title={t("market.globalReferenceHint")}
                  >
                    <span className="text-gray-500 dark:text-gray-400">
                      {t("market.globalReference")}
                    </span>
                    <span className="mx-1 text-gray-400 dark:text-gray-500">
                      ·
                    </span>
                    <span className="font-medium text-gray-700 dark:text-gray-200">
                      {t("market.binanceUsdtMarket")}
                    </span>
                  </div>
                </div>

                <span className="shrink-0 text-[13px] text-gray-500 dark:text-gray-400">
                  {t("market.totalCoins", { count: coins.size })}
                </span>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder={t("market.searchPlaceholder")}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded border border-gray-200 bg-gray-50 py-1.5 pl-8 pr-2.5 text-xs text-gray-900 focus:border-yellow-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                    ⌕
                  </span>
                </div>
              </div>
            </div>

            <div className="relative flex-1 min-h-0 min-w-0 overflow-hidden flex flex-col">
              {showExchangeLoading && (
                <div className="absolute inset-0 bg-white/75 dark:bg-gray-900/75 backdrop-blur-sm flex items-center justify-center z-10">
                  <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-yellow-400 mb-2"></div>
                    <p className="text-gray-900 dark:text-white text-sm">
                      {t("market.exchangeLoading", {
                        exchange: selectedExchange.replace(" KRW", ""),
                      })}
                    </p>
                  </div>
                </div>
              )}

              <CoinListTable
                t={t as unknown as (key: string, params?: Record<string, string | number>) => string}
                sort={sort}
                onToggleSort={toggleSort}
                isDomesticReady={isDomesticReady}
                selectedExchange={selectedExchange}
                upbitConnectionStatus={upbitConnectionStatus}
                bithumbConnectionStatus={bithumbConnectionStatus}
                coins={filteredCoins.map((coin) => ({
                  symbol: coin.symbol,
                  name: coin.name,
                  korp: coin.korp,
                  koreanPrice: coin.koreanPrice,
                  globalPriceKrw:
                    coin.globalPriceUsdt !== undefined
                      ? coin.globalPriceUsdt * usdtToKrwRateRef.current
                      : undefined,
                  domesticChangePercent: coin.domesticChangePercent,
                  domesticChangeAmount: coin.domesticChangeAmount,
                  domesticTradeValueKrw: coin.domesticTradeValueKrw,
                }))}
                selectedSymbol={selectedCoinSymbol}
                priceFlash={priceFlash}
                onSelect={onSelectSymbol}
                formatPrice={formatPrice}
                formatTradeValueInMillionsKrw={formatTradeValueInMillionsKrw}
                SkeletonRow={SkeletonRow}
              />
            </div>
          </aside>

          {/* Right: 시세 카드 + 차트를 하나의 패널로 */}
          <main className="min-h-0 min-w-0 flex-1">
            <div className="flex h-full min-h-0 flex-col overflow-hidden border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <div className="flex shrink-0 items-center justify-between gap-4 px-5 py-4 ">
                <div className="min-w-0">
                  <div className="truncate text-base font-semibold leading-tight">
                    {selectedCoin?.name ?? selectedCoinSymbol}
                  </div>
                  <div className="mt-0.5 truncate text-sm text-gray-500 dark:text-gray-400">
                    {selectedCoinSymbol}/KRW · {t("market.binanceUsdtMarket")}{" "}
                    KRW 환산
                  </div>
                </div>
                <div className="shrink-0 text-right tabular-nums">
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {selectedExchange.replace(" KRW", "")} / GLOBAL
                  </div>
                  <div className="text-base font-semibold">
                    {selectedCoin?.koreanPrice
                      ? formatPrice(selectedCoin.koreanPrice)
                      : "-"}{" "}
                    <span className="text-gray-500 dark:text-gray-400">·</span>{" "}
                    {selectedCoin?.globalPriceUsdt !== undefined
                      ? formatPrice(
                          selectedCoin.globalPriceUsdt *
                            usdtToKrwRateRef.current,
                        )
                      : "-"}
                  </div>
                </div>
              </div>

              <div className="min-h-0 flex-1 p-4">
                <div className="flex h-full min-h-[280px] items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50/80 dark:border-gray-700 dark:bg-gray-800/40">
                  <div className="text-center">
                    <div className="font-medium text-gray-700 dark:text-gray-200">
                      {t("chart.placeholderTitle")}
                    </div>
                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {t("chart.placeholderSubtitle")}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
