/**
 * 차트 상단은 **하나의 봉/시간 단위만** 선택 (분봉 ↔ 일/주/월/년 봉 동시 선택 불가).
 * API `interval` + `range`는 이 값에서 파생.
 */

export type ChartTimeframe =
  | "1m"
  | "3m"
  | "5m"
  | "10m"
  | "15m"
  | "30m"
  | "60m"
  /** 일봉 */
  | "1D"
  /** 주봉 */
  | "1W"
  /** 월봉 */
  | "1Mo"
  /** 장기(월봉·넓은 범위) */
  | "1Y";

/** UI: 분봉은 드롭다운에만 나열 */
export const CHART_MINUTE_ORDER: ChartTimeframe[] = [
  "1m",
  "3m",
  "5m",
  "10m",
  "15m",
  "30m",
  "60m",
];

export const CHART_HIGHER_ORDER: ChartTimeframe[] = [
  "1D",
  "1W",
  "1Mo",
  "1Y",
];

export const CHART_TIMEFRAME_ORDER: ChartTimeframe[] = [
  ...CHART_MINUTE_ORDER,
  ...CHART_HIGHER_ORDER,
];

const MINUTE_TF_SET = new Set<ChartTimeframe>(CHART_MINUTE_ORDER);

export function isMinuteTimeframe(tf: ChartTimeframe): boolean {
  return MINUTE_TF_SET.has(tf);
}

/** Binance REST/WS `interval` */
export function timeframeToBinanceInterval(tf: ChartTimeframe): string {
  switch (tf) {
    case "10m":
      return "15m";
    case "60m":
      return "1h";
    case "1D":
      return "1d";
    case "1W":
      return "1w";
    case "1Mo":
    case "1Y":
      return "1M";
    default:
      return tf;
  }
}

/** API `range` 쿼리 키 (`app/api/binance/klines`의 RANGE_MS) */
export function timeframeToRangeKey(tf: ChartTimeframe): string {
  switch (tf) {
    case "1m":
    case "3m":
      return "1w";
    case "5m":
    case "10m":
    case "15m":
      return "1mo";
    case "30m":
    case "60m":
      return "1mo";
    case "1D":
      return "1y";
    case "1W":
      return "2y";
    case "1Mo":
      return "5y";
    case "1Y":
      return "10y";
  }
}

export function timeframeUses15mInsteadOf10m(tf: ChartTimeframe): boolean {
  return tf === "10m";
}
