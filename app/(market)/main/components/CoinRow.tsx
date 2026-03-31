"use client";

import React, { memo, useCallback } from "react";
import {
  domesticTickerVmSnapshot,
  type DomesticTickerVM,
} from "@/lib/domestic-ticker-vm";
import { getCoinEnglishDisplayName } from "@/lib/coin-english-display-name";
import type { NameColumnMode } from "@/lib/name-column-mode";
import { useMarketSelectionStore } from "@/stores/useMarketSelectionStore";

/** 좌측 마켓 패널(~462px) 기준: 이름 열에 가로 여유 — items-stretch로 컬럼 높이 통일 */
export const COIN_LIST_ROW_GRID_CLASS =
  "grid grid-cols-[minmax(0,1fr)_84px_58px_64px_72px] gap-x-2 gap-y-0 items-stretch";

/** 목록·차트(stacked): split과 동일 그리드 — 가로 스크롤 없이 패널 너비에 맞춤 */
export const COIN_LIST_ROW_GRID_CLASS_STACKED = COIN_LIST_ROW_GRID_CLASS;

export type CoinListLayoutVariant = "split" | "stacked";

export function coinListRowGridClass(
  layout: CoinListLayoutVariant,
): string {
  return layout === "stacked"
    ? COIN_LIST_ROW_GRID_CLASS_STACKED
    : COIN_LIST_ROW_GRID_CLASS;
}

/** 각 컬럼 셀: 행 높이에 맞춰 세로 가운데 정렬 (스켈레톤 행과 공유) */
export const COIN_LIST_ROW_CELL_CLASS =
  "flex h-full min-h-0 flex-col justify-center self-stretch";

/** 상승 / 하락 브랜드 색 (라이트·다크 공통) */
const COLOR_UP = "text-[#dd3c44]";
const COLOR_DOWN = "text-[#1375ec]";

/** 상승 빨강 · 하락 파랑 (전일대비·KORP 등 공통) */
const upDownTextClass = (v: number | undefined) => {
  if (v === undefined || !Number.isFinite(v))
    return "text-gray-900 dark:text-white";
  if (v > 0) return COLOR_UP;
  if (v < 0) return COLOR_DOWN;
  return "text-gray-900 dark:text-white";
};

/** KORP: +는 빨강, -는 파랑 (0은 상승측 빨강) */
const korpTextClass = (korp: number) => (korp >= 0 ? COLOR_UP : COLOR_DOWN);

export type PriceFlashDir = "up" | "down" | null;

export type CoinRowProps = {
  symbol: string;
  name: string;
  nameColumnMode: NameColumnMode;
  isFavorite: boolean;
  korp?: number;
  domestic?: DomesticTickerVM;
  globalPriceKrw?: number;
  flash: PriceFlashDir;
  onSelect: (symbol: string) => void;
  onToggleFavorite: (symbol: string) => void;
  formatPrice: (price: number) => string;
  formatTradeValueInMillionsKrw: (valueKrw: number) => string;
  listLayout?: CoinListLayoutVariant;
};

