import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeMode = "dark" | "light";

type ThemeState = {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
};

export const THEME_STORAGE_KEY = "crypto-market-viewer-theme";

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: "dark",
      setTheme: (theme) => set({ theme }),
      toggleTheme: () =>
        set({ theme: get().theme === "dark" ? "light" : "dark" }),
    }),
    {
      name: THEME_STORAGE_KEY,
      version: 1,
      partialize: (state) => ({ theme: state.theme }),
      /** 서버 HTML과 첫 클라이언트 페인트를 동일하게 유지 (Next.js 하이드레이션) */
      skipHydration: true,
    },
  )
);

