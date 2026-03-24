"use client";

import React, { memo, useCallback } from "react";
import {
  domesticTickerVmSnapshot,
  type DomesticTickerVM,
} from "@/lib/domestic-ticker-vm";
import { getCoinEnglishDisplayName } from "@/lib/coin-english-display-name";
import type { NameColumnMode } from "@/lib/name-column-mode";

/** 좌측 마켓 패널(~462px) 기준: 이름 열에 가로 여유 — items-stretch로 컬럼 높이 통일 */
export const COIN_LIST_ROW_GRID_CLASS =
  "grid grid-cols-[minmax(0,1fr)_76px_56px_72px_70px] gap-x-1.5 gap-y-0 items-stretch";

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
  korp?: number;
  domestic?: DomesticTickerVM;
  globalPriceKrw?: number;
  isSelected: boolean;
  flash: PriceFlashDir;
  onSelect: (symbol: string) => void;
  formatPrice: (price: number) => string;
  formatTradeValueInMillionsKrw: (valueKrw: number) => string;
};

export const CoinRow = memo(
  function CoinRow(props: CoinRowProps) {
    const {
      symbol,
      name,
      nameColumnMode,
      korp,
      domestic,
      globalPriceKrw,
      isSelected,
      flash,
      onSelect,
      formatPrice,
      formatTradeValueInMillionsKrw,
    } = props;

    const handleClick = useCallback(() => onSelect(symbol), [onSelect, symbol]);

    const domPrice = domestic?.price;
    const globalKrw = globalPriceKrw;
    const domesticChangePercent = domestic?.changePercent;
    const domesticChangeAmount = domestic?.changeAmount;
    const domesticTradeValueKrw = domestic?.tradeValueKrw;
    const pairLabel = `${symbol}/KRW`;
    const primaryName =
      nameColumnMode === "korean" ? name : getCoinEnglishDisplayName(symbol);

    return (
      <button
        type="button"
        onClick={handleClick}
        className={`w-full overflow-hidden border-b border-[#eef1f5] px-3 py-2 text-left font-normal transition-colors hover:bg-[#f7f9fc] dark:border-gray-800 dark:hover:bg-gray-800/80 ${
          isSelected
            ? "bg-[#e9f0ff] hover:bg-[#e0ebff] dark:bg-blue-950/35 dark:hover:bg-blue-950/45"
            : "bg-white dark:bg-gray-900"
        }`}
      >
        <div className={COIN_LIST_ROW_GRID_CLASS}>
          <div className={`min-w-0 text-left ${COIN_LIST_ROW_CELL_CLASS}`}>
            <div
              className="truncate text-[12px] font-normal leading-snug text-gray-900 dark:text-white"
              title={primaryName}
            >
              {primaryName}
            </div>
            <div
              className="truncate text-[11px] font-normal leading-tight text-[#8b94a1] dark:text-gray-500"
              title={pairLabel}
            >
              {pairLabel}
            </div>
          </div>

          <div
            className={`${COIN_LIST_ROW_CELL_CLASS} w-full items-end text-right tabular-nums border border-transparent box-border px-2 py-0.5 ${
              flash ? "animate-price-border-flash" : ""
            }`}
          >
            <div
              className={`text-[12px] font-normal tabular-nums ${upDownTextClass(domesticChangePercent)} ${
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
            className={`ml-1 text-right tabular-nums ${COIN_LIST_ROW_CELL_CLASS}`}
          >
            {korp !== undefined ? (
              <div>
                <div
                  className={`text-[12px] font-normal tabular-nums ${korpTextClass(korp)}`}
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
    a.korp === b.korp &&
    domesticTickerVmSnapshot(a.domestic) ===
      domesticTickerVmSnapshot(b.domestic) &&
    a.globalPriceKrw === b.globalPriceKrw &&
    a.isSelected === b.isSelected &&
    a.flash === b.flash &&
    a.onSelect === b.onSelect &&
    a.formatPrice === b.formatPrice &&
    a.formatTradeValueInMillionsKrw === b.formatTradeValueInMillionsKrw,
);
