"use client";

import type { DomesticTickerVM } from "@/lib/domestic-ticker-vm";
import { formatPrice } from "@/lib/format-price";
import { getCoinEnglishDisplayName } from "@/lib/coin-english-display-name";
import type { NameColumnMode } from "@/lib/name-column-mode";
import { useMarketSelectionStore } from "@/stores/useMarketSelectionStore";
import { CandlestickChart } from "./CandlestickChart";

type TFn = (key: string, params?: Record<string, string | number>) => string;

/** `page.tsx` CoinData와 동일 스키마(우측 패널에서 쓰는 필드만) */
type RightPanelCoin = {
  symbol: string;
  name: string;
  domestic?: DomesticTickerVM;
  globalPriceUsdt?: number;
};

type MarketRightPanelProps = {
  t: TFn;
  coins: Map<string, RightPanelCoin>;
  filteredCoins: RightPanelCoin[];
  displayUsdtToKrw: number;
  selectedExchange: string;
  nameColumnMode: NameColumnMode;
  /** 시세·정렬 준비 전 우측 상단 텍스트 대신 스켈레톤 */
  showHeaderSkeleton?: boolean;
};

/** 선택 심볼만 구독 — 리스트(부모)는 클릭 시 리렌더되지 않게 분리 */
export function MarketRightPanel({
  t,
  coins,
  filteredCoins,
  displayUsdtToKrw,
  selectedExchange,
  nameColumnMode,
  showHeaderSkeleton = false,
}: MarketRightPanelProps) {
  const selectedSymbol = useMarketSelectionStore((s) => s.selectedSymbol);
  const selectedCoin = coins.get(selectedSymbol) ?? filteredCoins[0];
  const selectedCoinSymbol = selectedCoin?.symbol ?? "BTC";

  return (
    <main className="min-h-0 min-w-0 flex-1">
      <div className="flex h-full min-h-0 flex-col overflow-hidden border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex shrink-0 items-center justify-between gap-4 px-5 py-4 ">
          {showHeaderSkeleton ? (
            <>
              <div className="min-w-0 space-y-2">
                <div className="h-5 max-w-[200px] rounded bg-gray-200 dark:bg-gray-700 animate-skeleton" />
                <div className="h-4 max-w-[280px] rounded bg-gray-200 dark:bg-gray-700 animate-skeleton" />
              </div>
              <div className="shrink-0 space-y-2 text-right">
                <div className="ml-auto h-4 w-28 rounded bg-gray-200 dark:bg-gray-700 animate-skeleton" />
                <div className="ml-auto h-5 w-40 rounded bg-gray-200 dark:bg-gray-700 animate-skeleton" />
              </div>
            </>
          ) : (
            <>
              <div className="min-w-0">
                <div className="truncate text-base font-semibold leading-tight">
                  {selectedCoin
                    ? nameColumnMode === "korean"
                      ? selectedCoin.name
                      : getCoinEnglishDisplayName(selectedCoin.symbol)
                    : selectedCoinSymbol}
                </div>
                <div className="mt-0.5 truncate text-sm text-gray-500 dark:text-gray-400">
                  {selectedCoinSymbol === "USDT"
                    ? t("market.usdtKrwChartSubtitle", {
                        exchange: selectedExchange.replace(" KRW", ""),
                      })
                    : `${selectedCoinSymbol}/KRW · ${t("market.binanceUsdtMarket")} KRW 환산`}
                </div>
              </div>
              <div className="shrink-0 text-right tabular-nums">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {selectedExchange.replace(" KRW", "")} / GLOBAL
                </div>
                <div className="text-base font-semibold">
                  {selectedCoin?.domestic?.price !== undefined
                    ? formatPrice(selectedCoin.domestic.price)
                    : "-"}{" "}
                  <span className="text-gray-500 dark:text-gray-400">·</span>{" "}
                  {selectedCoin?.globalPriceUsdt !== undefined
                    ? formatPrice(selectedCoin.globalPriceUsdt * displayUsdtToKrw)
                    : "-"}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="min-h-0 flex-1 min-h-[280px] p-4 flex flex-col">
          <CandlestickChart
            symbol={selectedCoinSymbol}
            selectedExchange={selectedExchange}
            t={
              t as unknown as (
                key: string,
                params?: Record<string, string | number>,
              ) => string
            }
          />
        </div>
      </div>
    </main>
  );
}
