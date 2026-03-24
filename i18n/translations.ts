export type Locale = "ko" | "en";

export type TranslationKey =
  | "nav.home"
  | "auth.login"
  | "theme.toggle"
  | "language.ko"
  | "language.en"
  | "market.baseExchange"
  | "market.globalReference"
  | "market.globalReferenceHint"
  | "market.totalCoins"
  | "market.searchPlaceholder"
  | "market.exchangeLoading"
  | "market.connectionPending"
  | "market.connectionFailed"
  | "market.retryConnect"
  | "market.staleDataHidden"
  | "table.name"
  | "table.nameHeaderKorean"
  | "table.nameHeaderEnglish"
  | "table.nameToggleToEnglish"
  | "table.nameToggleToKorean"
  | "table.price"
  | "table.korp"
  | "table.change24h"
  | "table.highDiff"
  | "table.lowDiff"
  | "table.volume24h"
  | "market.binanceUsdtMarket"
  | "chart.placeholderTitle"
  | "chart.placeholderSubtitle";

export const translations: Record<Locale, Record<TranslationKey, string>> = {
  ko: {
    "nav.home": "홈",
    "auth.login": "로그인",
    "theme.toggle": "다크 모드 토글",
    "language.ko": "KR",
    "language.en": "EN",
    "market.baseExchange": "기준 거래소",
    "market.globalReference": "글로벌 기준",
    "market.globalReferenceHint":
      "글로벌 시세/KorP 계산은 바이낸스 USDT 가격을 KRW로 환산해 사용합니다.",
    "market.totalCoins": "암호화폐 총 {count}개",
    "market.searchPlaceholder": "Q BTC, 비트코인",
    "market.exchangeLoading": "{exchange} 거래소 데이터 로딩 중...",
    "market.connectionPending": "연결 준비 중…",
    "market.connectionFailed": "연결이 원활하지 않아요.",
    "market.retryConnect": "재연결",
    "market.staleDataHidden": "이전 데이터는 숨겼어요. 재연결 후 표시됩니다.",
    "table.name": "한글명",
    "table.nameHeaderKorean": "한글명",
    "table.nameHeaderEnglish": "영문명",
    "table.nameToggleToEnglish": "영문명으로 전환",
    "table.nameToggleToKorean": "한글명으로 전환",
    "table.price": "현재가",
    "table.korp": "KorP",
    "table.change24h": "전일대비",
    "table.highDiff": "고가대비(전일)",
    "table.lowDiff": "저가대비(전일)",
    "table.volume24h": "거래대금",
    "market.binanceUsdtMarket": "바이낸스 USDT 마켓",
    "chart.placeholderTitle": "Chart 영역 (추후 추가)",
    "chart.placeholderSubtitle":
      "여기에 차트/오더북/호가 등 위젯을 넣을 수 있어요.",
  },
  en: {
    "nav.home": "Home",
    "auth.login": "Login",
    "theme.toggle": "Toggle theme",
    "language.ko": "KR",
    "language.en": "EN",
    "market.baseExchange": "Base exchange",
    "market.globalReference": "Global reference",
    "market.globalReferenceHint":
      "Global price/KorP uses Binance USDT prices converted to KRW.",
    "market.totalCoins": "Total coins: {count}",
    "market.searchPlaceholder": "Search: BTC, Bitcoin",
    "market.exchangeLoading": "Loading {exchange} market data...",
    "market.connectionPending": "Connecting…",
    "market.connectionFailed": "Connection is unstable.",
    "market.retryConnect": "Reconnect",
    "market.staleDataHidden": "Previous data is hidden until reconnection.",
    "table.name": "Name",
    "table.nameHeaderKorean": "Korean name",
    "table.nameHeaderEnglish": "English name",
    "table.nameToggleToEnglish": "Show English names",
    "table.nameToggleToKorean": "Show Korean names",
    "table.price": "Price",
    "table.korp": "KorP",
    "table.change24h": "24h change",
    "table.highDiff": "From high (24h)",
    "table.lowDiff": "From low (24h)",
    "table.volume24h": "Turnover",
    "market.binanceUsdtMarket": "Binance USDT market",
    "chart.placeholderTitle": "Chart area (coming soon)",
    "chart.placeholderSubtitle":
      "You can add chart/order book widgets here later.",
  },
};

export function formatTemplate(
  template: string,
  params?: Record<string, string | number>
) {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const value = params[key];
    return value === undefined ? match : String(value);
  });
}

