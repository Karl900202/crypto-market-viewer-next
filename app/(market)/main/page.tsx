"use client";

import { useEffect, useState, useRef } from "react";
import { useExchangeRate } from "@/hooks/useExchangeRate";

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

export default function MainPage() {
  const [coins, setCoins] = useState<Map<string, CoinData>>(new Map());
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedExchange, setSelectedExchange] = useState("빗썸 KRW");
  const [selectedMarket, setSelectedMarket] = useState("바이낸스 USDT 마켓");
  const [priceFlash, setPriceFlash] = useState<
    Map<string, "up" | "down" | null>
  >(new Map());
  const prevPricesRef = useRef<Map<string, number>>(new Map());

  // 실시간 환율 가져오기 (1분마다 업데이트)
  const usdtToKrwRate = useExchangeRate(60 * 1000, 1350);

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

  useEffect(() => {
    // 초기 데이터는 Next.js API 라우트를 통해 가져오기 (CORS 문제 해결)
    const fetchInitialData = async () => {
      try {
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

        const dataArray = await Promise.all(promises);
        const initialCoins = new Map<string, CoinData>();

        dataArray.forEach((ticker: any) => {
          if (!ticker) return;

          const price = parseFloat(ticker.lastPrice);
          const priceChange = parseFloat(ticker.priceChange);
          const priceChangePercent = parseFloat(ticker.priceChangePercent);
          const high24h = parseFloat(ticker.highPrice);
          const low24h = parseFloat(ticker.lowPrice);
          const volume24h = parseFloat(ticker.volume);

          const koreanPrice = price * usdtToKrwRate;
          // 김프 계산: 실제로는 한국 거래소 가격을 가져와서 비교해야 함
          // 현재는 예시로 0%로 설정 (한국 거래소 API 연동 필요)
          const kimchiPremium = 0;

          const symbol = ticker.symbol.replace("USDT", "");

          // 초기 가격을 이전 가격으로 설정
          prevPricesRef.current.set(symbol, price);

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
      } catch (error) {
        console.error("Error fetching initial data:", error);
      }
    };

    fetchInitialData();

    // WebSocket으로 개별 코인 업데이트 받기
    const streams = majorCoins
      .map((coin) => `${coin.toLowerCase()}@ticker`)
      .join("/");
    const ws = new WebSocket(
      `wss://stream.binance.com:9443/stream?streams=${streams}`
    );

    ws.onopen = () => {
      console.log("WebSocket connected");
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        const ticker = message.data;

        // 해당 코인만 업데이트
        setCoins((prevCoins) => {
          const updatedCoins = new Map(prevCoins);
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

            // 500ms 후 깜빡임 효과 제거
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

          const koreanPrice = price * usdtToKrwRate;
          // 김프 계산: 실제로는 한국 거래소 가격을 가져와서 비교해야 함
          // 현재는 예시로 0%로 설정 (한국 거래소 API 연동 필요)
          const kimchiPremium = 0;

          updatedCoins.set(symbol, {
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

          return updatedCoins;
        });
      } catch (error) {
        console.error("Error parsing WebSocket data:", error);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    ws.onclose = () => {
      console.log("WebSocket disconnected");
    };

    return () => {
      ws.close();
    };
  }, []);

  const coinsArray = Array.from(coins.values()).sort(
    (a, b) => b.volume24h - a.volume24h
  );

  const filteredCoins = coinsArray.filter(
    (coin) =>
      coin.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      coin.symbol.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatPrice = (price: number) => {
    if (price >= 1000000) {
      return price.toLocaleString("ko-KR");
    }
    return price.toFixed(2);
  };

  const formatVolume = (volume: number) => {
    if (volume >= 1000000000000) {
      return `${(volume / 1000000000000).toFixed(2)}조`;
    } else if (volume >= 100000000) {
      return `${(volume / 100000000).toFixed(0)}억`;
    }
    return volume.toLocaleString("ko-KR");
  };

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
                  <option value="코인원 KRW">코인원 KRW</option>
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

              <div className="flex items-center space-x-2">
                <label className="text-gray-400 text-sm">해외 거래소</label>
                <select className="bg-gray-700 text-white px-3 py-1 rounded border border-gray-600">
                  <option value="바이낸스">바이낸스</option>
                  <option value="코인베이스">코인베이스</option>
                </select>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-gray-400 text-sm">
                암호화폐 총 {coins.size}개
              </span>
              <input
                type="text"
                placeholder="Q BTC, 비트코인, ㅂㅌ"
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
        <div className="overflow-x-auto">
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
              {filteredCoins.map((coin) => {
                const highDiff =
                  ((coin.price - coin.high24h) / coin.high24h) * 100;
                const lowDiff =
                  ((coin.price - coin.low24h) / coin.low24h) * 100;

                return (
                  <tr
                    key={coin.symbol}
                    className="border-b border-gray-800 hover:bg-gray-800 transition-colors"
                  >
                    <td className="py-3 px-4 overflow-hidden">
                      <div className="truncate">
                        <div className="font-medium truncate">{coin.name}</div>
                        <div className="text-sm text-gray-400 truncate">
                          {coin.symbol}
                        </div>
                      </div>
                    </td>
                    <td className="text-right py-3 px-4 overflow-hidden">
                      <div className="truncate">
                        <div
                          className={`truncate ${
                            priceFlash.get(coin.symbol) === "up"
                              ? "animate-flash-green"
                              : priceFlash.get(coin.symbol) === "down"
                              ? "animate-flash-red"
                              : ""
                          }`}
                        >
                          {formatPrice(coin.koreanPrice || coin.price)}
                        </div>
                        {coin.koreanPrice && (
                          <div className="text-sm text-gray-400 truncate">
                            {formatPrice(coin.price)}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="text-right py-3 px-4 overflow-hidden">
                      <div
                        className={`truncate ${
                          coin.kimchiPremium && coin.kimchiPremium > 0
                            ? "text-green-400"
                            : "text-red-400"
                        }`}
                      >
                        {coin.kimchiPremium !== undefined
                          ? `${
                              coin.kimchiPremium > 0 ? "+" : ""
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
                          highDiff >= -1 ? "text-green-400" : "text-red-400"
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
                          lowDiff <= 1 ? "text-green-400" : "text-red-400"
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
