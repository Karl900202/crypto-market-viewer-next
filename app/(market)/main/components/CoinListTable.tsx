"use client";

import React, { memo, useRef } from "react";
import type { DomesticTickerVM } from "@/lib/domestic-ticker-vm";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { NameColumnMode } from "@/lib/name-column-mode";
import {
  CoinRow,
  COIN_LIST_ROW_GRID_CLASS,
  type PriceFlashDir,
} from "./CoinRow";

/** CoinRow: py-2 + 두 줄 텍스트 + border — 스크롤 높이 추정 */
const COIN_LIST_ROW_ESTIMATE_PX = 56;

export type SortKey = "korp" | "price" | "change" | "volume";
export type SortDir = "asc" | "desc";

/** `default`: 거래대금 내림차순(초기). 컬럼 클릭 시 asc → desc → default 사이클 */
export type SortState =
  | { mode: "default" }
  | { mode: "custom"; key: SortKey; dir: SortDir };

type CoinView = {
  symbol: string;
  name: string;
  korp?: number;
  domestic?: DomesticTickerVM;
  globalPriceKrw?: number;
};

export type CoinListTableProps = {
  t: (key: string, params?: Record<string, string | number>) => string;
  sort: SortState;
  onToggleSort: (key: SortKey) => void;
  isDomesticReady: boolean;
  selectedExchange: string;
  upbitConnectionStatus: "idle" | "connecting" | "live" | "degraded";
  bithumbConnectionStatus: "idle" | "connecting" | "live" | "degraded";
  coinoneConnectionStatus: "idle" | "connecting" | "live" | "degraded";
  coins: CoinView[];
  selectedSymbol: string;
  priceFlash: Map<string, PriceFlashDir>;
  onSelect: (symbol: string) => void;
  formatPrice: (price: number) => string;
  formatTradeValueInMillionsKrw: (valueKrw: number) => string;
  SkeletonRow: React.ComponentType<{ keyProp: number }>;
  nameColumnMode: NameColumnMode;
  onToggleNameColumnMode: () => void;
};

/** 위·아래 화살표 항상 동시 표시, 정렬 방향은 삼각형 색으로만 구분 */
const SortIcon = memo(function SortIcon({
  active,
  dir,
}: {
  active: boolean;
  dir: "asc" | "desc";
}) {
  const muted = "text-gray-300 dark:text-gray-600";
  const neutral = "text-gray-400 dark:text-gray-500 opacity-90";
  const highlight = "text-[#1261c4] dark:text-blue-400";

  let upClass: string;
  let downClass: string;
  if (!active) {
    upClass = neutral;
    downClass = neutral;
  } else if (dir === "asc") {
    upClass = highlight;
    downClass = muted;
  } else {
    upClass = muted;
    downClass = highlight;
  }

  return (
    <svg
      viewBox="0 0 24 24"
      width="12"
      height="12"
      className="shrink-0 opacity-80"
      aria-hidden="true"
    >
      <path className={upClass} fill="currentColor" d="M7 10l5-5 5 5H7z" />
      <path className={downClass} fill="currentColor" d="M7 14h10l-5 5-5-5z" />
    </svg>
  );
});

/** 한글명↔영문명 전환 (가로 스왑 화살표) */
const SwapIcon = memo(function SwapIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="12"
      height="12"
      className={className}
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M6.99 11L3 15l3.99 4v-3H17v-2H6.99v-3zM18 9l-3.99-4v3H7v2h7.01v3L18 9z"
      />
    </svg>
  );
});

