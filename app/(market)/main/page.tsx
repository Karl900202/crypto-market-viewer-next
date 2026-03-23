"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { useT } from "@/hooks/useT";
import {
  type DomesticTickerVM,
  mergeDomesticTickerVM,
} from "@/lib/domestic-ticker-vm";
import { setupDomesticExchangeConnection } from "@/lib/setup-domestic-exchange-connection";
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

/** 스냅샷/증분 갱신: 렌더에 쓰는 필드만 문자열로 비교 (snapshotFromMergedMap과 동일 규칙) */
const coinDataSnapshotLine = (c: CoinData) =>
  `${c.symbol}:${c.koreanPrice ?? ""}:${c.domesticChangePercent ?? ""}:${c.domesticChangeAmount ?? ""}:${c.domesticTradeValueKrw ?? ""}:${c.globalPriceUsdt ?? ""}:${c.korp ?? ""}`;

/** ref 병합 결과를 state에 넣을 때, 변경된 심볼만 Map을 갱신해 리렌더 범위를 줄인다. */
function mergeIncrementalCoinsState(
  prev: Map<string, CoinData>,
  merged: Map<string, CoinData>,
): Map<string, CoinData> {
  if (merged.size !== prev.size) return merged;
  for (const k of merged.keys()) {
    if (!prev.has(k)) return merged;
  }
  for (const k of prev.keys()) {
    if (!merged.has(k)) return merged;
  }
  let changed = false;
  const next = new Map(prev);
  for (const [symbol, coin] of merged) {
    const old = prev.get(symbol)!;
    if (coinDataSnapshotLine(old) !== coinDataSnapshotLine(coin)) {
      next.set(symbol, coin);
      changed = true;
    }
  }
  return changed ? next : prev;
}

