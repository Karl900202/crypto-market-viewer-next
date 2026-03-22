"use client";

import React, { memo, useCallback } from "react";

/** 좌측 마켓 패널(~462px) 기준: 이름 열에 가로 여유 */
export const COIN_LIST_ROW_GRID_CLASS =
  "grid grid-cols-[minmax(0,1fr)_76px_56px_72px_70px] gap-x-1.5 gap-y-0 items-start";

export type PriceFlashDir = "up" | "down" | null;

export type CoinRowProps = {
  symbol: string;
  name: string;
  korp?: number;
  koreanPrice?: number;
  globalPriceKrw?: number;
  domesticChangePercent?: number;
  domesticChangeAmount?: number;
  domesticTradeValueKrw?: number;
  isSelected: boolean;
  flash: PriceFlashDir;
  onSelect: (symbol: string) => void;
  formatPrice: (price: number) => string;
  formatTradeValueInMillionsKrw: (valueKrw: number) => string;
};

export const CoinRow = memo(function CoinRow(props: CoinRowProps) {
  const {
    symbol,
    name,
    korp,
    koreanPrice,
    globalPriceKrw,
    domesticChangePercent,
    domesticChangeAmount,
    domesticTradeValueKrw,
    isSelected,
    flash,
    onSelect,
    formatPrice,
    formatTradeValueInMillionsKrw,
  } = props;

  const handleClick = useCallback(() => onSelect(symbol), [onSelect, symbol]);

  const domPrice = koreanPrice;
  const globalKrw = globalPriceKrw;
  const pairLabel = `${symbol}/KRW`;

  return (
    <button
      key={symbol}
      type="button"
      onClick={handleClick}
      className={`w-full overflow-hidden border-b border-[#eef1f5] px-3 py-2 text-left transition-colors hover:bg-[#f7f9fc] dark:border-gray-800 dark:hover:bg-gray-800/80 ${
        isSelected
          ? "bg-[#e9f0ff] hover:bg-[#e0ebff] dark:bg-blue-950/35 dark:hover:bg-blue-950/45"
          : "bg-white dark:bg-gray-900"
      }`}
    >
      <div className={COIN_LIST_ROW_GRID_CLASS}>
        <div className="min-w-0 text-left">
          <div
            className="truncate text-[12px] font-medium leading-snug text-gray-900 dark:text-white"
            title={name}
          >
            {name}
          </div>
          <div
            className="truncate text-[11px] leading-tight text-[#8b94a1] dark:text-gray-500"
            title={pairLabel}
          >
            {pairLabel}
          </div>
        </div>

        <div
          className={`text-right tabular-nums ${
            flash === "up"
              ? "animate-flash-green"
              : flash === "down"
                ? "animate-flash-red"
                : ""
          }`}
        >
          <div className="text-[12px] font-semibold tabular-nums text-gray-900 dark:text-white">
            {domPrice !== undefined ? formatPrice(domPrice) : "-"}
          </div>
          <div className="text-[11px] text-[#8b94a1] dark:text-gray-500 whitespace-nowrap">
            {globalKrw !== undefined ? formatPrice(globalKrw) : "-"}
          </div>
        </div>

        <div className="ml-1 text-right tabular-nums">
          {korp !== undefined ? (
            <div>
              <div
                className={`text-[12px] font-semibold tabular-nums ${
                  korp >= 0
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {korp >= 0 ? "+" : ""}
                {korp.toFixed(2)}%
              </div>
              <div className="text-[11px] text-[#8b94a1] dark:text-gray-500 whitespace-nowrap">
                {koreanPrice !== undefined && globalKrw !== undefined ? (
                  (() => {
                    const diff = koreanPrice - globalKrw;
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
            <div className="text-[12px] font-semibold text-gray-500 dark:text-gray-400">
              -
            </div>
          )}
        </div>

        <div className="text-right tabular-nums">
          <div
            className={`text-[12px] font-semibold tabular-nums whitespace-nowrap ${
              (domesticChangePercent ?? 0) >= 0
                ? "text-green-600 dark:text-green-400"
                : "text-red-600 dark:text-red-400"
            }`}
          >
            {domesticChangePercent !== undefined
              ? `${domesticChangePercent >= 0 ? "+" : ""}${domesticChangePercent.toFixed(2)}%`
              : "-"}
          </div>
          <div className="text-[11px] text-[#8b94a1] dark:text-gray-500 whitespace-nowrap">
            {domesticChangeAmount !== undefined
              ? `${domesticChangeAmount >= 0 ? "+" : "-"}${formatPrice(
                  Math.abs(domesticChangeAmount),
                )}`
              : "-"}
          </div>
        </div>

        <div className="text-right tabular-nums">
          <div className="text-[12px] font-semibold tabular-nums whitespace-nowrap text-gray-900 dark:text-white">
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
  a.korp === b.korp &&
  a.koreanPrice === b.koreanPrice &&
  a.globalPriceKrw === b.globalPriceKrw &&
  a.domesticChangePercent === b.domesticChangePercent &&
  a.domesticChangeAmount === b.domesticChangeAmount &&
  a.domesticTradeValueKrw === b.domesticTradeValueKrw &&
  a.isSelected === b.isSelected &&
  a.flash === b.flash,
);