const NameColumnHeader = memo(function NameColumnHeader({
  nameColumnMode,
  onToggleNameColumnMode,
  t,
}: {
  nameColumnMode: NameColumnMode;
  onToggleNameColumnMode: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const label =
    nameColumnMode === "korean"
      ? t("table.nameHeaderKorean")
      : t("table.nameHeaderEnglish");

  return (
    <div className="group inline-flex w-full min-w-0 items-center justify-start select-none whitespace-nowrap">
      <button
        type="button"
        onClick={onToggleNameColumnMode}
        className="inline-flex min-w-0 max-w-full items-center gap-0.5 rounded px-0.5 py-0.5 -mx-0.5 hover:bg-gray-200/80 dark:hover:bg-gray-700/80"
        title={
          nameColumnMode === "korean"
            ? t("table.nameToggleToEnglish")
            : t("table.nameToggleToKorean")
        }
      >
        <span className="truncate text-[12px] font-normal leading-none text-[#8b94a1] dark:text-gray-400">
          {label}
        </span>
        <SwapIcon className="shrink-0 text-[#8b94a1] dark:text-gray-400 opacity-90" />
      </button>
    </div>
  );
});

const HeaderButton = memo(function HeaderButton({
  sortKey,
  align,
  label,
  sort,
  onToggleSort,
  className,
}: {
  sortKey: SortKey;
  align: "left" | "right";
  label: string;
  sort: SortState;
  onToggleSort: (key: SortKey) => void;
  className?: string;
}) {
  const active = sort.mode === "custom" && sort.key === sortKey;
  const dir = sort.mode === "custom" ? sort.dir : "desc";
  const justify = align === "right" ? "justify-end" : "justify-start";
  const labelClass = active
    ? "text-[12px] font-normal leading-none text-[#1261c4] dark:text-blue-400"
    : "text-[12px] font-normal leading-none text-[#8b94a1] dark:text-gray-400";
  return (
    <button
      type="button"
      onClick={() => onToggleSort(sortKey)}
      className={`group inline-flex w-full items-center gap-1 ${justify} select-none whitespace-nowrap ${className ?? ""}`}
    >
      <span className={labelClass}>{label}</span>
      <SortIcon active={active} dir={dir} />
    </button>
  );
});

export const CoinListTable = memo(function CoinListTable(
  props: CoinListTableProps,
) {
  const {
    t,
    sort,
    onToggleSort,
    isDomesticReady,
    selectedExchange,
    upbitConnectionStatus,
    bithumbConnectionStatus,
    coinoneConnectionStatus,
    coins,
    selectedSymbol,
    priceFlash,
    onSelect,
    formatPrice,
    formatTradeValueInMillionsKrw,
    SkeletonRow,
    nameColumnMode,
    onToggleNameColumnMode,
  } = props;

  const showEmptyState = !isDomesticReady;
  const scrollParentRef = useRef<HTMLDivElement>(null);
  const virtualRowCount = showEmptyState ? 0 : coins.length;
  const virtualizer = useVirtualizer({
    count: virtualRowCount,
    getScrollElement: () => scrollParentRef.current,
    estimateSize: () => COIN_LIST_ROW_ESTIMATE_PX,
    overscan: 12,
  });

  return (
    <div
      ref={scrollParentRef}
      className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-auto modern-scrollbar"
    >
      <div
        className={`sticky top-0 z-[1] w-full min-w-0 font-normal ${COIN_LIST_ROW_GRID_CLASS} border-b border-[#e5e8eb] bg-[#f9fafb] px-3 py-2 dark:border-gray-800 dark:bg-gray-800/90`}
      >
        <NameColumnHeader
          nameColumnMode={nameColumnMode}
          onToggleNameColumnMode={onToggleNameColumnMode}
          t={t}
        />
        <HeaderButton
          sortKey="price"
          align="right"
          label={t("table.price")}
          sort={sort}
          onToggleSort={onToggleSort}
        />
        <HeaderButton
          sortKey="korp"
          align="right"
          label={t("table.korp")}
          sort={sort}
          onToggleSort={onToggleSort}
          className="ml-1"
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
          <div className="p-4 font-normal">
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
                  <div className="text-sm font-normal text-gray-900 dark:text-white">
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
          <div className="p-4 font-normal">
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
                  <div className="text-sm font-normal text-gray-900 dark:text-white">
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
        ) : selectedExchange === "코인원 KRW" ? (
          <div className="p-4 font-normal">
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3">
              <div className="flex items-start gap-3">
                <div
                  className={`mt-0.5 shrink-0 ${
                    coinoneConnectionStatus === "connecting"
                      ? "text-yellow-500"
                      : coinoneConnectionStatus === "degraded"
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
                  <div className="text-sm font-normal text-gray-900 dark:text-white">
                    {coinoneConnectionStatus === "degraded"
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
        <div
          className="relative w-full"
          style={{ height: virtualizer.getTotalSize() }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const coin = coins[virtualRow.index];
            return (
              <div
                key={virtualRow.key}
                className="absolute left-0 top-0 w-full"
                style={{ transform: `translateY(${virtualRow.start}px)` }}
              >
                <CoinRow
                  symbol={coin.symbol}
                  name={coin.name}
                  nameColumnMode={nameColumnMode}
                  korp={coin.korp}
                  domestic={coin.domestic}
                  globalPriceKrw={coin.globalPriceKrw}
                  isSelected={coin.symbol === selectedSymbol}
                  flash={priceFlash.get(coin.symbol) ?? null}
                  onSelect={onSelect}
                  formatPrice={formatPrice}
                  formatTradeValueInMillionsKrw={formatTradeValueInMillionsKrw}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

export type { NameColumnMode } from "@/lib/name-column-mode";
