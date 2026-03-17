"use client";

import { useEffect, useState } from "react";
import { THEME_STORAGE_KEY, useThemeStore, type ThemeMode } from "@/stores/useThemeStore";

function applyThemeClass(theme: ThemeMode) {
  const root = document.documentElement;
  if (theme === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY) ?? "";
      const parsed = stored ? (JSON.parse(stored) as { state?: { theme?: ThemeMode } }) : null;
      const storedTheme = parsed?.state?.theme;

      if (!storedTheme) {
        const prefersDark =
          typeof window !== "undefined" &&
          window.matchMedia?.("(prefers-color-scheme: dark)")?.matches;
        setTheme(prefersDark ? "dark" : "light");
      }
    } catch {
      // ignore storage/JSON errors
    }
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mounted) return;
    applyThemeClass(theme);
  }, [mounted, theme]);

  return children;
}

