"use client";

import React, { memo, useCallback } from "react";
import {
  domesticTickerVmSnapshot,
  type DomesticTickerVM,
} from "@/lib/domestic-ticker-vm";
import {
  COIN_LIST_ROW_CELL_CLASS,
  coinListRowGridClass,
  type CoinListLayoutVariant,
} from "@/lib/coin-list-layout";
import { getCoinEnglishDisplayName } from "@/lib/coin-english-display-name";
import type { NameColumnMode } from "@/lib/name-column-mode";
import { useMarketSelectionStore } from "@/stores/useMarketSelectionStore";

/** 상승 / 하락 브랜드 색 (라이트·다크 공통) */
const COLOR_UP = "text-[#dd3c44]";
const COLOR_DOWN = "text-[#1375ec]";

const cnMuted = "text-[#8b94a1] dark:text-gray-500";
const cnNum12 = "text-[12px] font-normal tabular-nums whitespace-nowrap";
const cnNum11 = "text-[11px] font-normal whitespace-nowrap tabular-nums";

const upDownTextClass = (v: number | undefined) => {
  if (v === undefined || !Number.isFinite(v))
    return "text-gray-900 dark:text-white";
  if (v > 0) return COLOR_UP;
  if (v < 0) return COLOR_DOWN;
  return "text-gray-900 dark:text-white";
};

const korpTextClass = (korp: number) => (korp >= 0 ? COLOR_UP : COLOR_DOWN);

function formatSignedKrwDiff(
  dom: number | undefined,
  glob: number | undefined,
  formatPrice: (n: number) => string,
): string | null {
  if (dom === undefined || glob === undefined) return null;
  const diff = dom - glob;
  return `${diff >= 0 ? "+" : "-"}${formatPrice(Math.abs(diff))}`;
}

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
    const krwDiffLine = formatSignedKrwDiff(domPrice, globalKrw, formatPrice);

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
              className={`inline-flex shrink-0 cursor-pointer items-center justify-center ${
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
              <div className="min-w-0 break-words text-[12px] font-normal leading-snug text-gray-900 dark:text-white">
                {primaryName}
              </div>
              <div
                className={`mt-0.5 whitespace-nowrap text-[11px] font-normal leading-tight ${cnMuted}`}
              >
                {pairLabel}
              </div>
            </div>
          </div>

          <div
            className={`${COIN_LIST_ROW_CELL_CLASS} box-border w-full items-end border border-transparent px-2 py-0.5 text-right tabular-nums ${
              flash ? "animate-price-border-flash" : ""
            }`}
          >
            <div
              className={`${cnNum12} ${upDownTextClass(domesticChangePercent)} ${
                flash === "up"
                  ? "animate-flash-up"
                  : flash === "down"
                    ? "animate-flash-down"
                    : ""
              }`}
            >
              {domPrice !== undefined ? formatPrice(domPrice) : "-"}
            </div>
            <div className={`text-[11px] ${cnMuted} whitespace-nowrap`}>
              {globalKrw !== undefined ? formatPrice(globalKrw) : "-"}
            </div>
          </div>

          <div className={`text-right tabular-nums ${COIN_LIST_ROW_CELL_CLASS}`}>
            {korp !== undefined ? (
              <div>
                <div className={`${cnNum12} ${korpTextClass(korp)}`}>
                  {korp >= 0 ? "+" : ""}
                  {korp.toFixed(2)}%
                </div>
                <div
                  className={`${cnNum11} ${
                    domPrice !== undefined && globalKrw !== undefined
                      ? upDownTextClass(domPrice - globalKrw)
                      : cnMuted
                  }`}
                >
                  {krwDiffLine ?? "-"}
                </div>
              </div>
            ) : (
              <div className="text-[12px] font-normal text-gray-500 dark:text-gray-400">
                -
              </div>
            )}
          </div>

          <div className={`text-right tabular-nums ${COIN_LIST_ROW_CELL_CLASS}`}>
            <div className={`${cnNum12} ${upDownTextClass(domesticChangePercent)}`}>
              {domesticChangePercent !== undefined
                ? `${domesticChangePercent >= 0 ? "+" : ""}${domesticChangePercent.toFixed(2)}%`
                : "-"}
            </div>
            <div className={`${cnNum11} ${upDownTextClass(domesticChangeAmount)}`}>
              {domesticChangeAmount !== undefined
                ? `${domesticChangeAmount >= 0 ? "+" : "-"}${formatPrice(
                    Math.abs(domesticChangeAmount),
                  )}`
                : "-"}
            </div>
          </div>

          <div className={`text-right tabular-nums ${COIN_LIST_ROW_CELL_CLASS}`}>
            <div className={`${cnNum12} text-gray-900 dark:text-white`}>
              {domesticTradeValueKrw !== undefined
                ? formatTradeValueInMillionsKrw(domesticTradeValueKrw)
                : "-"}
            </div>
          </div>
        </div>
      </button>
    );
  },
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
