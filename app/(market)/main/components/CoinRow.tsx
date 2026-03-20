"use client";

import React, { memo, useCallback } from "react";

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

  return (
    <button
      key={symbol}
      type="button"
      onClick={handleClick}
      className={`w-full text-left px-2 py-2.5 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors overflow-hidden ${
        isSelected ? "bg-yellow-50/60 dark:bg-yellow-400/10" : ""
      }`}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_52px_88px_64px_64px] gap-1.5 items-center">
        <div className="min-w-0 text-left">
          <div className="text-[13px] font-medium whitespace-normal break-words leading-snug">
            {name}
          </div>
          <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
            {symbol}
          </div>
        </div>

        <div className="text-right tabular-nums">
          {korp !== undefined ? (
            <div>
              <div
                className={`text-[13px] font-semibold ${
                  korp >= 0
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {korp >= 0 ? "+" : ""}
                {korp.toFixed(2)}%
              </div>
              <div className="text-[10px] text-gray-500 dark:text-gray-400 whitespace-nowrap">
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
            <div className="text-[13px] font-semibold text-gray-500 dark:text-gray-400">
              -
            </div>
          )}
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
          <div className="text-[13px] font-semibold">
            {domPrice !== undefined ? formatPrice(domPrice) : "-"}
          </div>
          <div className="text-[10px] text-gray-500 dark:text-gray-400 whitespace-nowrap">
            {globalKrw !== undefined ? formatPrice(globalKrw) : "-"}
          </div>
        </div>

        <div className="text-right tabular-nums">
          <div
            className={`text-[13px] font-semibold whitespace-nowrap ${
              (domesticChangePercent ?? 0) >= 0
                ? "text-green-600 dark:text-green-400"
                : "text-red-600 dark:text-red-400"
            }`}
          >
            {domesticChangePercent !== undefined
              ? `${domesticChangePercent >= 0 ? "+" : ""}${domesticChangePercent.toFixed(2)}%`
              : "-"}
          </div>
          <div className="text-[10px] text-gray-500 dark:text-gray-400 whitespace-nowrap">
            {domesticChangeAmount !== undefined
              ? `${domesticChangeAmount >= 0 ? "+" : "-"}${formatPrice(
                  Math.abs(domesticChangeAmount),
                )}`
              : "-"}
          </div>
        </div>

        <div className="text-right tabular-nums">
          <div className="text-[13px] font-semibold whitespace-nowrap">
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

