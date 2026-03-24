"use client";

import React, { memo } from "react";

type ConnectionStatus = "idle" | "connecting" | "live" | "degraded";

type TFn = (key: string, params?: Record<string, string | number>) => string;

/** 국내 WS 미준비 시 동일 카드 UI (거래소별로 status만 다름) */
export const CoinListExchangePending = memo(function CoinListExchangePending({
  status,
  t,
}: {
  status: ConnectionStatus;
  t: TFn;
}) {
  const iconClass =
    status === "connecting"
      ? "text-yellow-500"
      : status === "degraded"
        ? "text-orange-500"
        : "text-gray-400";

  return (
    <div className="p-4 font-normal">
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3">
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 shrink-0 ${iconClass}`} aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path
                fill="currentColor"
                d="M12 6V3L8 7l4 4V8c2.76 0 5 2.24 5 5a5 5 0 0 1-8.66 3.54l-1.42 1.42A7 7 0 1 0 12 6z"
              />
            </svg>
          </div>

          <div className="min-w-0 flex-1">
            <div className="text-sm font-normal text-gray-900 dark:text-white">
              {status === "degraded"
                ? t("market.connectionFailed")
                : t("market.connectionPending")}
            </div>
            <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
              {t("market.staleDataHidden")}
            </div>
          </div>

          <div className="shrink-0 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
            {t("market.connectionPending")}
          </div>
        </div>
      </div>
    </div>
  );
});
