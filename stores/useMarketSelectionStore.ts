import { create } from "zustand";
import { persist } from "zustand/middleware";
import { KRW_EXCHANGE } from "@/lib/krw-exchange";

export const MARKET_SELECTION_STORAGE_KEY = "crypto-viewer-market-selection";

type SelectedSymbolByExchange = Record<string, string>;

type MarketSelectionState = {
  selectedExchange: string;
  selectedSymbol: string;
  selectedSymbolByExchange: SelectedSymbolByExchange;
  setSelectedSymbol: (symbol: string) => void;
  setSelectedExchangeAndRestoreSymbol: (exchange: string) => void;
};

export const useMarketSelectionStore = create<MarketSelectionState>()(
  persist(
    (set, get) => ({
      selectedExchange: KRW_EXCHANGE.UPBIT,
      selectedSymbol: "BTC",
      selectedSymbolByExchange: {},
      setSelectedSymbol: (symbol) => {
        const exchange = get().selectedExchange;
        set((state) => ({
          selectedSymbol: symbol,
          selectedSymbolByExchange: {
            ...state.selectedSymbolByExchange,
            [exchange]: symbol,
          },
        }));
      },
      /** 거래소만 바꿈. 선택 심볼은 상장 목록 로드 후 `page.tsx`에서 현재 심볼 유지 여부로 확정 */
      setSelectedExchangeAndRestoreSymbol: (exchange) => {
        set({ selectedExchange: exchange });
      },
    }),
    {
      name: MARKET_SELECTION_STORAGE_KEY,
      version: 1,
      partialize: (state) => ({
        selectedExchange: state.selectedExchange,
        selectedSymbol: state.selectedSymbol,
        selectedSymbolByExchange: state.selectedSymbolByExchange,
      }),
    },
  ),
);
