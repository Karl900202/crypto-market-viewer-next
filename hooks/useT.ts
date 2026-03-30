"use client";

import { useMemo } from "react";
import { useClientHydrated } from "@/contexts/client-hydration-context";
import {
  translations,
  formatTemplate,
  type Locale,
  type TranslationKey,
} from "@/i18n/translations";
import { useI18nStore } from "@/stores/useI18nStore";

/** persist 복구·ClientHydrationProvider 전에는 스토어와 동일한 SSR 초기값만 사용 → 하이드레이션 일치 */
const SSR_LOCALE: Locale = "ko";

export function useT() {
  const locale = useI18nStore((s) => s.locale);
  const clientHydrated = useClientHydrated();
  const effectiveLocale = clientHydrated ? locale : SSR_LOCALE;

  return useMemo(() => {
    return (key: TranslationKey, params?: Record<string, string | number>) => {
      const template = translations[effectiveLocale][key] ?? key;
      return formatTemplate(template, params);
    };
  }, [effectiveLocale]);
}

