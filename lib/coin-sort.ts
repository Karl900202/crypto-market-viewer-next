import type { SortState } from "@/app/(market)/main/components/CoinListTable";

export function compareOptionalNumber(
  av: number | undefined,
  bv: number | undefined,
  dirMul: number,
): number {
  const aUndef = av === undefined || !Number.isFinite(av);
  const bUndef = bv === undefined || !Number.isFinite(bv);
  if (aUndef && bUndef) return 0;
  if (aUndef) return 1; // undefined는 항상 아래
  if (bUndef) return -1;
  return (av - bv) * dirMul;
}

export type CoinSortable = {
  name: string;
  symbol: string;
  domestic?: {
    price?: number;
    changePercent?: number;
    tradeValueKrw?: number;
  };
  korp?: number;
};

/**
 * 검색 필터 이후 목록 정렬 (default: 거래대금 내림차순)
 */
export function sortDisplayCoins<T extends CoinSortable>(
  items: readonly T[],
  sort: SortState,
): T[] {
  return [...items].sort((a, b) => {
    if (sort.mode === "default") {
      return compareOptionalNumber(
        a.domestic?.tradeValueKrw,
        b.domestic?.tradeValueKrw,
        -1,
      );
    }

    const dirMul = sort.dir === "asc" ? 1 : -1;

    if (sort.key === "korp")
      return compareOptionalNumber(a.korp, b.korp, dirMul);
    if (sort.key === "price")
      return compareOptionalNumber(
        a.domestic?.price,
        b.domestic?.price,
        dirMul,
      );
    if (sort.key === "change")
      return compareOptionalNumber(
        a.domestic?.changePercent,
        b.domestic?.changePercent,
        dirMul,
      );
    return compareOptionalNumber(
      a.domestic?.tradeValueKrw,
      b.domestic?.tradeValueKrw,
      dirMul,
    );
  });
}
