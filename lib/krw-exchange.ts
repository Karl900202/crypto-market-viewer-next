/**
 * 국내 원화 거래소 선택 값 — 스토어·API 파라미터·UI option value가 동일 문자열을 쓰도록 고정.
 */
export const KRW_EXCHANGE = {
  UPBIT: "업비트 KRW",
  BITHUMB: "빗썸 KRW",
  COINONE: "코인원 KRW",
} as const;

export type KrwExchangeId = (typeof KRW_EXCHANGE)[keyof typeof KRW_EXCHANGE];
