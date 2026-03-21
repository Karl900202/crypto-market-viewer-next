"use client";

import { useT } from "@/hooks/useT";

export default function Loading() {
  const t = useT();
  const SkeletonRow = ({ i }: { i: number }) => (
    <div
      key={i}
      className="px-2 py-2.5 border-b border-gray-100 dark:border-gray-800"
    >
      <div className="grid grid-cols-[minmax(0,1fr)_88px_52px_64px_64px] gap-1.5 items-center">
        <div className="min-w-0">
          <div className="h-3 w-28 bg-gray-200 dark:bg-gray-700 rounded animate-skeleton" />
          <div className="mt-1 h-2.5 w-12 bg-gray-200 dark:bg-gray-700 rounded animate-skeleton" />
        </div>
        <div className="h-3 w-16 ml-auto bg-gray-200 dark:bg-gray-700 rounded animate-skeleton" />
        <div className="ml-[2px] flex justify-end">
          <div className="h-3 w-10 bg-gray-200 dark:bg-gray-700 rounded animate-skeleton" />
        </div>
        <div className="h-3 w-12 ml-auto bg-gray-200 dark:bg-gray-700 rounded animate-skeleton" />
        <div className="h-3 w-14 ml-auto bg-gray-200 dark:bg-gray-700 rounded animate-skeleton" />
      </div>
    </div>
  );

  return (
    <div className="h-full bg-white dark:bg-gray-900 text-gray-900 dark:text-white overflow-hidden">
      <div className="mx-auto max-w-[1600px] px-2 py-2 h-full">
        <div className="flex gap-2 h-full">
          {/* Left panel skeleton */}
          <aside className="w-[440px] shrink-0 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden flex flex-col min-h-0">
            <div className="border-b border-gray-200 dark:border-gray-800 p-2 shrink-0">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    {t("market.baseExchange")}
                  </span>
                  <div className="h-6 w-28 bg-gray-200 dark:bg-gray-700 rounded animate-skeleton" />
                </div>
                <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-skeleton" />
              </div>
              <div className="mt-2">
                <div className="h-9 w-full bg-gray-200 dark:bg-gray-700 rounded-lg animate-skeleton" />
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-hidden">
              <div className="grid grid-cols-[minmax(0,1fr)_88px_52px_64px_64px] gap-1.5 px-2 py-2 text-[10px] text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800 overflow-x-hidden">
                <div>{t("table.name")}</div>
                <div className="text-right">{t("table.price")}</div>
                <div className="ml-1 text-right">{t("table.korp")}</div>
                <div className="text-right">{t("table.change24h")}</div>
                <div className="text-right">{t("table.volume24h")}</div>
              </div>
              <div className="overflow-y-auto overflow-x-hidden">
                {Array.from({ length: 12 }).map((_, i) => (
                  <SkeletonRow key={i} i={i} />
                ))}
              </div>
            </div>
          </aside>

          {/* Right panel skeleton */}
          <main className="flex-1 min-w-0 min-h-0">
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden h-full flex flex-col min-h-0">
              <div className="border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center justify-between gap-4 shrink-0">
                <div className="min-w-0">
                  <div className="h-4 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-skeleton" />
                  <div className="mt-2 h-3 w-56 bg-gray-200 dark:bg-gray-700 rounded animate-skeleton" />
                </div>
                <div className="text-right">
                  <div className="h-3 w-32 ml-auto bg-gray-200 dark:bg-gray-700 rounded animate-skeleton" />
                  <div className="mt-2 h-4 w-40 ml-auto bg-gray-200 dark:bg-gray-700 rounded animate-skeleton" />
                </div>
              </div>

              <div className="p-4 flex-1 min-h-0">
                <div className="h-full rounded-xl border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex items-center justify-center">
                  <div className="text-center">
                    <div className="h-4 w-44 bg-gray-200 dark:bg-gray-700 rounded animate-skeleton mx-auto" />
                    <div className="mt-2 h-3 w-64 bg-gray-200 dark:bg-gray-700 rounded animate-skeleton mx-auto" />
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
