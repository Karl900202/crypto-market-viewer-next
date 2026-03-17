"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { useT } from "@/hooks/useT";
import Loading from "./loading";

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
const calculateKorP = (koreanPrice: number, globalPrice: number): number => {
  return ((koreanPrice - globalPrice) / globalPrice) * 100;
};

export default function MainPage() {
  const t = useT();
  const [coins, setCoins] = useState<Map<string, CoinData>>(new Map());
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedExchange, setSelectedExchange] = useState<string>("빗썸 KRW");
  const [selectedSymbol, setSelectedSymbol] = useState<string>("BTC");
  const hasInitializedSelectedSymbolRef = useRef(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const exchangeLoadingStartTimeRef = useRef<number | null>(null);
  const [showExchangeLoading, setShowExchangeLoading] = useState(false);
  const [isDomesticReady, setIsDomesticReady] = useState(false);
  const isDomesticReadyRef = useRef(false);
  const [priceFlash, setPriceFlash] = useState<
    Map<string, "up" | "down" | null>
  >(new Map());
  const coinsRef = useRef<Map<string, CoinData>>(new Map());
  const koreanExchangePricesRef = useRef<Map<string, number>>(new Map());
  const koreanExchangeChangePercentRef = useRef<Map<string, number>>(new Map());
  const koreanExchangeChangeAmountRef = useRef<Map<string, number>>(new Map());
  const koreanExchangeTradeValueRef = useRef<Map<string, number>>(new Map());
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
          const res = await fetch(
            "https://api.bithumb.com/public/ticker/ALL_KRW",
          );
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
    koreanExchangePricesRef.current.clear();
    koreanExchangeChangePercentRef.current.clear();
    koreanExchangeChangeAmountRef.current.clear();
    koreanExchangeTradeValueRef.current.clear();

    // 거래소 전환 시 이전 거래소 값이 남아 보이는(stale) 현상 방지
    // 국내 거래소 기준 필드는 즉시 초기화하고, 새 데이터 수신 후 채운다.
    const clearedCoins = new Map(coinsRef.current);
    clearedCoins.forEach((coin, symbol) => {
      clearedCoins.set(symbol, {
        ...coin,
        koreanPrice: undefined,
        korp: 0,
        domesticChangePercent: undefined,
        domesticChangeAmount: undefined,
        domesticTradeValueKrw: undefined,
      });
    });
    coinsRef.current = clearedCoins;
    setCoins(clearedCoins);

    let upbitWorker: Worker | null = null;
    let updateInterval: NodeJS.Timeout | null = null;
    let bithumbInterval: NodeJS.Timeout | null = null;
    let upbitFallbackInterval: NodeJS.Timeout | null = null;
    let upbitFallbackTimeout: NodeJS.Timeout | null = null;

    const connectKoreanExchangeWebSocket = () => {
      try {
        if (selectedExchange === "업비트 KRW") {
          hideLoadingAfterMinTime(
            exchangeLoadingStartTimeRef,
            setShowExchangeLoading,
          );

          const markets = upbitMarketsRef.current.filter((m) =>
            m.startsWith("KRW-"),
          );

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
                    tradePrice: number;
                    signedChangeRate: number;
                    signedChangePrice: number;
                    accTradePrice24h: number;
                  };
                }
              | { type: "open" | "close" | "error"; message?: string };

            if (msg.type === "tick") {
              const marketCode = msg.data.market;
              const symbol = marketCode.split("-")[1];
              if (!symbol) return;

              const price = msg.data.tradePrice;
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
          upbitWorker.postMessage({ type: "start", markets });

          // If WS doesn't deliver quickly, fallback to server-proxied REST polling.
          // (Some environments block/alter WS frames.)
          const marketsParam = markets.join(",");
          const fetchFallbackOnce = async () => {
            try {
              const res = await fetch(`/api/upbit?markets=${marketsParam}`);
              if (!res.ok) return;
              const arr = (await res.json()) as UpbitTicker[];
              for (const item of arr) {
                const marketCode = item.market ?? item.code;
                if (!marketCode) continue;
                const symbol = marketCode.split("-")[1];
                if (!symbol) continue;
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
              setIsDomesticReady(true);
              isDomesticReadyRef.current = true;
            } catch {
              // ignore
            }
          };

          upbitFallbackTimeout = setTimeout(() => {
            if (!isDomesticReadyRef.current) {
              fetchFallbackOnce();
              upbitFallbackInterval = setInterval(fetchFallbackOnce, 1000);
            }
          }, 1500);
        } else if (selectedExchange === "빗썸 KRW") {
          // 빗썸은 WebSocket이 없으므로 REST API 폴링
          const fetchBithumbData = async () => {
            try {
              const response = await fetch(
                "https://api.bithumb.com/public/ticker/ALL_KRW",
              );
              if (response.ok) {
                const data = await response.json();
                if (data.status === "0000" && data.data) {
                  const tickers = data.data as Record<string, BithumbTicker>;
                  for (const [symbol, ticker] of Object.entries(tickers)) {
                    if (symbol === "date") continue;
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
                  hideLoadingAfterMinTime(
                    exchangeLoadingStartTimeRef,
                    setShowExchangeLoading,
                  );
                  setIsDomesticReady(true);
                  isDomesticReadyRef.current = true;
                }
              }
            } catch (error) {
              console.error("Error fetching Bithumb data:", error);
              hideLoadingAfterMinTime(
                exchangeLoadingStartTimeRef,
                setShowExchangeLoading,
              );
            }
          };

          fetchBithumbData();
          bithumbInterval = setInterval(fetchBithumbData, 500);
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
      if (bithumbInterval) {
        clearInterval(bithumbInterval);
      }
      if (upbitFallbackInterval) {
        clearInterval(upbitFallbackInterval);
      }
      if (upbitFallbackTimeout) {
        clearTimeout(upbitFallbackTimeout);
      }
      if (upbitWorker) {
        try {
          upbitWorker.postMessage({ type: "stop" });
        } catch {}
        upbitWorker.terminate();
      }
    };
  }, [selectedExchange, usdtToKrwRateRef]);

  const coinsArray = Array.from(coins.values()).sort(
    (a, b) => (b.domesticTradeValueKrw ?? 0) - (a.domesticTradeValueKrw ?? 0),
  );

  const filteredCoins = coinsArray.filter(
    (coin) =>
      coin.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      coin.symbol.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const formatPrice = (price: number) => {
    return price.toLocaleString("ko-KR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  };

  const formatTradeValueInMillionsKrw = (valueKrw: number) => {
    const millions = Math.round(valueKrw / 1_000_000);
    return `${millions.toLocaleString("ko-KR")}백만`;
  };

  // 첫 로딩 시에만 loading.tsx 표시
  if (isInitialLoading) {
    return <Loading />;
  }

  const selectedCoin = coins.get(selectedSymbol) ?? filteredCoins[0];
  const selectedCoinSymbol = selectedCoin?.symbol ?? "BTC";

  const SkeletonRow = ({ keyProp }: { keyProp: number }) => (
    <div
      key={keyProp}
      className="px-2 py-2.5 border-b border-gray-100 dark:border-gray-800"
    >
      <div className="grid grid-cols-[minmax(0,1fr)_52px_88px_64px_64px] gap-1.5 items-center">
        <div className="min-w-0">
          <div className="h-3 w-28 bg-gray-200 dark:bg-gray-700 rounded animate-skeleton" />
          <div className="mt-1 h-2.5 w-12 bg-gray-200 dark:bg-gray-700 rounded animate-skeleton" />
        </div>
        <div className="h-3 w-10 ml-auto bg-gray-200 dark:bg-gray-700 rounded animate-skeleton" />
        <div className="h-3 w-16 ml-auto bg-gray-200 dark:bg-gray-700 rounded animate-skeleton" />
        <div className="h-3 w-12 ml-auto bg-gray-200 dark:bg-gray-700 rounded animate-skeleton" />
        <div className="h-3 w-14 ml-auto bg-gray-200 dark:bg-gray-700 rounded animate-skeleton" />
      </div>
    </div>
  );

  return (
    <div className="h-full bg-white dark:bg-gray-900 text-gray-900 dark:text-white overflow-hidden">
      <div className="mx-auto max-w-[1600px] px-2 py-2 h-full">
        <div className="flex gap-2 h-full">
          {/* Left: market list (Upbit/Bithumb-like) */}
          <aside className="w-[440px] shrink-0 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden flex flex-col min-h-0">
            <div className="border-b border-gray-200 dark:border-gray-800 p-2 shrink-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs text-gray-600 dark:text-gray-400 shrink-0">
                      {t("market.baseExchange")}
                    </span>
                    <select
                      value={selectedExchange}
                      onChange={(e) => setSelectedExchange(e.target.value)}
                      className="bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white px-2 py-1 rounded border border-gray-200 dark:border-gray-700 text-xs shrink-0"
                    >
                      <option value="빗썸 KRW">빗썸 KRW</option>
                      <option value="업비트 KRW">업비트 KRW</option>
                    </select>
                  </div>

                  <div
                    className="mt-1 text-xs text-gray-600 dark:text-gray-400 leading-tight"
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

                <span className="text-xs text-gray-600 dark:text-gray-400 shrink-0">
                  {t("market.totalCoins", { count: coins.size })}
                </span>
              </div>

              <div className="mt-2 flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder={t("market.searchPlaceholder")}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white pl-8 pr-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 focus:outline-none focus:border-yellow-400 text-sm"
                  />
                  <span className="absolute left-3 top-2 text-gray-400 text-sm">
                    ⌕
                  </span>
                </div>
              </div>
            </div>

            <div className="relative flex-1 min-h-0 overflow-hidden flex flex-col">
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

              <div className="grid grid-cols-[minmax(0,1fr)_52px_88px_64px_64px] gap-1.5 px-2 py-2 text-[10px] text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800 overflow-x-hidden">
                <div>{t("table.name")}</div>
                <div className="text-right">{t("table.korp")}</div>
                <div className="text-right">{t("table.price")}</div>
                <div className="text-right">{t("table.change24h")}</div>
                <div className="text-right">{t("table.volume24h")}</div>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden modern-scrollbar">
                {!isDomesticReady ? (
                  <div>
                    {Array.from({ length: 12 }).map((_, i) => (
                      <SkeletonRow key={i} keyProp={i} />
                    ))}
                  </div>
                ) : (
                  filteredCoins.map((coin) => {
                    const isSelected = coin.symbol === selectedCoinSymbol;
                    const domPrice = coin.koreanPrice;
                    const globalKrw =
                      coin.globalPriceUsdt !== undefined
                        ? coin.globalPriceUsdt * usdtToKrwRateRef.current
                        : undefined;

                    return (
                      <button
                        key={coin.symbol}
                        type="button"
                        onClick={() => setSelectedSymbol(coin.symbol)}
                        className={`w-full text-left px-2 py-2.5 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors overflow-hidden ${
                          isSelected
                            ? "bg-yellow-50/60 dark:bg-yellow-400/10"
                            : ""
                        }`}
                      >
                        <div className="grid grid-cols-[minmax(0,1fr)_52px_88px_64px_64px] gap-1.5 items-center">
                          <div className="min-w-0 text-left">
                            <div className="text-[13px] font-medium whitespace-normal break-words leading-snug">
                              {coin.name}
                            </div>
                            <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                              {coin.symbol}
                            </div>
                          </div>

                          <div className="text-right tabular-nums">
                            {coin.korp !== undefined ? (
                              <div>
                                <div
                                  className={`text-[13px] font-semibold ${
                                    coin.korp >= 0
                                      ? "text-green-600 dark:text-green-400"
                                      : "text-red-600 dark:text-red-400"
                                  }`}
                                >
                                  {coin.korp >= 0 ? "+" : ""}
                                  {coin.korp.toFixed(2)}%
                                </div>
                                <div className="text-[10px] text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                  {coin.koreanPrice !== undefined &&
                                  globalKrw !== undefined ? (
                                    (() => {
                                      const diff = coin.koreanPrice - globalKrw;
                                      return `${diff >= 0 ? "+" : "-"}${formatPrice(
                                        Math.abs(diff),
                                      )}`;
                                    })()
                                  ) : (
                                    <span>-</span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="text-[13px] font-semibold text-gray-500 dark:text-gray-400">
                                -
                              </div>
                            )}
                          </div>

                          <div
                            className={`text-right tabular-nums ${
                              priceFlash.get(coin.symbol) === "up"
                                ? "animate-flash-green"
                                : priceFlash.get(coin.symbol) === "down"
                                  ? "animate-flash-red"
                                  : ""
                            }`}
                          >
                            <div className="text-[13px] font-semibold">
                              {domPrice ? formatPrice(domPrice) : "-"}
                            </div>
                            <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                              {globalKrw !== undefined
                                ? formatPrice(globalKrw)
                                : "-"}
                            </div>
                          </div>

                          <div
                            className={`text-right tabular-nums font-semibold ${
                              (coin.domesticChangePercent ?? 0) >= 0
                                ? "text-green-600 dark:text-green-400"
                                : "text-red-600 dark:text-red-400"
                            }`}
                          >
                            <div className="text-[13px]">
                              {coin.domesticChangePercent !== undefined
                                ? `${coin.domesticChangePercent >= 0 ? "+" : ""}${coin.domesticChangePercent.toFixed(2)}%`
                                : "-"}
                            </div>
                            <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                              {coin.domesticChangeAmount !== undefined
                                ? `${coin.domesticChangeAmount >= 0 ? "+" : "-"}${formatPrice(
                                    Math.abs(coin.domesticChangeAmount),
                                  )}`
                                : "-"}
                            </div>
                          </div>

                          <div className="text-right tabular-nums">
                            <div className="text-[13px] font-semibold whitespace-nowrap">
                              {coin.domesticTradeValueKrw !== undefined
                                ? formatTradeValueInMillionsKrw(
                                    coin.domesticTradeValueKrw,
                                  )
                                : "-"}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </aside>

          {/* Right: chart area placeholder */}
          <main className="flex-1 min-w-0 min-h-0">
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden h-full flex flex-col min-h-0">
              <div className="border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center justify-between gap-4 shrink-0">
                <div className="min-w-0">
                  <div className="font-semibold truncate">
                    {selectedCoin?.name ?? selectedCoinSymbol}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 truncate">
                    {selectedCoinSymbol}/KRW · {t("market.binanceUsdtMarket")}{" "}
                    KRW 환산
                  </div>
                </div>
                <div className="text-right tabular-nums">
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {selectedExchange.replace(" KRW", "")} / GLOBAL
                  </div>
                  <div className="font-semibold">
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

              <div className="p-4 flex-1 min-h-0">
                <div className="h-full rounded-xl border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-gray-700 dark:text-gray-200 font-medium">
                      {t("chart.placeholderTitle")}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
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
