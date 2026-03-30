"use client";

import { useClientHydrated } from "@/contexts/client-hydration-context";
import { useHasMounted } from "@/hooks/useHasMounted";

/** 뷰포트에 따라 폭. persist 복구 + 마운트 전에는 서버와 동일한 중립 클래스만 사용. */
export function MarketLayoutViewport({
  children,
}: {
  children: React.ReactNode;
}) {
  const clientHydrated = useClientHydrated();
  const mounted = useHasMounted();

  const isMobileViewport =
    clientHydrated &&
    mounted &&
    typeof window !== "undefined" &&
    window.matchMedia("(max-width: 767px)").matches;

  const widthClass =
    !clientHydrated || !mounted
      ? "w-full min-w-0 max-w-full"
      : isMobileViewport
        ? "min-w-[320px] max-w-[480px] w-full"
        : "min-w-[1400px] max-w-[1400px] w-full";

  return (
    <div
      className={`mx-auto box-border flex h-full min-h-0 w-full flex-col px-3 py-2 max-md:py-1.5 sm:px-4 sm:py-3 ${widthClass}`}
      suppressHydrationWarning
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}
