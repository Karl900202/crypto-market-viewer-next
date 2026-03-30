"use client";

import { useEffect, useState } from "react";
import { ClientHydrationProvider } from "@/contexts/client-hydration-context";
import { useFavoriteCoinsStore } from "@/stores/useFavoriteCoinsStore";
import { useI18nStore } from "@/stores/useI18nStore";
import { useMarketSelectionStore } from "@/stores/useMarketSelectionStore";
import { THEME_STORAGE_KEY, useThemeStore, type ThemeMode } from "@/stores/useThemeStore";

function applyThemeClass(theme: ThemeMode) {
  const root = document.documentElement;
  if (theme === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  /** persist 복구 완료 전에는 false — 하이드레이션과 첫 페인트를 서버와 동일하게 유지 */
  const [clientHydrated, setClientHydrated] = useState(false);

  useEffect(() => {
    void (async () => {
      await Promise.all([
        useThemeStore.persist.rehydrate(),
        useI18nStore.persist.rehydrate(),
        useMarketSelectionStore.persist.rehydrate(),
        useFavoriteCoinsStore.persist.rehydrate(),
      ]).catch(() => {});

      setClientHydrated(true);

      try {
        const stored = localStorage.getItem(THEME_STORAGE_KEY) ?? "";
        const parsed = stored
          ? (JSON.parse(stored) as { state?: { theme?: ThemeMode } })
          : null;
        const storedTheme = parsed?.state?.theme;

        if (!storedTheme) {
          const prefersDark =
            window.matchMedia?.("(prefers-color-scheme: dark)")?.matches;
          setTheme(prefersDark ? "dark" : "light");
        }
      } catch {
        // ignore storage/JSON errors
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!clientHydrated) return;
    applyThemeClass(theme);
  }, [clientHydrated, theme]);

  return (
    <ClientHydrationProvider value={clientHydrated}>
      {children}
    </ClientHydrationProvider>
  );
}