// 거래소 DTO는 lib/domestic-ticker-vm.ts의 mapper에서 변환됨
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
  const [selectedExchange, setSelectedExchange] = useState<string>("업비트 KRW");
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
  type CoinoneConnectionStatus = "idle" | "connecting" | "live" | "degraded";
  const [coinoneConnectionStatus, setCoinoneConnectionStatus] =
    useState<CoinoneConnectionStatus>("idle");
  const coinoneConnectionStatusRef = useRef<CoinoneConnectionStatus>("idle");
  const [priceFlash, setPriceFlash] = useState<
    Map<string, "up" | "down" | null>
  >(new Map());
  const coinsRef = useRef<Map<string, CoinData>>(new Map());
  /** 국내 거래소 티커 VM (업비트/빗썸/코인원 DTO → 통합 형식) */
  const domesticTickersRef = useRef<Map<string, DomesticTickerVM>>(new Map());
  const domesticLastKeyRef = useRef<
    Map<string, { connId: number; ts: number; seq: number }>
  >(new Map()); // symbol -> last applied key
  const upbitNameMapRef = useRef<Map<string, string>>(new Map()); // symbol -> korean_name
  const upbitMarketsRef = useRef<string[]>([]);
  const binancePricesRef = useRef<Map<string, number>>(new Map()); // base -> usdt price
  /** ref→coins state: dirty + RAF 루프(deltaTime 누적)로 1000ms마다 setCoins(증분) + 스냅샷 비교 */
  const coinsFlushDirtyRef = useRef(false);
  /** performance.now() 기준, 마지막으로 스냅샷이 바뀌어 setCoins 한 시각 */
  const coinsFlushLastTsRef = useRef(0);
  const coinsFlushSnapshotRef = useRef("");
  const coinsFlushRafPendingRef = useRef(false);
  const coinsFlushRafIdRef = useRef<number | null>(null);
  /** 직전 RAF 타임스탬프(없으면 다음 프레임에서 lastTs 대비 경과를 새로 잼) */
  const coinsFlushRafPrevTimeRef = useRef<number | null>(null);
  /** lastTs 이후 경과 시간(ms), RAF 프레임 간 deltaTime으로 누적 */
  const coinsFlushThrottleAccRef = useRef(0);
  const triggerCoinsStateSyncRef = useRef<(() => void) | null>(null);
  /** 거래소 전환 시 이전 비동기 응답이 refs에 쓰이는 것 방지 */
  const currentExchangeRef = useRef<string | null>(null);
  // listingsCount is derivable from coins.size when needed

  // 환율 변경 콜백 메모이제이션
  const handleRateChange = useCallback(() => {
    // 글로벌 환산은 렌더링 시점에 계산하므로 여기서는 no-op
  }, []);

  // 실시간 환율 가져오기 (10초 마다 업데이트, useRef 사용)
  const usdtToKrwRateRef = useExchangeRate(10 * 1000, 1400, handleRateChange);

  // 기준 거래소 상장 목록 로드
  useEffect(() => {
    const exchangeForThisLoad = selectedExchange;
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
          if (exchangeForThisLoad === "업비트 KRW") {
            upbitMarketsRef.current = markets.map((m) => m.market);
          }
        };

        // 빗썸도 한글명을 위해 업비트 마켓 목록을 "이름 사전"으로 재사용
        await ensureUpbitNameMap();

        if (exchangeForThisLoad === "업비트 KRW") {
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
          if (currentExchangeRef.current !== exchangeForThisLoad) return;
          coinsRef.current = map;
          setCoins(map);
          triggerCoinsStateSyncRef.current?.();
        } else if (exchangeForThisLoad === "빗썸 KRW") {
          // 빗썸: ALL_KRW 티커 keys가 상장 목록 역할
          const res = await fetch("/api/bithumb/all-krw");
          if (!res.ok) throw new Error("Failed to fetch bithumb tickers");
          const json = await res.json();
          const data = (json?.data ?? {}) as Record<string, unknown>;
          const symbols = Object.keys(data).filter((k) => k !== "date");
          const map = new Map<string, CoinData>();
          for (const s of symbols) {
            map.set(s, {
              symbol: s,
              name: upbitNameMapRef.current.get(s) ?? s,
            });
          }
          if (currentExchangeRef.current !== exchangeForThisLoad) return;
          coinsRef.current = map;
          setCoins(map);
          triggerCoinsStateSyncRef.current?.();
        } else if (exchangeForThisLoad === "코인원 KRW") {
          // 코인원: ticker_new/KRW 응답의 tickers 배열이 상장 목록
          const res = await fetch("/api/coinone/all-krw");
          if (!res.ok) throw new Error("Failed to fetch coinone tickers");
          const json = await res.json();
          const tickers = (json?.tickers ?? []) as Array<{
            target_currency?: string;
          }>;
          const map = new Map<string, CoinData>();
          for (const t of tickers) {
            const symbol = t.target_currency?.toUpperCase?.() ?? t.target_currency;
            if (!symbol) continue;
            map.set(symbol, {
              symbol,
              name: upbitNameMapRef.current.get(symbol) ?? symbol,
            });
          }
          if (currentExchangeRef.current !== exchangeForThisLoad) return;
          coinsRef.current = map;
          setCoins(map);
          triggerCoinsStateSyncRef.current?.();
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
        triggerCoinsStateSyncRef.current?.();
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
    if (selectedExchange !== "코인원 KRW") {
      setCoinoneConnectionStatus("idle");
      coinoneConnectionStatusRef.current = "idle";
    }
    domesticTickersRef.current.clear();
    domesticLastKeyRef.current.clear();

    // 거래소 전환 시 이전 리스트까지 비우고, loadListings가 새 목록을 채울 때까지 대기
    coinsRef.current = new Map();
    setCoins(new Map());
    currentExchangeRef.current = selectedExchange;

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
        if (!domesticTickersRef.current.has(s)) n++;
      }
      return n;
    };

    /** REST 폴백 중단: WS 정상 + 목록이 있고 + 모든 종목에 가격이 들어온 뒤에만 */
    const canStopRestFallbackWhileWsLive = () =>
      coinsRef.current.size > 0 && countMissingDomesticPrices() === 0;

    /** VM을 domesticTickersRef에 병합하고 가격 변동 플래시 처리 */
    const applyDomesticTicker = (
      symbol: string,
      vm: DomesticTickerVM,
      incoming: { connId: number; ts: number; seq: number },
    ) => {
      if (!shouldApply(symbol, incoming)) return;
      domesticLastKeyRef.current.set(symbol, incoming);
      const existing = domesticTickersRef.current.get(symbol);
      const prevPrice = existing?.price;
      handlePriceChange(symbol, vm.price, prevPrice, setPriceFlash);
      const merged = mergeDomesticTickerVM(existing, vm);
      domesticTickersRef.current.set(symbol, merged);
    };

    let cleanupDomesticExchange: (() => void) | null = null;

    const snapshotFromMergedMap = (m: Map<string, CoinData>) => {
      const parts: string[] = [];
      for (const symbol of [...m.keys()].sort()) {
        const c = m.get(symbol)!;
        parts.push(coinDataSnapshotLine(c));
      }
      return parts.join("|");
    };

    const mergeRefsToCoinsMap = () => {
      const updatedCoins = new Map(coinsRef.current);
      updatedCoins.forEach((coin, symbol) => {
        const ticker = domesticTickersRef.current.get(symbol);
        const koreanPrice = ticker?.price;
        const domesticChangePercent = ticker?.changePercent;
        const domesticChangeAmount = ticker?.changeAmount;
        const domesticTradeValueKrw = ticker?.tradeValueKrw;
        const globalPriceUsdt = binancePricesRef.current.get(symbol);
        const globalKrw =
          globalPriceUsdt !== undefined
            ? globalPriceUsdt * usdtToKrwRateRef.current
            : undefined;
        const korp =
          koreanPrice !== undefined && globalKrw !== undefined
            ? calculateKorP(koreanPrice, globalKrw)
            : undefined;
        updatedCoins.set(symbol, {
          ...coin,
          koreanPrice,
          korp,
          domesticChangePercent,
          domesticChangeAmount,
          domesticTradeValueKrw,
          globalPriceUsdt,
        });
      });
      return updatedCoins;
    };

    const scheduleCoinsFlushRaf = () => {
      if (coinsFlushRafPendingRef.current) return;
      coinsFlushRafPendingRef.current = true;
      coinsFlushRafIdRef.current = requestAnimationFrame(runCoinsFlushRaf);
    };

    const runCoinsFlushRaf = (now: number) => {
      coinsFlushRafIdRef.current = null;

      const prevTime = coinsFlushRafPrevTimeRef.current;
      const deltaTime = prevTime === null ? 0 : now - prevTime;
      coinsFlushRafPrevTimeRef.current = now;

      const throttleMs = 1000;
      if (prevTime === null) {
        coinsFlushThrottleAccRef.current = now - coinsFlushLastTsRef.current;
      } else {
        coinsFlushThrottleAccRef.current += deltaTime;
      }

      if (coinsFlushThrottleAccRef.current < throttleMs) {
        if (coinsFlushDirtyRef.current) {
          coinsFlushRafIdRef.current = requestAnimationFrame(runCoinsFlushRaf);
        } else {
          coinsFlushRafPendingRef.current = false;
          coinsFlushRafPrevTimeRef.current = null;
        }
        return;
      }

      const merged = mergeRefsToCoinsMap();
      const snap = snapshotFromMergedMap(merged);
      if (snap === coinsFlushSnapshotRef.current) {
        coinsFlushDirtyRef.current = false;
        coinsFlushRafPendingRef.current = false;
        coinsFlushRafPrevTimeRef.current = null;
        return;
      }

      coinsFlushSnapshotRef.current = snap;
      coinsFlushLastTsRef.current = now;
      coinsFlushDirtyRef.current = false;
      coinsFlushThrottleAccRef.current = 0;
      coinsFlushRafPrevTimeRef.current = null;
      setCoins((prev) => mergeIncrementalCoinsState(prev, merged));
      coinsFlushRafPendingRef.current = false;
    };

    const markCoinsFlushDirty = () => {
      coinsFlushDirtyRef.current = true;
      scheduleCoinsFlushRaf();
    };
    triggerCoinsStateSyncRef.current = markCoinsFlushDirty;

    const initialMerged = mergeRefsToCoinsMap();
    coinsFlushSnapshotRef.current = snapshotFromMergedMap(initialMerged);
    coinsFlushLastTsRef.current = performance.now();
    coinsFlushThrottleAccRef.current = 0;
    coinsFlushRafPrevTimeRef.current = null;
    coinsFlushDirtyRef.current = false;

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
        const baseDeps = {
          selectedExchange,
          currentExchangeRef,
          isDomesticReadyRef,
          setIsDomesticReady,
          coinsRef,
          upbitMarketsRef,
          applyDomesticTicker,
          markCoinsFlushDirty,
          canStopRestFallbackWhileWsLive,
          logThrottled,
          exchangeLoadingStartTimeRef,
          setShowExchangeLoading,
          hideLoadingAfterMinTime,
        };

        if (selectedExchange === "업비트 KRW") {
          cleanupDomesticExchange = setupDomesticExchangeConnection(
            "upbit",
            new URL("./upbit-ticker.worker.ts", import.meta.url),
            {
              ...baseDeps,
              statusRef: upbitConnectionStatusRef,
              setStatus: setUpbitConnectionStatus,
            },
          );
        } else if (selectedExchange === "빗썸 KRW") {
          cleanupDomesticExchange = setupDomesticExchangeConnection(
            "bithumb",
            new URL("./bithumb-ticker.worker.ts", import.meta.url),
            {
              ...baseDeps,
              statusRef: bithumbConnectionStatusRef,
              setStatus: setBithumbConnectionStatus,
            },
          );
        } else if (selectedExchange === "코인원 KRW") {
          cleanupDomesticExchange = setupDomesticExchangeConnection(
            "coinone",
            new URL("./coinone-ticker.worker.ts", import.meta.url),
            {
              ...baseDeps,
              statusRef: coinoneConnectionStatusRef,
              setStatus: setCoinoneConnectionStatus,
            },
          );
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

    return () => {
      if (coinsFlushRafIdRef.current !== null) {
        cancelAnimationFrame(coinsFlushRafIdRef.current);
        coinsFlushRafIdRef.current = null;
      }
      coinsFlushRafPendingRef.current = false;
      coinsFlushRafPrevTimeRef.current = null;
      triggerCoinsStateSyncRef.current = null;
      cleanupDomesticExchange?.();
      cleanupDomesticExchange = null;
      currentExchangeRef.current = null;
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
                      <option value="업비트 KRW">업비트 KRW</option>
                      <option value="빗썸 KRW">빗썸 KRW</option>
                      <option value="코인원 KRW">코인원 KRW</option>
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
                coinoneConnectionStatus={coinoneConnectionStatus}
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
