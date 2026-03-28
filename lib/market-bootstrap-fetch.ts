/**
 * 마켓 첫 로딩·프리페치에서 동일 API를 중복 호출하지 않도록 캐시/공유.
 * (업비트 마켓 목록은 세션 동안 동일하게 써도 무방)
 */

export type UpbitMarketRow = {
  market: string;
  korean_name: string;
  english_name: string;
};

let upbitMarketsCache: UpbitMarketRow[] | null = null;
let upbitMarketsInflight: Promise<UpbitMarketRow[]> | null = null;

export async function loadUpbitMarketsJson(): Promise<UpbitMarketRow[]> {
  if (upbitMarketsCache) return upbitMarketsCache;
  if (!upbitMarketsInflight) {
    upbitMarketsInflight = (async () => {
      const res = await fetch("/api/upbit/markets");
      if (!res.ok) throw new Error("Failed to fetch upbit markets");
      const data = (await res.json()) as UpbitMarketRow[];
      upbitMarketsCache = data;
      return data;
    })().finally(() => {
      upbitMarketsInflight = null;
    });
  }
  return upbitMarketsInflight;
}

/** 다음 전체 새로고침 수준에서 업비트 캐시를 버릴 때 (필요 시 확장) */
export function clearUpbitMarketsCache(): void {
  upbitMarketsCache = null;
}

type BinancePricesJson = { prices: Record<string, number> };

let binancePricesInflight: Promise<BinancePricesJson> | null = null;

export async function fetchBinanceUsdtPricesJson(): Promise<BinancePricesJson> {
  if (!binancePricesInflight) {
    binancePricesInflight = (async () => {
      const res = await fetch("/api/binance/prices?quote=USDT");
      if (!res.ok) throw new Error("Failed to fetch binance prices");
      return (await res.json()) as BinancePricesJson;
    })().finally(() => {
      binancePricesInflight = null;
    });
  }
  return binancePricesInflight;
}

/** 레이아웃 마운트 시 — 라우트 JS·HTTP 캐시 워밍 */
export function prefetchMarketBootstrap(): void {
  void loadUpbitMarketsJson().catch(() => {});
  void fetchBinanceUsdtPricesJson().catch(() => {});
}
