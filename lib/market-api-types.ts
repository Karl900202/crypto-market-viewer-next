/** `/api/upbit/markets` 응답 한 행 (KRW 마켓만 필터된 배열) */
export type UpbitMarketRow = {
  market: string;
  korean_name: string;
  english_name: string;
};

/** `/api/binance/prices?quote=USDT` JSON */
export type BinanceUsdtPricesResponse = {
  quote?: string;
  prices: Record<string, number>;
};
