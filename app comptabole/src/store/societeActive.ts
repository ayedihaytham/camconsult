import { create } from "zustand";

/** Société sur laquelle travaille l'utilisateur (null = toutes les sociétés).
 * Volontairement non persistée : chaque ouverture démarre sur « Toutes les
 * sociétés ». Elle survit en revanche à la navigation entre les modules. */
interface SocieteActiveState {
  societeId: string | null;
  setSocieteId: (id: string | null) => void;
}

export const useSocieteActiveStore = create<SocieteActiveState>((set) => ({
  societeId: null,
  setSocieteId: (societeId) => set({ societeId }),
}));
