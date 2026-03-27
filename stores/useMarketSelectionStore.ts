import { create } from "zustand";
import { persist } from "zustand/middleware";

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
      selectedExchange: "업비트 KRW",
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
      setSelectedExchangeAndRestoreSymbol: (exchange) => {
        const restored = get().selectedSymbolByExchange[exchange] ?? "BTC";
        set({
          selectedExchange: exchange,
          selectedSymbol: restored,
        });
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
