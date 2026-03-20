"use client";

import React, { memo } from "react";
import type { PriceFlashDir } from "./CoinRow";
import { CoinRow } from "./CoinRow";

export type SortKey = "name" | "korp" | "price" | "change" | "volume";
export type SortDir = "asc" | "desc";

type SortState = { key: SortKey; dir: SortDir };

type CoinView = {
  symbol: string;
  name: string;
  korp?: number;
  koreanPrice?: number;
  globalPriceKrw?: number;
  domesticChangePercent?: number;
  domesticChangeAmount?: number;
  domesticTradeValueKrw?: number;
};

export type CoinListTableProps = {
  t: (key: string, params?: Record<string, string | number>) => string;
  sort: SortState;
  onToggleSort: (key: SortKey) => void;
  isDomesticReady: boolean;
  selectedExchange: string;
  upbitConnectionStatus: "idle" | "connecting" | "live" | "degraded";
  bithumbConnectionStatus: "idle" | "connecting" | "live" | "degraded";
  coins: CoinView[];
  selectedSymbol: string;
  priceFlash: Map<string, PriceFlashDir>;
  onSelect: (symbol: string) => void;
  formatPrice: (price: number) => string;
  formatTradeValueInMillionsKrw: (valueKrw: number) => string;
  SkeletonRow: React.ComponentType<{ keyProp: number }>;
};

const SortIcon = memo(function SortIcon({
  active,
  dir,
}: {
  active: boolean;
  dir: "asc" | "desc";
}) {
  return active ? (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      className="shrink-0 text-gray-600 dark:text-gray-300"
      aria-hidden="true"
    >
      {dir === "asc" ? (
        <path fill="currentColor" d="M7 14l5-5 5 5H7z" />
      ) : (
        <path fill="currentColor" d="M7 10l5 5 5-5H7z" />
      )}
    </svg>
  ) : (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      className="shrink-0 text-gray-400 dark:text-gray-600 opacity-70"
      aria-hidden="true"
    >
      <path fill="currentColor" d="M7 10l5-5 5 5H7zm0 4h10l-5 5-5-5z" />
    </svg>
  );
});

const HeaderButton = memo(function HeaderButton({
  sortKey,
  align,
  label,
  sort,
  onToggleSort,
}: {
  sortKey: SortKey;
  align: "left" | "right";
  label: string;
  sort: SortState;
  onToggleSort: (key: SortKey) => void;
}) {
  const active = sort.key === sortKey;
  const justify = align === "right" ? "justify-end" : "justify-start";
  return (
    <button
      type="button"
      onClick={() => onToggleSort(sortKey)}
      className={`group inline-flex w-full items-center gap-1 ${justify} select-none`}
    >
      <span className="leading-none">{label}</span>
      <SortIcon active={active} dir={sort.dir} />
    </button>
  );
});

export const CoinListTable = memo(function CoinListTable(props: CoinListTableProps) {
  const {
    t,
    sort,
    onToggleSort,
    isDomesticReady,
    selectedExchange,
    upbitConnectionStatus,
    bithumbConnectionStatus,
    coins,
    selectedSymbol,
    priceFlash,
    onSelect,
    formatPrice,
    formatTradeValueInMillionsKrw,
    SkeletonRow,
  } = props;

  const showEmptyState = !isDomesticReady;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden modern-scrollbar">
      <div className="sticky top-0 z-[1] grid grid-cols-[minmax(0,1fr)_52px_88px_64px_64px] gap-1.5 px-2 py-2 text-[12px] text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-800 overflow-x-hidden bg-white dark:bg-gray-900">
        <HeaderButton
          sortKey="name"
          align="left"
          label={t("table.name")}
          sort={sort}
          onToggleSort={onToggleSort}
        />
        <HeaderButton
          sortKey="korp"
          align="right"
          label={t("table.korp")}
          sort={sort}
          onToggleSort={onToggleSort}
        />
        <HeaderButton
          sortKey="price"
          align="right"
          label={t("table.price")}
          sort={sort}
          onToggleSort={onToggleSort}
        />
        <HeaderButton
          sortKey="change"
          align="right"
          label={t("table.change24h")}
          sort={sort}
          onToggleSort={onToggleSort}
        />
        <HeaderButton
          sortKey="volume"
          align="right"
          label={t("table.volume24h")}
          sort={sort}
          onToggleSort={onToggleSort}
        />
      </div>

      {showEmptyState ? (
        selectedExchange === "업비트 KRW" ? (
          <div className="p-4">
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3">
              <div className="flex items-start gap-3">
                <div
                  className={`mt-0.5 shrink-0 ${
                    upbitConnectionStatus === "connecting"
                      ? "text-yellow-500"
                      : upbitConnectionStatus === "degraded"
                        ? "text-orange-500"
                        : "text-gray-400"
                  }`}
                  aria-hidden="true"
                >
                  <svg viewBox="0 0 24 24" width="18" height="18">
                    <path
                      fill="currentColor"
                      d="M12 6V3L8 7l4 4V8c2.76 0 5 2.24 5 5a5 5 0 0 1-8.66 3.54l-1.42 1.42A7 7 0 1 0 12 6z"
                    />
                  </svg>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {upbitConnectionStatus === "degraded"
                      ? t("market.connectionFailed")
                      : t("market.connectionPending")}
                  </div>
                  <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                    {t("market.staleDataHidden")}
                  </div>
                </div>

                <div className="shrink-0 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  {t("market.connectionPending")}
                </div>
              </div>
            </div>
          </div>
        ) : selectedExchange === "빗썸 KRW" ? (
          <div className="p-4">
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3">
              <div className="flex items-start gap-3">
                <div
                  className={`mt-0.5 shrink-0 ${
                    bithumbConnectionStatus === "connecting"
                      ? "text-yellow-500"
                      : bithumbConnectionStatus === "degraded"
                        ? "text-orange-500"
                        : "text-gray-400"
                  }`}
                  aria-hidden="true"
                >
                  <svg viewBox="0 0 24 24" width="18" height="18">
                    <path
                      fill="currentColor"
                      d="M12 6V3L8 7l4 4V8c2.76 0 5 2.24 5 5a5 5 0 0 1-8.66 3.54l-1.42 1.42A7 7 0 1 0 12 6z"
                    />
                  </svg>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {bithumbConnectionStatus === "degraded"
                      ? t("market.connectionFailed")
                      : t("market.connectionPending")}
                  </div>
                  <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                    {t("market.staleDataHidden")}
                  </div>
                </div>

                <div className="shrink-0 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  {t("market.connectionPending")}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div>
            {Array.from({ length: 12 }).map((_, i) => (
              <SkeletonRow key={i} keyProp={i} />
            ))}
          </div>
        )
      ) : (
        coins.map((coin) => (
          <CoinRow
            key={coin.symbol}
            symbol={coin.symbol}
            name={coin.name}
            korp={coin.korp}
            koreanPrice={coin.koreanPrice}
            globalPriceKrw={coin.globalPriceKrw}
            domesticChangePercent={coin.domesticChangePercent}
            domesticChangeAmount={coin.domesticChangeAmount}
            domesticTradeValueKrw={coin.domesticTradeValueKrw}
            isSelected={coin.symbol === selectedSymbol}
            flash={priceFlash.get(coin.symbol) ?? null}
            onSelect={onSelect}
            formatPrice={formatPrice}
            formatTradeValueInMillionsKrw={formatTradeValueInMillionsKrw}
          />
        ))
      )}
    </div>
  );
});

