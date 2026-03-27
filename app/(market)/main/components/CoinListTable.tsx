"use client";

import React, { memo, useCallback, useRef } from "react";
import type { DomesticTickerVM } from "@/lib/domestic-ticker-vm";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { NameColumnMode } from "@/lib/name-column-mode";
import {
  formatPrice,
  formatTradeValueInMillionsKrw,
} from "@/lib/format-price";
import {
  CoinRow,
  COIN_LIST_ROW_GRID_CLASS,
  type PriceFlashDir,
} from "./CoinRow";
import {
  CoinListSkeletonBody,
  COIN_LIST_ROW_ESTIMATE_PX,
} from "./coin-list-skeleton";

export type SortKey = "korp" | "price" | "change" | "volume";
export type SortDir = "asc" | "desc";

/** `default`: 거래대금 내림차순(초기). 컬럼 클릭 시 asc → desc → default 사이클 */
export type SortState =
  | { mode: "default" }
  | { mode: "custom"; key: SortKey; dir: SortDir };

type CoinView = {
  symbol: string;
  name: string;
  isFavorite: boolean;
  korp?: number;
  domestic?: DomesticTickerVM;
  globalPriceKrw?: number;
};

export type CoinListTableProps = {
  t: (key: string, params?: Record<string, string | number>) => string;
  sort: SortState;
  onToggleSort: (key: SortKey) => void;
  isDomesticReady: boolean;
  /** 국내 연결 후에도 정렬 필드가 전부 올 때까지 false → 테이블 본문 스켈레톤 */
  isListDataReady?: boolean;
  coins: CoinView[];
  priceFlash: Map<string, PriceFlashDir>;
  onSelect: (symbol: string) => void;
  onToggleFavorite: (symbol: string) => void;
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
    isListDataReady = true,
    coins,
    priceFlash,
    onSelect,
    onToggleFavorite,
    nameColumnMode,
    onToggleNameColumnMode,
  } = props;

  const showEmptyState = !isDomesticReady || !isListDataReady;
  const scrollParentRef = useRef<HTMLDivElement>(null);
  const getScrollElement = useCallback(
    () => scrollParentRef.current,
    [],
  );
  const virtualRowCount = showEmptyState ? 0 : coins.length;
  const virtualizer = useVirtualizer({
    count: virtualRowCount,
    getScrollElement,
    estimateSize: () => COIN_LIST_ROW_ESTIMATE_PX,
    overscan: 8,
  });

  return (
    <div
      ref={scrollParentRef}
      className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-auto modern-scrollbar"
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
        <CoinListSkeletonBody />
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
                  isFavorite={coin.isFavorite}
                  korp={coin.korp}
                  domestic={coin.domestic}
                  globalPriceKrw={coin.globalPriceKrw}
                  flash={priceFlash.get(coin.symbol) ?? null}
                  onSelect={onSelect}
                  onToggleFavorite={onToggleFavorite}
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
