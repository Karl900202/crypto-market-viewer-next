"use client";

import Link from "next/link";
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

  return (
    <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center space-x-8">
            <Link href="/" className="text-yellow-400 font-bold text-xl">
              KORP
            </Link>

            {/* Navigation */}
            <nav className="hidden md:flex space-x-6">
              <Link
                href="/main"
                className="text-gray-900 dark:text-white hover:text-yellow-400 transition-colors"
              >
                {t("nav.home")}
              </Link>
            </nav>
          </div>

          {/* Right side controls */}
          <div className="flex items-center space-x-4">
            {/* Language selector */}
            <div className="relative">
              <select
                value={locale}
                onChange={(e) =>
                  setLocale(e.target.value === "en" ? "en" : "ko")
                }
                className="bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-1 rounded border border-gray-300 dark:border-gray-700 cursor-pointer"
              >
                <option value="ko">{t("language.ko")}</option>
                <option value="en">{t("language.en")}</option>
              </select>
            </div>

            {/* Dark mode toggle */}
            <button
              onClick={toggleTheme}
              className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors p-2"
              aria-label={t("theme.toggle")}
            >
              {isDark ? "🌙" : "☀️"}
            </button>

            {/* Login button */}
            <button className="text-gray-900 dark:text-white hover:text-yellow-400 transition-colors">
              {t("auth.login")}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
