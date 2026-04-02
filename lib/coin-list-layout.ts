/**
 * 좌측 마켓 코인 테이블 그리드·스크롤 — CoinRow / 헤더 / 스켈레톤이 동일 값을 공유.
 */

export type CoinListLayoutVariant = "split" | "stacked";

export const COIN_LIST_ROW_GRID_CLASS =
  "grid grid-cols-[minmax(0,1fr)_84px_58px_64px_72px] gap-x-2 gap-y-0 items-stretch";

export const COIN_LIST_ROW_CELL_CLASS =
  "flex h-full min-h-0 flex-col justify-center self-stretch";

/** split | stacked — 현재 동일(가로 스크롤 없이 패널 폭에 맞춤). 분기 시 이 함수만 수정. */
export function coinListRowGridClass(_layout: CoinListLayoutVariant): string {
  return COIN_LIST_ROW_GRID_CLASS;
}

/** 스티키 헤더: rowGridClass(그리드 열)와 결합 */
export const COIN_LIST_STICKY_HEADER_CLASS =
  "sticky top-0 z-[1] w-full min-w-0 bg-muted px-3 py-2.5 font-normal";

export const COIN_LIST_SCROLL_AREA_CLASS =
  "modern-scrollbar flex h-full min-h-0 min-w-0 flex-1 touch-pan-y flex-col overflow-y-auto overflow-x-hidden overscroll-y-contain [-webkit-overflow-scrolling:touch]";
