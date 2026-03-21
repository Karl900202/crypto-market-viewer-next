"use client";

import Link from "next/link";
import { useState } from "react";
import { useThemeStore } from "@/stores/useThemeStore";
import { useI18nStore } from "@/stores/useI18nStore";
import { useT } from "@/hooks/useT";

export default function Header() {
  const t = useT();
  const locale = useI18nStore((s) => s.locale);
  const setLocale = useI18nStore((s) => s.setLocale);
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const isDark = theme === "dark";

  const [langHover, setLangHover] = useState(false);

  return (
    <header className="w-full shrink-0 border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      {/* 배경은 전체 너비, 안쪽 콘텐츠는 본문과 같은 max-width로 정렬 */}
      <div className="mx-auto flex h-16 w-full max-w-[1920px] items-center justify-between px-4">
        {/* Left: logo + nav */}
        <div className="flex min-w-0 shrink-0 items-center gap-8">
          <Link href="/" className="shrink-0 text-xl font-bold text-yellow-400">
            KORP
          </Link>

          <nav className="hidden items-center gap-6 md:flex">
            <Link
              href="/main"
              className="text-gray-900 transition-colors hover:text-yellow-400 dark:text-white"
            >
              {t("nav.home")}
            </Link>
          </nav>
        </div>

        {/* Right: language, theme, login */}
        <div className="flex shrink-0 items-center gap-4">
          {/* Language: 호버 시 중앙 정렬 드롭다운 */}
          <div
            className="relative flex cursor-pointer items-center gap-1.5"
            onMouseEnter={() => setLangHover(true)}
            onMouseLeave={() => setLangHover(false)}
          >
            <span className="text-gray-500 dark:text-gray-400" aria-hidden>
              <svg
                className="h-4 w-4 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <circle cx="12" cy="12" r="10" />
                <path
                  strokeLinecap="round"
                  d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"
                />
              </svg>
            </span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {locale === "ko" ? t("language.ko") : t("language.en")}
            </span>
            {/* pt-1: 트리거와 메뉴 사이 호버 끊김 방지 */}
            <div
              className={`absolute left-1/2 top-full z-50 -translate-x-1/2 pt-1 ${langHover ? "pointer-events-auto" : "pointer-events-none"}`}
              role="presentation"
            >
              <ul
                role="listbox"
                aria-label="Language"
                className={`min-w-[5.5rem] rounded-md border border-gray-200 bg-white py-1 shadow-md transition-opacity duration-150 dark:border-gray-600 dark:bg-gray-800 ${langHover ? "visible opacity-100" : "invisible opacity-0"}`}
              >
                <li role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={locale === "ko"}
                    className="w-full cursor-pointer px-3 py-2 text-center text-sm text-gray-900 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-700"
                    onClick={() => setLocale("ko")}
                  >
                    {t("language.ko")}
                  </button>
                </li>
                <li role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={locale === "en"}
                    className="w-full cursor-pointer px-3 py-2 text-center text-sm text-gray-900 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-700"
                    onClick={() => setLocale("en")}
                  >
                    {t("language.en")}
                  </button>
                </li>
              </ul>
            </div>
          </div>

          {/* Dark mode toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            className="cursor-pointer p-2 text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            aria-label={t("theme.toggle")}
          >
            {isDark ? "🌙" : "☀️"}
          </button>

          {/* Login button */}
          <button
            type="button"
            className="text-gray-900 transition-colors hover:text-yellow-400 dark:text-white"
          >
            {t("auth.login")}
          </button>
        </div>
      </div>
    </header>
  );
}
