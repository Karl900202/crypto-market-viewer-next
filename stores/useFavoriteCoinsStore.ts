import { create } from "zustand";
import { persist } from "zustand/middleware";

export const FAVORITE_COINS_STORAGE_KEY = "crypto-viewer-favorite-coins";

type FavoriteCoinsState = {
  favorites: Record<string, true>;
  toggleFavorite: (symbol: string) => void;
};

export const useFavoriteCoinsStore = create<FavoriteCoinsState>()(
  persist(
    (set) => ({
      favorites: {},
      toggleFavorite: (symbol) =>
        set((state) => {
          const next = { ...state.favorites };
          if (next[symbol]) {
            delete next[symbol];
          } else {
            next[symbol] = true;
          }
          return { favorites: next };
        }),
    }),
    {
      name: FAVORITE_COINS_STORAGE_KEY,
      version: 1,
      partialize: (state) => ({ favorites: state.favorites }),
      skipHydration: true,
    },
  ),
);
