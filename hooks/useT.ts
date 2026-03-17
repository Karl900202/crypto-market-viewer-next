"use client";

import { useMemo } from "react";
import { translations, formatTemplate, type TranslationKey } from "@/i18n/translations";
import { useI18nStore } from "@/stores/useI18nStore";

export function useT() {
  const locale = useI18nStore((s) => s.locale);

  return useMemo(() => {
    return (key: TranslationKey, params?: Record<string, string | number>) => {
      const template = translations[locale][key] ?? key;
      return formatTemplate(template, params);
    };
  }, [locale]);
}

