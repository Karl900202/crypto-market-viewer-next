"use client";

import Link from "next/link";
import { useState } from "react";

export default function Header() {
  const [isDark, setIsDark] = useState(true);
  const [language, setLanguage] = useState("KR");

  return (
    <header className="bg-gray-900 border-b border-gray-800">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center space-x-8">
            <Link href="/" className="text-yellow-400 font-bold text-xl">
              KARL-PRICE
            </Link>

            {/* Navigation */}
            <nav className="hidden md:flex space-x-6">
              <Link
                href="/main"
                className="text-white hover:text-yellow-400 transition-colors"
              >
                홈
              </Link>
            </nav>
          </div>

          {/* Right side controls */}
          <div className="flex items-center space-x-4">
            {/* Language selector */}
            <div className="relative">
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="bg-gray-800 text-white px-3 py-1 rounded border border-gray-700 cursor-pointer"
              >
                <option value="KR">KR</option>
                <option value="EN">EN</option>
              </select>
            </div>

            {/* Dark mode toggle */}
            <button
              onClick={() => setIsDark(!isDark)}
              className="text-gray-400 hover:text-white transition-colors p-2"
              aria-label="Toggle dark mode"
            >
              {isDark ? "🌙" : "☀️"}
            </button>

            {/* Login button */}
            <button className="text-white hover:text-yellow-400 transition-colors">
              로그인
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
