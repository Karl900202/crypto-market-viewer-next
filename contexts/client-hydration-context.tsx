"use client";

import { createContext, useContext } from "react";

/** persist 재수화 + 첫 페인트 이후에만 true — 서버 HTML과 첫 클라이언트 트리 일치 */
const ClientHydrationContext = createContext(false);

export function ClientHydrationProvider({
  value,
  children,
}: {
  value: boolean;
  children: React.ReactNode;
}) {
  return (
    <ClientHydrationContext.Provider value={value}>
      {children}
    </ClientHydrationContext.Provider>
  );
}

export function useClientHydrated(): boolean {
  return useContext(ClientHydrationContext);
}
