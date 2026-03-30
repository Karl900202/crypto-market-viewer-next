"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { useT } from "@/hooks/useT";
import {
  type DomesticTickerVM,
  domesticTickerVmSnapshot,
  mergeDomesticTickerVM,
} from "@/lib/domestic-ticker-vm";
import { domesticExchangeWorkerUrls } from "@/lib/domestic-exchange-worker-urls";
import { setupDomesticExchangeConnection } from "@/lib/setup-domestic-exchange-connection";
import { getCoinEnglishDisplayName } from "@/lib/coin-english-display-name";
import type { NameColumnMode } from "@/lib/name-column-mode";
import { hasStableSortDataForAll, sortDisplayCoins } from "@/lib/coin-sort";
import { useMarketLayoutResponsive } from "@/hooks/useMarketLayoutResponsive";
import { useMarketSelectionStore } from "@/stores/useMarketSelectionStore";
import { useFavoriteCoinsStore } from "@/stores/useFavoriteCoinsStore";
import { KRW_EXCHANGE } from "@/lib/krw-exchange";
import { loadBinanceUsdtPrices, loadUpbitMarkets } from "@/lib/market-bootstrap";
import {
  CoinListTable,
  type SortKey,
  type SortState,
} from "./components/CoinListTable";
import { MarketRightPanel } from "./components/MarketRightPanel";

interface CoinData {
  symbol: string;
  name: string;
  /** 국내 기준 거래소 티커 (VM과 동일 스키마) */
  domestic?: DomesticTickerVM;
  korp?: number;
  /** 글로벌(바이낸스 USDT) 매칭 가격 */
  globalPriceUsdt?: number;
}

