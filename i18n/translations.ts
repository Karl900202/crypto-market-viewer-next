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
  | "market.shellLoading"
  | "market.connectionPending"
  | "market.connectionFailed"
  | "market.retryConnect"
  | "market.staleDataHidden"
  | "market.mobileBackToList"
  | "market.mobileBackAria"
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
  | "market.usdtKrwChartSubtitle"
  | "chart.placeholderTitle"
  | "chart.placeholderSubtitle"
  | "chart.binanceCaption"
  | "chart.captionDomesticUsdtKrw"
  | "chart.loading"
  | "chart.loadError"
  | "chart.noBinanceUsdtPair"
  | "chart.rangeTitle"
  | "chart.detailTitle"
  | "chart.timeframeTitle"
  | "chart.minutePlaceholder"
  | "chart.range1d"
  | "chart.range1w"
  | "chart.range1mo"
  | "chart.range1y"
  | "chart.int1m"
  | "chart.int3m"
  | "chart.int5m"
  | "chart.int10m"
  | "chart.int15m"
  | "chart.int30m"
  | "chart.int60m"
  | "chart.wsLive"
  | "chart.captionUsdtUsdcProxy"
  | "chart.caption10mAs15m"
  | "chart.legendO"
  | "chart.legendH"
  | "chart.legendL"
  | "chart.legendC"
  | "chart.legendV"
  | "chart.volumePaneTitle"
  | "chart.volumeUnit"
  | "chart.volumeUnitKrw";

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
    "market.shellLoading": "시세 목록·차트 준비 중…",
    "market.connectionPending": "연결 준비 중…",
    "market.connectionFailed": "연결이 원활하지 않아요.",
    "market.retryConnect": "재연결",
    "market.staleDataHidden": "이전 데이터는 숨겼어요. 재연결 후 표시됩니다.",
    "market.mobileBackToList": "목록",
    "market.mobileBackAria": "코인 목록으로 돌아가기",
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
    "market.usdtKrwChartSubtitle":
      "USDT/KRW · {exchange} KRW 캔들 (기준 거래소)",
    "chart.placeholderTitle": "Chart 영역 (추후 추가)",
    "chart.placeholderSubtitle":
      "여기에 차트/오더북/호가 등 위젯을 넣을 수 있어요.",
    "chart.binanceCaption":
      "바이낸스 USDT · 히스토리 로드 후 WebSocket으로 실시간 반영",
    "chart.captionDomesticUsdtKrw":
      "{exchange} KRW 현물 · REST 캔들 · 주기 갱신",
    "chart.loading": "차트 불러오는 중…",
    "chart.loadError": "캔들을 불러오지 못했어요.",
    "chart.noBinanceUsdtPair":
      "이 캔들 차트는 바이낸스 USDT 현물 쌍(예: BTCUSDT) 데이터만 쓰는데, 이 종목에 맞는 쌍이 없어 캔들을 그릴 수 없어요.",
    "chart.rangeTitle": "범위",
    "chart.detailTitle": "봉",
    "chart.timeframeTitle": "봉",
    "chart.minutePlaceholder": "분봉",
    "chart.range1d": "일",
    "chart.range1w": "주",
    "chart.range1mo": "월",
    "chart.range1y": "년",
    "chart.int1m": "1분",
    "chart.int3m": "3분",
    "chart.int5m": "5분",
    "chart.int10m": "10분",
    "chart.int15m": "15분",
    "chart.int30m": "30분",
    "chart.int60m": "60분",
    "chart.wsLive": "실시간",
    "chart.captionUsdtUsdcProxy":
      "※ USDT/USDT 현물 쌍은 없어 USDC/USDT(USDC의 USDT 가격) 캔들을 표시합니다.",
    "chart.caption10mAs15m":
      "※ 10분: 바이낸스에 10분 봉 없음 → 15분 봉으로 표시",
    "chart.legendO": "시",
    "chart.legendH": "고",
    "chart.legendL": "저",
    "chart.legendC": "종",
    "chart.legendV": "거래량",
    "chart.volumePaneTitle": "거래량",
    "chart.volumeUnit": "USDT",
    "chart.volumeUnitKrw": "KRW",
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
    "market.shellLoading": "Loading market list & chart…",
    "market.connectionPending": "Connecting…",
    "market.connectionFailed": "Connection is unstable.",
    "market.retryConnect": "Reconnect",
    "market.staleDataHidden": "Previous data is hidden until reconnection.",
    "market.mobileBackToList": "List",
    "market.mobileBackAria": "Back to coin list",
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
    "market.usdtKrwChartSubtitle":
      "USDT/KRW · {exchange} KRW candles (base exchange)",
    "chart.placeholderTitle": "Chart area (coming soon)",
    "chart.placeholderSubtitle":
      "You can add chart/order book widgets here later.",
    "chart.binanceCaption":
      "Binance USDT · history via REST, live updates via WebSocket",
    "chart.captionDomesticUsdtKrw":
      "{exchange} KRW spot · REST candles · periodic refresh",
    "chart.loading": "Loading candles…",
    "chart.loadError": "Could not load candles.",
    "chart.noBinanceUsdtPair":
      "This chart uses Binance USDT spot pairs (e.g. BTCUSDT). There is no matching pair for this asset, so candles cannot be drawn.",
    "chart.rangeTitle": "Range",
    "chart.detailTitle": "Interval",
    "chart.timeframeTitle": "Interval",
    "chart.minutePlaceholder": "Minutes",
    "chart.range1d": "1D",
    "chart.range1w": "1W",
    "chart.range1mo": "1M",
    "chart.range1y": "1Y",
    "chart.int1m": "1m",
    "chart.int3m": "3m",
    "chart.int5m": "5m",
    "chart.int10m": "10m",
    "chart.int15m": "15m",
    "chart.int30m": "30m",
    "chart.int60m": "60m",
    "chart.wsLive": "Live",
    "chart.captionUsdtUsdcProxy":
      "※ No USDT/USDT spot pair — showing USDC/USDT (USDC price in USDT) candles.",
    "chart.caption10mAs15m": "※ 10m: Binance has no 10m candle → 15m stream",
    "chart.legendO": "O",
    "chart.legendH": "H",
    "chart.legendL": "L",
    "chart.legendC": "C",
    "chart.legendV": "Vol",
    "chart.volumePaneTitle": "Volume",
    "chart.volumeUnit": "USDT",
    "chart.volumeUnitKrw": "KRW",
  },
};

export function formatTemplate(
  template: string,
  params?: Record<string, string | number>,
) {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const value = params[key];
    return value === undefined ? match : String(value);
  });
}
