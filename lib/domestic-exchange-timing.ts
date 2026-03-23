/** 국내 거래소(업비트/빗썸/코인원) 공통 WS + REST 폴백 타이밍 */
export const DOMESTIC_EXCHANGE_TIMING = {
  /** WS 연결 후 이 시간이 지나면 adaptive REST 폴백 타이머 시작 */
  adaptiveFallbackAfterMs: 2500,
  /** adaptive 폴백 첫 스케줄 지연 */
  fallbackFirstScheduleMs: 1500,
  /** REST 폴링 백오프 초기값 (성공 시 리셋) */
  restBackoffInitialMs: 800,
  /** REST 폴링 백오프 상한 */
  restBackoffMaxMs: 5000,
} as const;

export type DomesticExchangeKind = "upbit" | "bithumb" | "coinone";

export type ConnectionStatus = "idle" | "connecting" | "live" | "degraded";
