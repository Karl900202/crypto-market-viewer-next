"use client";

import { useT } from "@/hooks/useT";
import {
  CoinListSkeletonBody,
  CoinListSkeletonTableHeader,
} from "./components/coin-list-skeleton";

/** 라우트 전환 시: 메인 페이지와 동일 폭·테이블 그리드 스켈레톤 */
export default function Loading() {
  const t = useT();

  return (
    <div className="flex h-full min-h-0 w-full gap-4">
      <aside className="flex w-[462px] shrink-0 flex-col overflow-hidden border-r border-[#e5e8eb] bg-white dark:border-gray-800 dark:bg-gray-900 min-h-0 min-w-0">
        <div className="shrink-0 border-b border-[#e5e8eb] px-3 py-3 dark:border-gray-800">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <div className="h-3.5 w-[72px] rounded bg-gray-200 dark:bg-gray-700 animate-skeleton" />
                <div className="h-9 w-[148px] shrink-0 rounded border border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-gray-800 animate-skeleton" />
              </div>
              <div className="h-3 max-w-[260px] rounded bg-gray-200 dark:bg-gray-700 animate-skeleton" />
            </div>
            <div className="h-3 w-14 shrink-0 rounded bg-gray-200 dark:bg-gray-700 animate-skeleton" />
          </div>
          <div className="mt-3 h-9 w-full rounded border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800 animate-skeleton" />
        </div>

        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-auto modern-scrollbar">
            <CoinListSkeletonTableHeader />
            <CoinListSkeletonBody />
          </div>
        </div>
      </aside>

      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex shrink-0 items-center justify-between gap-4 px-5 py-4">
          <div className="min-w-0 space-y-2">
            <div className="h-5 max-w-[200px] rounded bg-gray-200 dark:bg-gray-700 animate-skeleton" />
            <div className="h-4 max-w-[280px] rounded bg-gray-200 dark:bg-gray-700 animate-skeleton" />
          </div>
          <div className="shrink-0 space-y-2 text-right">
            <div className="ml-auto h-4 w-28 rounded bg-gray-200 dark:bg-gray-700 animate-skeleton" />
            <div className="ml-auto h-5 w-40 rounded bg-gray-200 dark:bg-gray-700 animate-skeleton" />
          </div>
        </div>
        <div className="relative flex min-h-[280px] flex-1 items-center justify-center p-4">
          <div
            className="h-11 w-11 animate-spin rounded-full border-[3px] border-yellow-400 border-t-transparent"
            role="status"
            aria-label={t("chart.loading")}
          />
        </div>
      </main>
    </div>
  );
}
