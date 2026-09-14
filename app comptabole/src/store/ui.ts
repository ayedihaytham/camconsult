import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { safeLocalStorage } from "@/lib/safeStorage";

interface UiState {
  /** Sidenav ouverte en overlay (mobile/tablette) */
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;

  /** Rail replié en icônes seules (desktop) — état persisté. */
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  toggleCollapsed: () => void;

  /** Compteur global de messages non lus (badge sidenav) */
  unreadMessages: number;
  setUnreadMessages: (n: number) => void;
}

export const useUi = create<UiState>()(
  persist(
    (set, get) => ({
      mobileOpen: false,
      setMobileOpen: (v) => set({ mobileOpen: v }),

      collapsed: false,
      setCollapsed: (v) => set({ collapsed: v }),
      toggleCollapsed: () => set({ collapsed: !get().collapsed }),

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
