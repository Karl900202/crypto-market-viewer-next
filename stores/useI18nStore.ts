import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Locale } from "@/i18n/translations";

type I18nState = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
};

export const LOCALE_STORAGE_KEY = "crypto-market-viewer-locale";

export const useI18nStore = create<I18nState>()(
  persist(
    (set, get) => ({
      locale: "ko",
      setLocale: (locale) => set({ locale }),
      toggleLocale: () => set({ locale: get().locale === "ko" ? "en" : "ko" }),
    }),
    {
      name: LOCALE_STORAGE_KEY,
      version: 1,
      partialize: (state) => ({ locale: state.locale }),
      skipHydration: true,
    },
  ),
);

