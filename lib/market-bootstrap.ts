import type {
  BinanceUsdtPricesResponse,
  UpbitMarketRow,
} from "@/lib/market-api-types";

const UPBIT_MARKETS_URL = "/api/upbit/markets" as const;
const BINANCE_USDT_PRICES_URL = "/api/binance/prices?quote=USDT" as const;

/**
 * 업비트 마켓 목록: 세션 내 캐시 + 동시 요청 1회로 합침.
 * (이름 사전·업비트 상장 목록이 같은 페이로드를 공유)
 */
const upbitMarkets = (() => {
  let cache: UpbitMarketRow[] | null = null;
  let inflight: Promise<UpbitMarketRow[]> | null = null;

  async function load(): Promise<UpbitMarketRow[]> {
    if (cache) return cache;
    if (!inflight) {
      inflight = (async () => {
        const res = await fetch(UPBIT_MARKETS_URL);
        if (!res.ok) throw new Error("Failed to fetch upbit markets");
        const data = (await res.json()) as UpbitMarketRow[];
        cache = data;
        return data;
      })().finally(() => {
        inflight = null;
      });
    }
    return inflight;
  }

  return { load };
})();

export async function loadUpbitMarkets(): Promise<UpbitMarketRow[]> {
  return upbitMarkets.load();
}

/** 바이낸스 USDT 기준가: 짧은 창에서 동시 호출만 합침 (주기 갱신은 매번 새 요청) */
const loadBinanceUsdtPrices = (() => {
  let inflight: Promise<BinanceUsdtPricesResponse> | null = null;
  return async (): Promise<BinanceUsdtPricesResponse> => {
    if (!inflight) {
      inflight = (async () => {
        const res = await fetch(BINANCE_USDT_PRICES_URL);
        if (!res.ok) throw new Error("Failed to fetch binance prices");
        return (await res.json()) as BinanceUsdtPricesResponse;
      })().finally(() => {
        inflight = null;
      });
    }
    return inflight;
  };
})();

export { loadBinanceUsdtPrices };

/** 레이아웃 마운트 시 라우트·HTTP 캐시 워밍 */
export function prefetchMarketBootstrap(): void {
  void loadUpbitMarkets().catch(() => {});
  void loadBinanceUsdtPrices().catch(() => {});
}
