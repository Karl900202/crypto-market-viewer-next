/** 코인 가격 표시 (테이블·패널 공통, 모듈 스코프로 참조 안정화) */
export function formatPrice(price: number) {
  if (!Number.isFinite(price)) return "-";
  const abs = Math.abs(price);
  const maximumFractionDigits =
    abs >= 1000 ? 0 : abs >= 1 ? 2 : abs >= 0.01 ? 4 : abs >= 0.0001 ? 6 : 8;
  return price.toLocaleString("ko-KR", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  });
}

export function formatTradeValueInMillionsKrw(valueKrw: number) {
  const millions = Math.round(valueKrw / 1_000_000);
  return `${millions.toLocaleString("ko-KR")}백만`;
}
