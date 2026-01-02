"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import Loading from "./loading";

interface CoinData {
  symbol: string;
  name: string;
  price: number;
  priceChange: number;
  priceChangePercent: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  koreanPrice?: number;
  kimchiPremium?: number;
}

interface BinanceTicker24hr {
  symbol: string;
  lastPrice: string;
  priceChange: string;
  priceChangePercent: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
}

interface BinanceWebSocketTicker {
  s: string; // symbol
  c: string; // last price
  P: string; // price change percent
  h: string; // high price
  l: string; // low price
  v: string; // volume
}

interface BithumbTicker {
  opening_price: string; // 시가
  closing_price: string; // 종가 (현재가)
  min_price: string; // 저가
  max_price: string; // 고가
  units_traded: string; // 거래량
  acc_trade_value: string; // 거래금액
  prev_closing_price: string; // 전일종가
  fluctate_24H: string; // 24시간 변동금액
  fluctate_rate_24H: string; // 24시간 변동률
}

interface UpbitTicker {
  market: string;
  trade_price: number;
  trade_volume: number;
  high_price: number;
  low_price: number;
  prev_closing_price: number;
  change: string;
  change_price: number;
  change_rate: number;
}

export default function MainPage() {
  const [coins, setCoins] = useState<Map<string, CoinData>>(new Map());
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedExchange, setSelectedExchange] = useState<string>("빗썸 KRW");
  const [selectedMarket, setSelectedMarket] = useState("바이낸스 USDT 마켓");
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const exchangeLoadingStartTimeRef = useRef<number | null>(null);
  const [showExchangeLoading, setShowExchangeLoading] = useState(false);
  const [priceFlash, setPriceFlash] = useState<
    Map<string, "up" | "down" | null>
  >(new Map());
  const prevPricesRef = useRef<Map<string, number>>(new Map());
  // WebSocket 데이터를 ref에 누적
  const coinsRef = useRef<Map<string, CoinData>>(new Map());
  // 한국 거래소 데이터를 ref에 누적 (심볼 -> 가격 매핑)
  const koreanExchangePricesRef = useRef<Map<string, number>>(new Map());

  // 환율 변경 콜백 메모이제이션
  const handleRateChange = useCallback((newRate: number) => {
    // 환율이 변경될 때만 모든 코인의 koreanPrice 업데이트
    setCoins((prevCoins) => {
      const updatedCoins = new Map(prevCoins);
      prevCoins.forEach((coin, symbol) => {
        updatedCoins.set(symbol, {
          ...coin,
          koreanPrice: coin.price * newRate,
        });
      });
      return updatedCoins;
    });
  }, []);

  // 실시간 환율 가져오기 (10초 마다 업데이트, useRef 사용)
  const usdtToKrwRateRef = useExchangeRate(10 * 1000, 1400, handleRateChange);

  const coinMap: { [key: string]: string } = {
    BTCUSDT: "비트코인",
    ETHUSDT: "이더리움",
    XRPUSDT: "엑스알피 [리플]",
    SOLUSDT: "솔라나",
    BNBUSDT: "바이낸스코인",
    ADAUSDT: "에이다",
    DOGEUSDT: "도지코인",
    DOTUSDT: "폴카닷",
    AVAXUSDT: "아발란체",
  };

  // Binance 심볼 -> 한국 거래소 심볼 매핑
  const exchangeSymbolMap: {
    [key: string]: { [exchange: string]: string };
  } = {
    BTCUSDT: { 빗썸: "BTC", 업비트: "KRW-BTC" },
    ETHUSDT: { 빗썸: "ETH", 업비트: "KRW-ETH" },
    XRPUSDT: { 빗썸: "XRP", 업비트: "KRW-XRP" },
    SOLUSDT: { 빗썸: "SOL", 업비트: "KRW-SOL" },
    BNBUSDT: { 빗썸: "BNB", 업비트: "KRW-BNB" },
    ADAUSDT: { 빗썸: "ADA", 업비트: "KRW-ADA" },
    DOGEUSDT: { 빗썸: "DOGE", 업비트: "KRW-DOGE" },
    DOTUSDT: { 빗썸: "DOT", 업비트: "KRW-DOT" },
    AVAXUSDT: { 빗썸: "AVAX", 업비트: "KRW-AVAX" },
  };

  const majorCoins = [
    "BTCUSDT",
    "ETHUSDT",
    "XRPUSDT",
    "SOLUSDT",
    "BNBUSDT",
    "ADAUSDT",
    "DOGEUSDT",
    "DOTUSDT",
    "AVAXUSDT",
  ];

  // Binance WebSocket은 항상 연결 유지
  useEffect(() => {
    const streams = majorCoins
      .map((coin) => `${coin.toLowerCase()}@ticker`)
      .join("/");
    const ws = new WebSocket(
      `wss://stream.binance.com:9443/stream?streams=${streams}`
    );

    ws.onopen = () => {
      console.log("Binance WebSocket connected");
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as {
          data: BinanceWebSocketTicker;
        };
        const ticker = message.data;

        const symbol = ticker.s.replace("USDT", "");
        const price = parseFloat(ticker.c);
        const prevPrice = prevPricesRef.current.get(symbol);

        // 가격 변동 감지 및 깜빡임 효과
        if (prevPrice !== undefined && prevPrice !== price) {
          const direction = price > prevPrice ? "up" : "down";
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

        prevPricesRef.current.set(symbol, price);

        const priceChange = parseFloat(ticker.P);
        const priceChangePercent = parseFloat(ticker.P);
        const high24h = parseFloat(ticker.h);
        const low24h = parseFloat(ticker.l);
        const volume24h = parseFloat(ticker.v);

        const koreanPrice =
          koreanExchangePricesRef.current.get(symbol) ||
          price * usdtToKrwRateRef.current;

        const usdPrice = price * usdtToKrwRateRef.current;
        const kimchiPremium = koreanExchangePricesRef.current.get(symbol)
          ? ((koreanExchangePricesRef.current.get(symbol)! - usdPrice) /
              usdPrice) *
            100
          : 0;

        coinsRef.current.set(symbol, {
          symbol: symbol,
          name: coinMap[ticker.s] || symbol,
          price: price,
          priceChange: priceChange,
          priceChangePercent: priceChangePercent,
          high24h: high24h,
          low24h: low24h,
          volume24h: volume24h,
          koreanPrice: koreanPrice,
          kimchiPremium: kimchiPremium,
        });
      } catch (error) {
        console.error("Error parsing Binance WebSocket data:", error);
      }
    };

    ws.onerror = (error) => {
      console.error("Binance WebSocket error:", error);
    };

    ws.onclose = () => {
      console.log("Binance WebSocket disconnected");
    };

    return () => {
      ws.close();
    };
  }, []);

  // 초기 데이터 로드
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setIsInitialLoading(true);

        // Binance 데이터 가져오기
        const promises = majorCoins.map(async (symbol) => {
          try {
            const response = await fetch(`/api/binance?symbol=${symbol}`);
            if (!response.ok) {
              throw new Error(`Failed to fetch ${symbol}`);
            }
            return await response.json();
          } catch (error) {
            console.error(`Error fetching ${symbol}:`, error);
            return null;
          }
        });

        // 빗썸 초기 데이터 가져오기
        let bithumbData: { [key: string]: BithumbTicker } = {};
        try {
          const bithumbResponse = await fetch(
            "https://api.bithumb.com/public/ticker/ALL_KRW"
          );
          if (bithumbResponse.ok) {
            const data = await bithumbResponse.json();
            if (data.status === "0000" && data.data) {
              bithumbData = data.data;
              // 빗썸 데이터를 ref에 저장
              Object.entries(exchangeSymbolMap).forEach(
                ([binanceSymbol, symbolMap]) => {
                  const bithumbSymbol = symbolMap["빗썸"];
                  const ticker = bithumbData[bithumbSymbol] as
                    | BithumbTicker
                    | undefined;
                  if (ticker) {
                    const price = parseFloat(ticker.closing_price);
                    koreanExchangePricesRef.current.set(
                      binanceSymbol.replace("USDT", ""),
                      price
                    );
                  }
                }
              );
            }
          }
        } catch (error) {
          console.error("Error fetching initial Bithumb data:", error);
        }

        const dataArray = await Promise.all(promises);
        const initialCoins = new Map<string, CoinData>();

        dataArray.forEach((ticker: BinanceTicker24hr | null) => {
          if (!ticker) return;

          const price = parseFloat(ticker.lastPrice);
          const priceChange = parseFloat(ticker.priceChange);
          const priceChangePercent = parseFloat(ticker.priceChangePercent);
          const high24h = parseFloat(ticker.highPrice);
          const low24h = parseFloat(ticker.lowPrice);
          const volume24h = parseFloat(ticker.volume);

          const symbol = ticker.symbol.replace("USDT", "");
          prevPricesRef.current.set(symbol, price);

          // 빗썸 가격 가져오기
          const bithumbSymbol = exchangeSymbolMap[ticker.symbol]?.["빗썸"];
          const bithumbTicker = bithumbSymbol
            ? bithumbData[bithumbSymbol]
            : null;
          const koreanPrice = bithumbTicker
            ? parseFloat(bithumbTicker.closing_price)
            : price * usdtToKrwRateRef.current;

          // 김프 계산
          const usdPrice = price * usdtToKrwRateRef.current;
          const kimchiPremium = bithumbTicker
            ? ((koreanPrice - usdPrice) / usdPrice) * 100
            : 0;

          initialCoins.set(symbol, {
            symbol: symbol,
            name: coinMap[ticker.symbol] || symbol,
            price: price,
            priceChange: priceChange,
            priceChangePercent: priceChangePercent,
            high24h: high24h,
            low24h: low24h,
            volume24h: volume24h,
            koreanPrice: koreanPrice,
            kimchiPremium: kimchiPremium,
          });
        });

        setCoins(initialCoins);
        coinsRef.current = new Map(initialCoins);
        setIsInitialLoading(false);
      } catch (error) {
        console.error("Error fetching initial data:", error);
        setIsInitialLoading(false);
      }
    };

    fetchInitialData();
  }, []);

  // 거래소별 WebSocket 연결 및 데이터 업데이트
  useEffect(() => {
    // 로딩 시작
    exchangeLoadingStartTimeRef.current = Date.now();
    setShowExchangeLoading(true);
    koreanExchangePricesRef.current.clear();

    let koreanWs: WebSocket | null = null;
    let updateInterval: NodeJS.Timeout | null = null;

    const connectKoreanExchangeWebSocket = () => {
      try {
        if (selectedExchange === "업비트 KRW") {
          const wsUrl = "wss://api.upbit.com/websocket/v1";
          koreanWs = new WebSocket(wsUrl);

          koreanWs.onopen = () => {
            console.log("Upbit WebSocket connected");
            // 최소 0.2초 후에 로딩 숨기기
            const elapsed =
              Date.now() - (exchangeLoadingStartTimeRef.current || 0);
            const remaining = Math.max(0, 200 - elapsed);
            setTimeout(() => {
              setShowExchangeLoading(false);
            }, remaining);

            const markets = Object.values(exchangeSymbolMap)
              .map((map) => map["업비트"])
              .filter((market) => market.startsWith("KRW-"));

            const subscribeMessage = JSON.stringify([
              { ticket: "crypto-market-viewer" },
              {
                type: "ticker",
                codes: markets,
              },
            ]);

            koreanWs?.send(subscribeMessage);
          };

          koreanWs.onmessage = (event) => {
            try {
              if (event.data instanceof Blob) {
                const reader = new FileReader();
                reader.onload = () => {
                  try {
                    const data = JSON.parse(
                      reader.result as string
                    ) as UpbitTicker;
                    const market = data.market;

                    Object.entries(exchangeSymbolMap).forEach(
                      ([binanceSymbol, symbolMap]) => {
                        if (symbolMap["업비트"] === market) {
                          const symbol = binanceSymbol.replace("USDT", "");
                          const price = data.trade_price;
                          const prevPrice =
                            koreanExchangePricesRef.current.get(symbol);

                          if (prevPrice !== undefined && prevPrice !== price) {
                            const direction = price > prevPrice ? "up" : "down";
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

                          koreanExchangePricesRef.current.set(symbol, price);
                        }
                      }
                    );
                  } catch (error) {
                    console.error("Error parsing Upbit WebSocket data:", error);
                  }
                };
                reader.readAsText(event.data);
              }
            } catch (error) {
              console.error("Error processing Upbit WebSocket message:", error);
            }
          };

          koreanWs.onerror = (error) => {
            console.error("Upbit WebSocket error:", error);
            // 최소 0.2초 후에 로딩 숨기기
            const elapsed =
              Date.now() - (exchangeLoadingStartTimeRef.current || 0);
            const remaining = Math.max(0, 200 - elapsed);
            setTimeout(() => {
              setShowExchangeLoading(false);
            }, remaining);
          };

          koreanWs.onclose = () => {
            console.log("Upbit WebSocket disconnected");
          };
        } else if (selectedExchange === "빗썸 KRW") {
          // 빗썸은 WebSocket이 없으므로 REST API 폴링
          const fetchBithumbData = async () => {
            try {
              const response = await fetch(
                "https://api.bithumb.com/public/ticker/ALL_KRW"
              );
              if (response.ok) {
                const data = await response.json();
                if (data.status === "0000" && data.data) {
                  Object.entries(exchangeSymbolMap).forEach(
                    ([binanceSymbol, symbolMap]) => {
                      const bithumbSymbol = symbolMap["빗썸"];
                      const ticker = data.data[bithumbSymbol] as
                        | BithumbTicker
                        | undefined;
                      if (ticker) {
                        const symbol = binanceSymbol.replace("USDT", "");
                        const price = parseFloat(ticker.closing_price);
                        const prevPrice =
                          koreanExchangePricesRef.current.get(symbol);

                        if (prevPrice !== undefined && prevPrice !== price) {
                          const direction = price > prevPrice ? "up" : "down";
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

                        koreanExchangePricesRef.current.set(symbol, price);
                      }
                    }
                  );
                  // 최소 0.2초 후에 로딩 숨기기
                  const elapsed =
                    Date.now() - (exchangeLoadingStartTimeRef.current || 0);
                  const remaining = Math.max(0, 200 - elapsed);
                  setTimeout(() => {
                    setShowExchangeLoading(false);
                    setShowExchangeLoading(false);
                  }, remaining);
                }
              }
            } catch (error) {
              console.error("Error fetching Bithumb data:", error);
              // 최소 0.2초 후에 로딩 숨기기
              const elapsed =
                Date.now() - (exchangeLoadingStartTimeRef.current || 0);
              const remaining = Math.max(0, 200 - elapsed);
              setTimeout(() => {
                setShowExchangeLoading(false);
                setShowExchangeLoading(false);
              }, remaining);
            }
          };

          fetchBithumbData();
          const bithumbInterval = setInterval(fetchBithumbData, 500);

          return () => {
            clearInterval(bithumbInterval);
          };
        }
      } catch (error) {
        console.error("Korean Exchange WebSocket 연결 실패:", error);
        // 최소 0.2초 후에 로딩 숨기기
        const elapsed = Date.now() - (exchangeLoadingStartTimeRef.current || 0);
        const remaining = Math.max(0, 200 - elapsed);
        setTimeout(() => {
          setShowExchangeLoading(false);
        }, remaining);
      }
    };

    connectKoreanExchangeWebSocket();

    // 500ms마다 ref의 데이터를 state로 업데이트
    updateInterval = setInterval(() => {
      const updatedCoins = new Map(coinsRef.current);
      updatedCoins.forEach((coin, symbol) => {
        const koreanPrice = koreanExchangePricesRef.current.get(symbol);
        const binancePrice = coin.price;

        if (koreanPrice) {
          const usdPrice = binancePrice * usdtToKrwRateRef.current;
          const kimchiPremium = ((koreanPrice - usdPrice) / usdPrice) * 100;

          updatedCoins.set(symbol, {
            ...coin,
            koreanPrice: koreanPrice,
            kimchiPremium: kimchiPremium,
          });
        }
      });
      setCoins(updatedCoins);
    }, 500);

    return () => {
      if (updateInterval) {
        clearInterval(updateInterval);
      }
      if (koreanWs) {
        koreanWs.close();
      }
    };
  }, [selectedExchange]);

  const coinsArray = Array.from(coins.values()).sort(
    (a, b) => b.volume24h - a.volume24h
  );

  const filteredCoins = coinsArray.filter(
    (coin) =>
      coin.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      coin.symbol.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatPrice = (price: number) => {
    return price.toLocaleString("ko-KR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  };

  const formatVolume = (volume: number) => {
    if (volume >= 1000000000000) {
      return `${(volume / 1000000000000).toFixed(2)}조`;
    } else if (volume >= 100000000) {
      return `${(volume / 100000000).toFixed(0)}억`;
    }
    return volume.toLocaleString("ko-KR");
  };

  // 첫 로딩 시에만 loading.tsx 표시
  if (isInitialLoading) {
    return <Loading />;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Exchange Selection Bar */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <label className="text-gray-400 text-sm">기준 거래소</label>
                <select
                  value={selectedExchange}
                  onChange={(e) => setSelectedExchange(e.target.value)}
                  className="bg-gray-700 text-white px-3 py-1 rounded border border-gray-600"
                >
                  <option value="빗썸 KRW">빗썸 KRW</option>
                  <option value="업비트 KRW">업비트 KRW</option>
                </select>
              </div>

              <div className="text-gray-500">⇄</div>

              <div className="flex items-center space-x-2">
                <label className="text-gray-400 text-sm">
                  바이낸스 USDT 마켓
                </label>
                <select
                  value={selectedMarket}
                  onChange={(e) => setSelectedMarket(e.target.value)}
                  className="bg-gray-700 text-white px-3 py-1 rounded border border-gray-600"
                >
                  <option value="바이낸스 USDT 마켓">바이낸스 USDT 마켓</option>
                  <option value="바이낸스 BUSD 마켓">바이낸스 BUSD 마켓</option>
                </select>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-gray-400 text-sm">
                암호화폐 총 {coins.size}개
              </span>
              <input
                type="text"
                placeholder="Q BTC, 비트코인"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-gray-700 text-white px-4 py-2 rounded border border-gray-600 focus:outline-none focus:border-yellow-400"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Coin Table */}
      <div className="container mx-auto px-4 py-6">
        <div className="overflow-x-auto relative">
          {/* Exchange Loading Overlay */}
          {showExchangeLoading && (
            <div className="absolute inset-0 bg-gray-900 bg-opacity-75 backdrop-blur-sm flex items-center justify-center z-10">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-400 mb-4"></div>
                <p className="text-white text-lg">
                  {selectedExchange.replace(" KRW", "")} 거래소 데이터 로딩
                  중...
                </p>
              </div>
            </div>
          )}
          <table className="w-full table-fixed min-w-[1200px]">
            <colgroup>
              <col className="w-[200px]" />
              <col className="w-[180px]" />
              <col className="w-[120px]" />
              <col className="w-[150px]" />
              <col className="w-[180px]" />
              <col className="w-[180px]" />
              <col className="w-[150px]" />
            </colgroup>
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-3 px-4 text-gray-400 font-normal">
                  이름
                </th>
                <th className="text-right py-3 px-4 text-gray-400 font-normal">
                  현재가
                </th>
                <th className="text-right py-3 px-4 text-gray-400 font-normal">
                  김프
                </th>
                <th className="text-right py-3 px-4 text-gray-400 font-normal">
                  전일대비
                </th>
                <th className="text-right py-3 px-4 text-gray-400 font-normal">
                  고가대비(전일)
                </th>
                <th className="text-right py-3 px-4 text-gray-400 font-normal">
                  저가대비(전일)
                </th>
                <th className="text-right py-3 px-4 text-gray-400 font-normal">
                  거래액(일)
                </th>
              </tr>
            </thead>
            <tbody>
              {isInitialLoading
                ? // 첫 로딩 시에만 스켈레톤 표시 (Next.js loading.tsx에서 처리)
                  null
                : filteredCoins.map((coin) => {
                    const highDiff =
                      ((coin.price - coin.high24h) / coin.high24h) * 100;
                    const lowDiff =
                      ((coin.price - coin.low24h) / coin.low24h) * 100;

                    return (
                      <tr
                        key={coin.symbol}
                        className="border-b border-gray-800 hover:bg-gray-800 transition-colors animate-fade-in"
                      >
                        <td className="py-3 px-4 overflow-hidden">
                          <div className="truncate">
                            <div className="font-medium truncate">
                              {coin.name}
                            </div>
                            <div className="text-sm text-gray-400 truncate">
                              {coin.symbol}
                            </div>
                          </div>
                        </td>
                        <td className="text-right py-3 px-4 overflow-hidden">
                          <div className="truncate">
                            <div
                              className={`flex items-center justify-between ${
                                priceFlash.get(coin.symbol) === "up"
                                  ? "animate-flash-green"
                                  : priceFlash.get(coin.symbol) === "down"
                                  ? "animate-flash-red"
                                  : ""
                              }`}
                            >
                              {coin.koreanPrice ? (
                                <>
                                  <span className="text-xs text-gray-500">
                                    {selectedExchange.replace(" KRW", "")}
                                  </span>
                                  <span>{formatPrice(coin.koreanPrice)}</span>
                                </>
                              ) : (
                                <span>-</span>
                              )}
                            </div>
                            <div
                              className={`flex items-center justify-between text-sm text-gray-400 ${
                                priceFlash.get(coin.symbol) === "up"
                                  ? "animate-flash-green"
                                  : priceFlash.get(coin.symbol) === "down"
                                  ? "animate-flash-red"
                                  : ""
                              }`}
                            >
                              <span className="text-xs text-gray-500">
                                GLOBAL
                              </span>
                              <span>
                                {formatPrice(
                                  coin.price * usdtToKrwRateRef.current
                                )}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="text-right py-3 px-4 overflow-hidden">
                          <div
                            className={`truncate ${
                              coin.kimchiPremium !== undefined &&
                              coin.kimchiPremium >= 0
                                ? "text-green-400"
                                : "text-red-400"
                            }`}
                          >
                            {coin.kimchiPremium !== undefined
                              ? `${
                                  coin.kimchiPremium >= 0 ? "+" : ""
                                }${coin.kimchiPremium.toFixed(2)}%`
                              : "-"}
                          </div>
                        </td>
                        <td className="text-right py-3 px-4 overflow-hidden">
                          <div
                            className={`truncate ${
                              coin.priceChangePercent >= 0
                                ? "text-green-400"
                                : "text-red-400"
                            }`}
                          >
                            <div className="truncate">
                              {coin.priceChangePercent >= 0 ? "+" : ""}
                              {coin.priceChangePercent.toFixed(2)}%
                            </div>
                            <div className="text-sm truncate">
                              {coin.priceChange >= 0 ? "+" : ""}
                              {formatPrice(coin.priceChange)}
                            </div>
                          </div>
                        </td>
                        <td className="text-right py-3 px-4 overflow-hidden">
                          <div
                            className={`truncate ${
                              highDiff >= 0 ? "text-green-400" : "text-red-400"
                            }`}
                          >
                            <div className="truncate">
                              {highDiff >= 0 ? "+" : ""}
                              {highDiff.toFixed(2)}%
                            </div>
                            <div className="text-sm text-gray-400 truncate">
                              {formatPrice(coin.high24h)}
                            </div>
                          </div>
                        </td>
                        <td className="text-right py-3 px-4 overflow-hidden">
                          <div
                            className={`truncate ${
                              lowDiff >= 0 ? "text-green-400" : "text-red-400"
                            }`}
                          >
                            <div className="truncate">
                              {lowDiff >= 0 ? "+" : ""}
                              {lowDiff.toFixed(2)}%
                            </div>
                            <div className="text-sm text-gray-400 truncate">
                              {formatPrice(coin.low24h)}
                            </div>
                          </div>
                        </td>
                        <td className="text-right py-3 px-4 overflow-hidden">
                          <div className="truncate">
                            {formatVolume(coin.volume24h)}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