export const CoinRow = memo(
  function CoinRow(props: CoinRowProps) {
    const {
      symbol,
      name,
      nameColumnMode,
      isFavorite,
      korp,
      domestic,
      globalPriceKrw,
      flash,
      onSelect,
      onToggleFavorite,
      formatPrice,
      formatTradeValueInMillionsKrw,
      listLayout = "split",
    } = props;

    const isSelected = useMarketSelectionStore(
      useCallback((s) => s.selectedSymbol === symbol, [symbol]),
    );

    const handleClick = useCallback(() => onSelect(symbol), [onSelect, symbol]);
    const handleToggleFavorite = useCallback(
      (e: React.MouseEvent<HTMLElement>) => {
        e.stopPropagation();
        onToggleFavorite(symbol);
      },
      [onToggleFavorite, symbol],
    );
    const handleToggleFavoriteKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLElement>) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        e.stopPropagation();
        onToggleFavorite(symbol);
      },
      [onToggleFavorite, symbol],
    );

    const domPrice = domestic?.price;
    const globalKrw = globalPriceKrw;
    const domesticChangePercent = domestic?.changePercent;
    const domesticChangeAmount = domestic?.changeAmount;
    const domesticTradeValueKrw = domestic?.tradeValueKrw;
    const pairLabel = `${symbol}/KRW`;
    const primaryName =
      nameColumnMode === "korean" ? name : getCoinEnglishDisplayName(symbol);
    const rowGridClass = coinListRowGridClass(listLayout);

    return (
      <button
        type="button"
        onClick={handleClick}
        className={`relative w-full overflow-hidden border-b border-[#eef1f5] px-3 py-2.5 text-left font-normal hover:bg-[#f7f9fc] focus:outline-none dark:border-gray-800 dark:hover:bg-gray-800/80 ${
          isSelected
            ? "before:pointer-events-none before:absolute before:inset-y-0 before:left-0 before:z-[1] before:w-[3px] before:bg-orange-500 before:content-[''] dark:before:bg-orange-400 bg-[#e9f0ff] hover:bg-[#e0ebff] dark:bg-blue-950/35 dark:hover:bg-blue-950/45"
            : "bg-white dark:bg-gray-900"
        }`}
      >
        <div className={rowGridClass}>
          <div className="flex min-w-0 items-start gap-2">
              <span
                role="button"
                tabIndex={0}
                aria-label={`${symbol} favorite`}
                onClick={handleToggleFavorite}
                onKeyDown={handleToggleFavoriteKeyDown}
                className={`inline-flex shrink-0 items-center justify-center cursor-pointer ${
                  isFavorite
                    ? "text-[#f5c542] hover:text-[#eab308]"
                    : "text-gray-300 hover:text-gray-400 dark:text-gray-500 dark:hover:text-gray-400"
                }`}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M12 2.5l2.93 5.94 6.56.95-4.74 4.62 1.12 6.53L12 17.47 6.13 20.54l1.12-6.53-4.74-4.62 6.56-.95L12 2.5z"
                  />
                </svg>
              </span>
          <div className={`min-w-0 text-left ${COIN_LIST_ROW_CELL_CLASS}`}>
            <div
              className="min-w-0 break-words text-[12px] font-normal leading-snug text-gray-900 dark:text-white"
            >
              {primaryName}
            </div>
            <div className="mt-0.5 whitespace-nowrap text-[11px] font-normal leading-tight text-[#8b94a1] dark:text-gray-500">
              {pairLabel}
            </div>
          </div>
          </div>

          <div
            className={`${COIN_LIST_ROW_CELL_CLASS} w-full items-end text-right tabular-nums border border-transparent box-border px-2 py-0.5 ${
              flash ? "animate-price-border-flash" : ""
            }`}
          >
            <div
              className={`text-[12px] font-normal tabular-nums whitespace-nowrap ${upDownTextClass(domesticChangePercent)} ${
                flash === "up"
                  ? "animate-flash-up"
                  : flash === "down"
                    ? "animate-flash-down"
                    : ""
              }`}
            >
              {domPrice !== undefined ? formatPrice(domPrice) : "-"}
            </div>
            <div className="text-[11px] text-[#8b94a1] dark:text-gray-500 whitespace-nowrap">
              {globalKrw !== undefined ? formatPrice(globalKrw) : "-"}
            </div>
          </div>

          <div
            className={`text-right tabular-nums ${COIN_LIST_ROW_CELL_CLASS}`}
          >
            {korp !== undefined ? (
              <div>
                <div
                  className={`text-[12px] font-normal tabular-nums whitespace-nowrap ${korpTextClass(korp)}`}
                >
                  {korp >= 0 ? "+" : ""}
                  {korp.toFixed(2)}%
                </div>
                <div
                  className={`text-[11px] font-normal whitespace-nowrap tabular-nums ${
                    domPrice !== undefined && globalKrw !== undefined
                      ? upDownTextClass(domPrice - globalKrw)
                      : "text-[#8b94a1] dark:text-gray-500"
                  }`}
                >
                  {domPrice !== undefined && globalKrw !== undefined ? (
                    (() => {
                      const diff = domPrice - globalKrw;
                      return `${diff >= 0 ? "+" : "-"}${formatPrice(
                        Math.abs(diff),
                      )}`;
                    })()
                  ) : (
                    <span>-</span>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-[12px] font-normal text-gray-500 dark:text-gray-400">
                -
              </div>
            )}
          </div>

          <div
            className={`text-right tabular-nums ${COIN_LIST_ROW_CELL_CLASS}`}
          >
            <div
              className={`text-[12px] font-normal tabular-nums whitespace-nowrap ${upDownTextClass(domesticChangePercent)}`}
            >
              {domesticChangePercent !== undefined
                ? `${domesticChangePercent >= 0 ? "+" : ""}${domesticChangePercent.toFixed(2)}%`
                : "-"}
            </div>
            <div
              className={`text-[11px] font-normal whitespace-nowrap tabular-nums ${upDownTextClass(domesticChangeAmount)}`}
            >
              {domesticChangeAmount !== undefined
                ? `${domesticChangeAmount >= 0 ? "+" : "-"}${formatPrice(
                    Math.abs(domesticChangeAmount),
                  )}`
                : "-"}
            </div>
          </div>

          <div
            className={`text-right tabular-nums ${COIN_LIST_ROW_CELL_CLASS}`}
          >
            <div className="text-[12px] font-normal tabular-nums whitespace-nowrap text-gray-900 dark:text-white">
              {domesticTradeValueKrw !== undefined
                ? formatTradeValueInMillionsKrw(domesticTradeValueKrw)
                : "-"}
            </div>
          </div>
        </div>
      </button>
    );
  },
  // custom comparator to avoid rerender when unchanged
  (a, b) =>
    a.symbol === b.symbol &&
    a.name === b.name &&
    a.nameColumnMode === b.nameColumnMode &&
    a.isFavorite === b.isFavorite &&
    a.korp === b.korp &&
    domesticTickerVmSnapshot(a.domestic) ===
      domesticTickerVmSnapshot(b.domestic) &&
    a.globalPriceKrw === b.globalPriceKrw &&
    a.flash === b.flash &&
    a.onSelect === b.onSelect &&
    a.onToggleFavorite === b.onToggleFavorite &&
    a.formatPrice === b.formatPrice &&
    a.formatTradeValueInMillionsKrw === b.formatTradeValueInMillionsKrw &&
    (a.listLayout ?? "split") === (b.listLayout ?? "split"),
);
