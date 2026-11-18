import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { safeLocalStorage } from "@/lib/safeStorage";

interface UiState {
  /** Rail replié en icônes seules (desktop) — état persisté. */
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  toggleCollapsed: () => void;

  /** « Aller à… » (Ctrl K) ouvert : jamais persisté. */
  paletteOpen: boolean;
  setPaletteOpen: (v: boolean) => void;

  /** La page affiche la rangée Exercice dans son propre bandeau : la rangée globale du haut s'efface. Jamais persisté. */
  bandeauIntegre: number;
  ajusterBandeauIntegre: (delta: number) => void;

  /** Compteur global de messages non lus (badge sidenav) */
  unreadMessages: number;
  setUnreadMessages: (n: number) => void;
}

export const useUi = create<UiState>()(
  persist(
    (set, get) => ({
      collapsed: false,
      setCollapsed: (v) => set({ collapsed: v }),
      toggleCollapsed: () => set({ collapsed: !get().collapsed }),

      paletteOpen: false,
      setPaletteOpen: (v) => set({ paletteOpen: v }),

      bandeauIntegre: 0,
      ajusterBandeauIntegre: (delta) => set((s) => ({ bandeauIntegre: Math.max(0, s.bandeauIntegre + delta) })),

      unreadMessages: 0,
      setUnreadMessages: (n) => set({ unreadMessages: n }),
    }),
    {
      name: "cabinet-ui",
      storage: createJSONStorage(() => safeLocalStorage),
      partialize: (s) => ({ collapsed: s.collapsed }),
    },
  ),
);
