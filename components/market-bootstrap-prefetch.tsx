"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { prefetchMarketBootstrap } from "@/lib/market-bootstrap";

/** 마켓 레이아웃 마운트 시 `/main` 라우트·핵심 API 응답을 미리 워밍 */
export function MarketBootstrapPrefetch() {
  const router = useRouter();
  useEffect(() => {
    router.prefetch("/main");
    prefetchMarketBootstrap();
  }, [router]);
  return null;
}
