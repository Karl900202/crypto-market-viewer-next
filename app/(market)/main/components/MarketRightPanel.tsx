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
  /** 모바일 차트 전용: 뒤로가기 + 한글명 / 영문명 2단 헤더 */
  mobileChartMode?: boolean;
  onMobileBack?: () => void;
  className?: string;
};

/** 선택 심볼만 구독 — 리스트(부모)는 클릭 시 리렌더되지 않게 분리 */
function BackChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

export function MarketRightPanel({
  t,
  coins,
  filteredCoins,
  displayUsdtToKrw,
  selectedExchange,
  nameColumnMode,
  showHeaderSkeleton = false,
  mobileChartMode = false,
  onMobileBack,
  className = "",
}: MarketRightPanelProps) {
  const selectedSymbol = useMarketSelectionStore((s) => s.selectedSymbol);
  const selectedCoin = coins.get(selectedSymbol) ?? filteredCoins[0];
  const selectedCoinSymbol = selectedCoin?.symbol ?? "BTC";
  const koreanName = selectedCoin?.name ?? selectedCoinSymbol;
  const englishName = getCoinEnglishDisplayName(selectedCoinSymbol);

  return (
    <main
      className={`min-h-0 min-w-0 flex-1 max-md:h-full max-md:min-h-0 max-md:overflow-hidden ${className}`.trim()}
    >
      <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background max-md:shadow-none">
        <div
          className={`shrink-0 px-3 py-2 md:px-5 md:py-4 ${mobileChartMode ? "max-md:px-2 max-md:pb-1 max-md:pt-1.5" : ""} ${mobileChartMode ? "" : "flex items-center justify-between gap-4"}`}
        >
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
          ) : mobileChartMode && onMobileBack ? (
            <>
              <div className="flex min-w-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={onMobileBack}
                  className="flex shrink-0 items-center justify-center rounded-lg text-gray-700 transition-colors hover:bg-gray-100 active:bg-gray-200 dark:text-gray-200 dark:hover:bg-gray-800 dark:active:bg-gray-700"
                  aria-label={t("market.mobileBackAria")}
                >
                  <BackChevronIcon className="h-6 w-6" />
                </button>
                <p className="min-w-0 flex-1 truncate text-base leading-snug">
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {koreanName}
                  </span>
                  <span className="font-normal text-gray-500 dark:text-gray-400">
                    {" "}
                    · {englishName}
                  </span>
                </p>
              </div>
              <div className="min-w-0 text-sm leading-snug text-gray-500 dark:text-gray-400">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 tabular-nums">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {selectedExchange.replace(" KRW", "")} / GLOBAL
                  </span>
                  <span className="text-base font-semibold text-gray-900 dark:text-white">
                    {selectedCoin?.domestic?.price !== undefined
                      ? formatPrice(selectedCoin.domestic.price)
                      : "-"}{" "}
                    <span className="text-gray-500 dark:text-gray-400">·</span>{" "}
                    {selectedCoin?.globalPriceUsdt !== undefined
                      ? formatPrice(
                          selectedCoin.globalPriceUsdt * displayUsdtToKrw,
                        )
                      : "-"}
                  </span>
                </div>
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
                    ? formatPrice(
                        selectedCoin.globalPriceUsdt * displayUsdtToKrw,
                      )
                    : "-"}
                </div>
              </div>
            </>
          )}
        </div>

        <div
          className={`flex min-h-0 flex-1 flex-col p-2 md:min-h-[280px] md:p-4 ${
            mobileChartMode
              ? "max-md:min-h-0 max-md:overflow-hidden max-md:px-2 max-md:pb-1 max-md:pt-0"
              : ""
          }`}
        >
          <CandlestickChart
            symbol={selectedCoinSymbol}
            selectedExchange={selectedExchange}
            fitViewport={mobileChartMode}
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
