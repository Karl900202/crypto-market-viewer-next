"use client";

import {
  COIN_LIST_ROW_CELL_CLASS,
  COIN_LIST_ROW_GRID_CLASS,
} from "./CoinRow";

export function MarketListSkeletonRow({ keyProp }: { keyProp: number }) {
  void keyProp;
  return (
    <div className="border-b border-[#eef1f5] bg-white px-3 py-2 dark:border-gray-800">
      <div className={COIN_LIST_ROW_GRID_CLASS}>
        <div className={`min-w-0 ${COIN_LIST_ROW_CELL_CLASS}`}>
          <div className="h-3 w-28 bg-gray-200 dark:bg-gray-700 rounded animate-skeleton" />
          <div className="mt-1 h-2.5 w-12 bg-gray-200 dark:bg-gray-700 rounded animate-skeleton" />
        </div>
        <div className={`${COIN_LIST_ROW_CELL_CLASS} items-end`}>
          <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-skeleton" />
        </div>
        <div className={`ml-1 ${COIN_LIST_ROW_CELL_CLASS} items-end`}>
          <div className="h-3 w-10 bg-gray-200 dark:bg-gray-700 rounded animate-skeleton" />
        </div>
        <div className={`${COIN_LIST_ROW_CELL_CLASS} items-end`}>
          <div className="h-3 w-12 bg-gray-200 dark:bg-gray-700 rounded animate-skeleton" />
        </div>
        <div className={`${COIN_LIST_ROW_CELL_CLASS} items-end`}>
          <div className="h-3 w-14 bg-gray-200 dark:bg-gray-700 rounded animate-skeleton" />
        </div>
      </div>
    </div>
  );
}
