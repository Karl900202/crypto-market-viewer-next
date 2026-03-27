"use client";

import React, { memo, useLayoutEffect, useRef, useState } from "react";
import { COIN_LIST_ROW_GRID_CLASS } from "./CoinRow";

/** CoinRow: 별(16px)+gap + 두 줄 텍스트 + py-2 — 가상 스크롤·스켈레톤 행 수 계산 */
export const COIN_LIST_ROW_ESTIMATE_PX = 56;

const SkeletonBar = memo(function SkeletonBar({
  className,
}: {
  className?: string;
}) {
  return (
    <div
      className={`rounded bg-gray-200 dark:bg-gray-700 animate-skeleton ${className ?? ""}`}
    />
  );
});

/** CoinRow 첫 칸: 별 16px + gap-1.5 + 두 줄 — 그리드 열 정렬과 동일 */
export const CoinListSkeletonRow = memo(function CoinListSkeletonRow() {
  return (
    <div
      className="flex w-full border-b border-[#eef1f5] bg-white px-3 py-2 dark:border-gray-800 dark:bg-gray-900"
      aria-hidden
    >
      <div className={`${COIN_LIST_ROW_GRID_CLASS} w-full items-center`}>
        <div className="flex min-w-0 items-center gap-1.5">
          <div
            className="h-4 w-4 shrink-0 rounded bg-gray-200 dark:bg-gray-700 animate-skeleton"
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <SkeletonBar className="h-3 w-28 max-w-full" />
            <SkeletonBar className="mt-1.5 h-2.5 w-12 max-w-full" />
          </div>
        </div>
        <SkeletonBar className="h-3 w-14 justify-self-end" />
        <div className="ml-1 flex justify-end justify-self-end">
          <SkeletonBar className="h-3 w-10" />
        </div>
        <SkeletonBar className="h-3 w-12 justify-self-end" />
        <SkeletonBar className="h-3 w-14 justify-self-end" />
      </div>
    </div>
  );
});

/** 스티키 컬럼 헤더와 동일 그리드·배경 (실제 테이블 헤더 자리) */
export const CoinListSkeletonTableHeader = memo(
  function CoinListSkeletonTableHeader() {
    return (
      <div
        className={`sticky top-0 z-[1] w-full min-w-0 font-normal ${COIN_LIST_ROW_GRID_CLASS} border-b border-[#e5e8eb] bg-[#f9fafb] px-3 py-2 dark:border-gray-800 dark:bg-gray-800/90`}
        aria-hidden
      >
        <SkeletonBar className="h-3 w-14" />
        <SkeletonBar className="h-3 w-8 justify-self-end" />
        <div className="ml-1 flex justify-end justify-self-end">
          <SkeletonBar className="h-3 w-7" />
        </div>
        <SkeletonBar className="h-3 w-10 justify-self-end" />
        <SkeletonBar className="h-3 w-12 justify-self-end" />
      </div>
    );
  },
);

export const CoinListSkeletonBody = memo(function CoinListSkeletonBody() {
  const fillRef = useRef<HTMLDivElement>(null);
  const [rowCount, setRowCount] = useState(20);

  useLayoutEffect(() => {
    const el = fillRef.current;
    if (!el) return;

    const measure = () => {
      const h = el.getBoundingClientRect().height;
      if (h < 1) return;
      const n = Math.ceil(h / COIN_LIST_ROW_ESTIMATE_PX) + 1;
      setRowCount(Math.min(150, Math.max(8, n)));
    };

    measure();
    const ro = new ResizeObserver(() => {
      measure();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={fillRef}
      className="flex min-h-0 w-full min-w-0 flex-1 flex-col"
    >
      {Array.from({ length: rowCount }).map((_, i) => (
        <CoinListSkeletonRow key={i} />
      ))}
    </div>
  );
});