/** 스냅샷/증분 갱신: 렌더에 쓰는 필드만 문자열로 비교 */
const coinDataSnapshotLine = (c: CoinData) =>
  `${c.symbol}:${domesticTickerVmSnapshot(c.domestic)}:${c.globalPriceUsdt ?? ""}:${c.korp ?? ""}`;

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
    const oldLine = coinDataSnapshotLine(old);
    const newLine = coinDataSnapshotLine(coin);
    if (oldLine !== newLine) {
      next.set(symbol, coin);
      changed = true;
    }
  }
  return changed ? next : prev;
}

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
  const selectedExchange = useMarketSelectionStore((s) => s.selectedExchange);
  /** selectedSymbolByExchange는 setSelectedSymbol마다 새 객체가 되어 구독 시 매 클릭 리렌더됨 → 구독하지 않음 */
  const setSelectedSymbol = useMarketSelectionStore((s) => s.setSelectedSymbol);
  const setSelectedExchangeAndRestoreSymbol = useMarketSelectionStore(
    (s) => s.setSelectedExchangeAndRestoreSymbol,
  );
  const favorites = useFavoriteCoinsStore((s) => s.favorites);
  const toggleFavorite = useFavoriteCoinsStore((s) => s.toggleFavorite);
  const [sort, setSort] = useState<SortState>({ mode: "default" });
  /** 상장 로드 비동기 완료 시점의 검색·정렬 (effect deps에 넣지 않음) */
  const searchQueryRef = useRef(searchQuery);
  const sortRef = useRef(sort);
  searchQueryRef.current = searchQuery;
  sortRef.current = sort;
  const [nameColumnMode, setNameColumnMode] =
    useState<NameColumnMode>("korean");
  const { isStacked } = useMarketLayoutResponsive();
  /** 모바일만: 목록 ↔ 차트 전환 · 데스크톱은 항상 좌우 분할 */
  const [mobileChartOpen, setMobileChartOpen] = useState(false);
  const exchangeLoadingStartTimeRef = useRef<number | null>(null);
  const [, setShowExchangeLoading] = useState(false);
  const [isDomesticReady, setIsDomesticReady] = useState(false);
  /** 정렬에 필요한 필드가 아직 다 안 왔을 때 리스트 대신 스켈레톤 — 일부만 오면 순서가 흔들임 */
  const [sortListForceShow, setSortListForceShow] = useState(false);
  const isDomesticReadyRef = useRef(false);
  type UpbitConnectionStatus = "idle" | "connecting" | "live" | "degraded";
  const [, setUpbitConnectionStatus] = useState<UpbitConnectionStatus>("idle");
  const upbitConnectionStatusRef = useRef<UpbitConnectionStatus>("idle");
  // WS 재연결/폴백은 자동으로 처리한다.
  type BithumbConnectionStatus = "idle" | "connecting" | "live" | "degraded";
  const [, setBithumbConnectionStatus] =
    useState<BithumbConnectionStatus>("idle");
  const bithumbConnectionStatusRef = useRef<BithumbConnectionStatus>("idle");
  type CoinoneConnectionStatus = "idle" | "connecting" | "live" | "degraded";
  const [, setCoinoneConnectionStatus] =
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

  /** 환율 콜백에서 갱신 — 테이블 글로벌 KRW 열·useMemo deps용 (ref만 바뀌면 리렌더 없음) */
  const [displayUsdtToKrw, setDisplayUsdtToKrw] = useState(1400);
  const handleRateChange = useCallback((newRate: number) => {
    setDisplayUsdtToKrw(newRate);
    triggerCoinsStateSyncRef.current?.();
  }, []);

  useEffect(() => {
    if (!isStacked) setMobileChartOpen(false);
  }, [isStacked]);

  useEffect(() => {
    setMobileChartOpen(false);
  }, [selectedExchange]);

  // 실시간 환율 가져오기 (10초 마다 업데이트, useRef 사용)
  const usdtToKrwRateRef = useExchangeRate(10 * 1000, 1400, handleRateChange);

  // 기준 거래소 상장 목록 로드
  useEffect(() => {
    const exchangeForThisLoad = selectedExchange;
    const loadListings = async () => {
      try {
        const ensureUpbitNameMap = async () => {
          if (upbitNameMapRef.current.size > 0) return;
          const markets = await loadUpbitMarkets();
          upbitNameMapRef.current = new Map(
            markets.map((m) => [m.market.split("-")[1], m.korean_name]),
          );
          if (exchangeForThisLoad === KRW_EXCHANGE.UPBIT) {
            upbitMarketsRef.current = markets.map((m) => m.market);
          }
        };

        // 빗썸도 한글명을 위해 업비트 마켓 목록을 "이름 사전"으로 재사용
        await ensureUpbitNameMap();

        if (exchangeForThisLoad === KRW_EXCHANGE.UPBIT) {
          const markets = await loadUpbitMarkets();
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
        } else if (exchangeForThisLoad === KRW_EXCHANGE.BITHUMB) {
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
        } else if (exchangeForThisLoad === KRW_EXCHANGE.COINONE) {
          // 코인원: ticker_new/KRW 응답의 tickers 배열이 상장 목록
          const res = await fetch("/api/coinone/all-krw");
          if (!res.ok) throw new Error("Failed to fetch coinone tickers");
          const json = await res.json();
          const tickers = (json?.tickers ?? []) as Array<{
            target_currency?: string;
          }>;
          const map = new Map<string, CoinData>();
          for (const t of tickers) {
            const symbol =
              t.target_currency?.toUpperCase?.() ?? t.target_currency;
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

        // 선택 심볼: (1) 검색 없음 → persist된 심볼이 상장에 있으면 유지(새로고침 시 이전 선택 복원) (2) 검색 있음 → 유지 또는 필터 첫 코인 (3) 없으면 BTC (4) BTC 없으면 기본 정렬 첫 코인
        if (coinsRef.current.size > 0) {
          const st = useMarketSelectionStore.getState();
          const currentSym = st.selectedSymbol;
          let pick: string | undefined;

          if (currentSym && coinsRef.current.has(currentSym)) {
            pick = currentSym;
          } else {
            const coinsArray = Array.from(coinsRef.current.values());
            const qRaw = searchQueryRef.current.trim();
            const q = qRaw.toLowerCase();

            if (q) {
              const filtered = coinsArray.filter((coin) => {
                const en = getCoinEnglishDisplayName(coin.symbol).toLowerCase();
                return (
                  coin.name.toLowerCase().includes(q) ||
                  coin.symbol.toLowerCase().includes(q) ||
                  en.includes(q)
                );
              });
              const sortedFiltered = sortDisplayCoins(filtered, sortRef.current);
              if (sortedFiltered.length > 0) {
                pick = sortedFiltered[0].symbol;
              }
            }

            if (!pick) {
              if (coinsRef.current.has("BTC")) {
                pick = "BTC";
              } else {
                const sortedAll = sortDisplayCoins(coinsArray, {
                  mode: "default",
                });
                pick = sortedAll[0]?.symbol;
              }
            }
          }

          if (pick && pick !== st.selectedSymbol) setSelectedSymbol(pick);
        }
      } catch (e) {
        console.error("Error loading listings:", e);
      }
    };

    loadListings();
  }, [selectedExchange, setSelectedSymbol]);

  // 바이낸스 글로벌 가격 맵(USDT) 주기적 갱신
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    const fetchPrices = async () => {
      try {
        const json = await loadBinanceUsdtPrices();
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
    if (selectedExchange !== KRW_EXCHANGE.UPBIT) {
      setUpbitConnectionStatus("idle");
      upbitConnectionStatusRef.current = "idle";
    }
    if (selectedExchange !== KRW_EXCHANGE.BITHUMB) {
      setBithumbConnectionStatus("idle");
      bithumbConnectionStatusRef.current = "idle";
    }
    if (selectedExchange !== KRW_EXCHANGE.COINONE) {
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
        const domestic = domesticTickersRef.current.get(symbol);
        const globalPriceUsdt = binancePricesRef.current.get(symbol);
        const globalKrw =
          globalPriceUsdt !== undefined
            ? globalPriceUsdt * usdtToKrwRateRef.current
            : undefined;
        const korp =
          domestic !== undefined && globalKrw !== undefined
            ? calculateKorP(domestic.price, globalKrw)
            : undefined;
        updatedCoins.set(symbol, {
          ...coin,
          domestic,
          korp,
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

        if (selectedExchange === KRW_EXCHANGE.UPBIT) {
          cleanupDomesticExchange = setupDomesticExchangeConnection(
            "upbit",
            domesticExchangeWorkerUrls.upbit,
            {
              ...baseDeps,
              statusRef: upbitConnectionStatusRef,
              setStatus: setUpbitConnectionStatus,
            },
          );
        } else if (selectedExchange === KRW_EXCHANGE.BITHUMB) {
          cleanupDomesticExchange = setupDomesticExchangeConnection(
            "bithumb",
            domesticExchangeWorkerUrls.bithumb,
            {
              ...baseDeps,
              statusRef: bithumbConnectionStatusRef,
              setStatus: setBithumbConnectionStatus,
            },
          );
        } else if (selectedExchange === KRW_EXCHANGE.COINONE) {
          cleanupDomesticExchange = setupDomesticExchangeConnection(
            "coinone",
            domesticExchangeWorkerUrls.coinone,
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

  const toggleSort = useCallback((key: SortKey) => {
    setSort((prev) => {
      if (prev.mode === "default" || prev.key !== key) {
        return { mode: "custom", key, dir: "asc" };
      }
      if (prev.dir === "asc") {
        return { mode: "custom", key, dir: "desc" };
      }
      return { mode: "default" };
    });
  }, []);

  const toggleNameColumnMode = useCallback(() => {
    setNameColumnMode((m) => (m === "korean" ? "english" : "korean"));
  }, []);

  const filteredCoins = useMemo(() => {
    const q = searchQuery.toLowerCase();
    const coinsArray = Array.from(coins.values());
    const filtered = coinsArray.filter((coin) => {
      const en = getCoinEnglishDisplayName(coin.symbol).toLowerCase();
      return (
        coin.name.toLowerCase().includes(q) ||
        coin.symbol.toLowerCase().includes(q) ||
        en.includes(q)
      );
    });
    return sortDisplayCoins(filtered, sort);
  }, [coins, searchQuery, sort]);

  const sortDataReady = useMemo(
    () => hasStableSortDataForAll(coins.values(), sort),
    [coins, sort],
  );

  useEffect(() => {
    setSortListForceShow(false);
  }, [selectedExchange, sort]);

  useEffect(() => {
    if (sortDataReady) setSortListForceShow(false);
  }, [sortDataReady]);

  useEffect(() => {
    if (!isDomesticReady || sortDataReady) return;
    const id = setTimeout(() => setSortListForceShow(true), 4000);
    return () => clearTimeout(id);
  }, [isDomesticReady, sortDataReady, selectedExchange, sort]);

  const isListDataReady =
    coins.size > 0 && (sortDataReady || sortListForceShow);

  const showRightPanelHeaderSkeleton =
    !isListDataReady || !isDomesticReady;

  const tableCoins = useMemo(
    () =>
      filteredCoins.map((coin) => ({
        symbol: coin.symbol,
        name: coin.name,
        isFavorite: Boolean(favorites[coin.symbol]),
        korp: coin.korp,
        domestic: coin.domestic,
        globalPriceKrw:
          coin.globalPriceUsdt !== undefined
            ? coin.globalPriceUsdt * displayUsdtToKrw
            : undefined,
      })),
    [displayUsdtToKrw, favorites, filteredCoins],
  );

  const onSelectSymbol = useCallback(
    (symbol: string) => {
      setSelectedSymbol(symbol);
      if (isStacked) setMobileChartOpen(true);
    },
    [setSelectedSymbol, isStacked],
  );
  const onToggleFavorite = useCallback(
    (symbol: string) => {
      toggleFavorite(symbol);
    },
    [toggleFavorite],
  );

  return (
    <div className="h-full overflow-hidden bg-background text-foreground">
      <div className="flex h-full w-full min-h-0">
        <div className="flex h-full min-h-0 w-full flex-col gap-0 md:flex-row md:gap-4">
          <aside
            className={`flex w-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background md:w-[462px] md:shrink-0 md:flex-none ${
              mobileChartOpen ? "max-md:hidden" : ""
            } ${mobileChartOpen && isStacked ? "md:hidden" : ""}`}
          >
            <div className="shrink-0 px-3 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="shrink-0 text-[14px] text-gray-500 dark:text-gray-400">
                      {t("market.baseExchange")}
                    </span>
                    <select
                      value={selectedExchange}
                      onChange={(e) =>
                        setSelectedExchangeAndRestoreSymbol(e.target.value)
                      }
                      className="shrink-0 rounded bg-muted px-3 py-2 text-[14px] text-foreground focus:outline-none focus:ring-2 focus:ring-yellow-400"
                    >
                      <option value={KRW_EXCHANGE.UPBIT}>{KRW_EXCHANGE.UPBIT}</option>
                      <option value={KRW_EXCHANGE.BITHUMB}>{KRW_EXCHANGE.BITHUMB}</option>
                      <option value={KRW_EXCHANGE.COINONE}>{KRW_EXCHANGE.COINONE}</option>
                    </select>
                  </div>

                  <div
                    className="mt-1.5 pt-2 text-[14px] leading-snug text-gray-500 dark:text-gray-400"
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

                <span className="shrink-0 text-[14px] text-gray-500 dark:text-gray-400">
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
                    className="w-full rounded bg-muted py-1.5 pl-8 pr-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  />
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                    ⌕
                  </span>
                </div>
              </div>
            </div>

            <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
              <CoinListTable
                t={
                  t as unknown as (
                    key: string,
                    params?: Record<string, string | number>,
                  ) => string
                }
                sort={sort}
                onToggleSort={toggleSort}
                isDomesticReady={isDomesticReady}
                isListDataReady={isListDataReady}
                coins={tableCoins}
                priceFlash={priceFlash}
                onSelect={onSelectSymbol}
                onToggleFavorite={onToggleFavorite}
                nameColumnMode={nameColumnMode}
                onToggleNameColumnMode={toggleNameColumnMode}
                listLayout={isStacked ? "stacked" : "split"}
              />
            </div>
          </aside>

          <MarketRightPanel
            className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden ${
              !mobileChartOpen ? "max-md:hidden" : ""
            } ${!mobileChartOpen && isStacked ? "md:hidden" : ""}`}
            t={
              t as unknown as (
                key: string,
                params?: Record<string, string | number>,
              ) => string
            }
            coins={coins}
            filteredCoins={filteredCoins}
            displayUsdtToKrw={displayUsdtToKrw}
            selectedExchange={selectedExchange}
            nameColumnMode={nameColumnMode}
            showHeaderSkeleton={showRightPanelHeaderSkeleton}
            mobileChartMode={Boolean(isStacked && mobileChartOpen)}
            onMobileBack={
              isStacked && mobileChartOpen
                ? () => setMobileChartOpen(false)
                : undefined
            }
          />
        </div>
      </div>
    </div>
  );
}
