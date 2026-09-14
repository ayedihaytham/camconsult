import { create } from "zustand";

interface UiState {
  /** Sidenav ouverte en overlay (mobile/tablette) */
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;

  /** Compteur global de messages non lus (badge sidenav) */
  unreadMessages: number;
  setUnreadMessages: (n: number) => void;
}

export const useUi = create<UiState>()((set) => ({
  mobileOpen: false,
  setMobileOpen: (v) => set({ mobileOpen: v }),

  unreadMessages: 0,
  setUnreadMessages: (n) => set({ unreadMessages: n }),
}));
