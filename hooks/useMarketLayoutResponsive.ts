import { useClientHydrated } from "@/contexts/client-hydration-context";
import { useHasMounted } from "@/hooks/useHasMounted";

const MOBILE_MAX_PX = 767;

/**
 * 데스크톱: 항상 좌우 분할 · 모바일: 항상 목록/차트 전환(stacked).
 * persist 복구 전에는 뷰포트 기반 레이아웃을 쓰지 않음 → 하이드레이션 안전.
 */
export function useMarketLayoutResponsive() {
  const clientHydrated = useClientHydrated();
  const mounted = useHasMounted();

  const isMobileViewport =
    clientHydrated &&
    mounted &&
    typeof window !== "undefined" &&
    window.matchMedia(`(max-width: ${MOBILE_MAX_PX}px)`).matches;

  /** 마운트·matchMedia 준비 후에만 모바일=stacked 판정 */
  const isStacked =
    clientHydrated && mounted && isMobileViewport;

  return {
    mounted,
    clientHydrated,
    isMobileViewport,
    isStacked,
  };
}
