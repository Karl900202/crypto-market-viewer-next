/**
 * 국내 거래소 티커 데이터의 프론트엔드 통합 View Model
 * 모든 거래소(업비트/빗썸/코인원) DTO를 이 형식으로 변환해 일관되게 사용
 */
export interface DomesticTickerVM {
  price: number;
  changePercent?: number;
  changeAmount?: number;
  tradeValueKrw?: number;
}

export type DomesticTickerVMPartial = Partial<DomesticTickerVM>;

// --- Upbit ---

/** Upbit 워커(WS) tick 메시지 */
export interface UpbitWsTick {
  market: string;
  tradePrice: number;
  signedChangeRate: number;
  signedChangePrice: number;
  accTradePrice24h: number;
}

export function mapUpbitWsTickToVM(tick: UpbitWsTick): DomesticTickerVM {
  return {
    price: tick.tradePrice,
    changePercent: tick.signedChangeRate * 100,
    changeAmount: tick.signedChangePrice,
    tradeValueKrw: tick.accTradePrice24h,
  };
}

/** Upbit REST ticker 응답 */
export interface UpbitRestTicker {
  market?: string;
  code?: string;
  trade_price: number;
  signed_change_rate: number;
  signed_change_price: number;
  acc_trade_price_24h: number;
}

export function mapUpbitRestTickerToVM(
  item: UpbitRestTicker,
  symbol: string,
): { symbol: string; vm: DomesticTickerVM } {
  return {
    symbol,
    vm: {
      price: item.trade_price,
      changePercent: item.signed_change_rate * 100,
      changeAmount: item.signed_change_price,
      tradeValueKrw: item.acc_trade_price_24h,
    },
  };
}

// --- Bithumb ---

/** Bithumb 워커(WS) tick 메시지 */
export interface BithumbWsTick {
  symbol: string;
  closePrice: number;
  changeRatePercent?: number;
  changeAmount?: number;
  tradeValueKrw?: number;
}

export function mapBithumbWsTickToVM(tick: BithumbWsTick): DomesticTickerVM {
  const vm: DomesticTickerVM = { price: tick.closePrice };
  if (tick.changeRatePercent !== undefined)
    vm.changePercent = tick.changeRatePercent;
  if (tick.changeAmount !== undefined) vm.changeAmount = tick.changeAmount;
  if (tick.tradeValueKrw !== undefined)
    vm.tradeValueKrw = tick.tradeValueKrw;
  return vm;
}

/** Bithumb REST ticker 응답 (개별 티커) */
export interface BithumbRestTicker {
  closing_price: string;
  prev_closing_price: string;
  acc_trade_value_24H?: string;
  acc_trade_value?: string;
}

export function mapBithumbRestTickerToVM(
  ticker: BithumbRestTicker,
  symbol: string,
): { symbol: string; vm: DomesticTickerVM } | null {
  const close = parseFloat(ticker.closing_price);
  const prevClose = parseFloat(ticker.prev_closing_price);
  if (!Number.isFinite(close)) return null;
  const vm: DomesticTickerVM = { price: close };
  if (
    Number.isFinite(prevClose) &&
    prevClose !== 0
  ) {
    vm.changeAmount = close - prevClose;
    vm.changePercent = (vm.changeAmount / prevClose) * 100;
  }
  const tradeValue = parseFloat(
    (ticker.acc_trade_value_24H ?? ticker.acc_trade_value) as string,
  );
  if (Number.isFinite(tradeValue)) vm.tradeValueKrw = tradeValue;
  return { symbol, vm };
}

// --- Coinone ---

/** Coinone 워커(WS) tick 메시지 (Bithumb과 동일 출력 형식) */
export interface CoinoneWsTick {
  symbol: string;
  closePrice: number;
  changeRatePercent?: number;
  changeAmount?: number;
  tradeValueKrw?: number;
}

export function mapCoinoneWsTickToVM(tick: CoinoneWsTick): DomesticTickerVM {
  const vm: DomesticTickerVM = { price: tick.closePrice };
  if (tick.changeRatePercent !== undefined)
    vm.changePercent = tick.changeRatePercent;
  if (tick.changeAmount !== undefined) vm.changeAmount = tick.changeAmount;
  if (tick.tradeValueKrw !== undefined)
    vm.tradeValueKrw = tick.tradeValueKrw;
  return vm;
}

/** Coinone REST ticker 응답 */
export interface CoinoneRestTicker {
  target_currency: string;
  last: string;
  first: string;
  quote_volume?: string;
}

export function mapCoinoneRestTickerToVM(
  t: CoinoneRestTicker,
): { symbol: string; vm: DomesticTickerVM } | null {
  const symbol =
    t.target_currency?.toUpperCase?.() ?? t.target_currency;
  if (!symbol) return null;
  const last = parseFloat(t.last);
  if (!Number.isFinite(last)) return null;
  const vm: DomesticTickerVM = { price: last };
  const first = parseFloat(t.first);
  if (Number.isFinite(first) && first !== 0) {
    vm.changeAmount = last - first;
    vm.changePercent = (vm.changeAmount / first) * 100;
  }
  const vol = parseFloat(t.quote_volume ?? "0");
  if (Number.isFinite(vol)) vm.tradeValueKrw = vol;
  return { symbol, vm };
}

// --- 공통: VM 병합 헬퍼 ---

export function mergeDomesticTickerVM(
  existing: DomesticTickerVM | undefined,
  update: DomesticTickerVMPartial,
): DomesticTickerVM {
  if (!existing)
    return {
      price: update.price ?? 0,
      changePercent: update.changePercent,
      changeAmount: update.changeAmount,
      tradeValueKrw: update.tradeValueKrw,
    };
  return {
    price: update.price ?? existing.price,
    changePercent:
      update.changePercent !== undefined
        ? update.changePercent
        : existing.changePercent,
    changeAmount:
      update.changeAmount !== undefined
        ? update.changeAmount
        : existing.changeAmount,
    tradeValueKrw:
      update.tradeValueKrw !== undefined
        ? update.tradeValueKrw
        : existing.tradeValueKrw,
  };
}
