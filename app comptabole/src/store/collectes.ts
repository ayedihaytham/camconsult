import { create } from "zustand";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import type {
  Collecte,
  CollecteFull,
  CollecteJournalEntry,
  CollecteStatut,
} from "@/types";

function fail(err: unknown): never {
  toast.error(err instanceof ApiError ? err.message : "Opération impossible");
  throw err;
}

interface CollectesState {
  list: Collecte[];
  current: CollecteFull | null;
  loadingList: boolean;
  loadingOne: boolean;

  fetchList: (societeId?: string) => Promise<void>;
  fetchOne: (id: string) => Promise<void>;
  clearCurrent: () => void;

  create: (data: {
    societeId: string;
    periode: string;
    onglets: string[];
    devise?: string;
    echeance?: string | null;
    relanceCadenceJours?: number;
  }) => Promise<CollecteFull>;
  update: (
    id: string,
    patch: Partial<
      Pick<
        Collecte,
        "periode" | "onglets" | "devise" | "statut" | "echeance" | "relanceCadenceJours"
      >
    >,
  ) => Promise<void>;
  setStatut: (id: string, statut: CollecteStatut) => Promise<void>;
  remove: (id: string) => Promise<void>;

  fetchJournal: (id: string) => Promise<CollecteJournalEntry[]>;
  relanceNow: (id: string) => Promise<void>;
  uploadFichier: (
    id: string,
    fichier: { onglet?: string; nom: string; format: string; taille: string; dataUrl: string },
  ) => Promise<void>;
  deleteFichier: (id: string, fichierId: string) => Promise<void>;

  saveLignes: (
    id: string,
    onglet: string,
    lignes: { data: Record<string, unknown>; ordre?: number }[],
  ) => Promise<void>;
  saveComment: (id: string, onglet: string, commentaire: string) => Promise<void>;

  addNote: (id: string, onglet: string, texte: string) => Promise<void>;
  /** Envoie le récap d'UN tableau précis — indépendant des autres. */
  sendRecapSection: (id: string, onglet: string, count: number) => Promise<void>;
  closeRecapSection: (id: string, onglet: string) => Promise<void>;
  submitRecap: (id: string) => Promise<void>;
}

export const useCollectes = create<CollectesState>((set, get) => ({
  list: [],
  current: null,
  loadingList: false,
  loadingOne: false,

  fetchList: async (societeId) => {
    set({ loadingList: true });
    try {
      const q = societeId ? `?societeId=${societeId}` : "";
      const list = await api.get<Collecte[]>(`/collectes${q}`);
      set({ list, loadingList: false });
    } catch (e) {
      set({ loadingList: false });
      fail(e);
    }
  },

  fetchOne: async (id) => {
    set({ loadingOne: true });
    try {
      const c = await api.get<CollecteFull>(`/collectes/${id}`);
      set({ current: c, loadingOne: false });
    } catch (e) {
      set({ loadingOne: false });
      fail(e);
    }
  },

  clearCurrent: () => set({ current: null }),

  create: async (data) => {
    try {
      const c = await api.post<CollecteFull>("/collectes", data);
      set((st) => ({ list: [c, ...st.list] }));
      return c;
    } catch (e) {
      return fail(e);
    }
  },

  update: async (id, patch) => {
    try {
      const c = await api.patch<CollecteFull>(`/collectes/${id}`, patch);
      set((st) => ({
        current: st.current?.id === id ? c : st.current,
        list: st.list.map((x) => (x.id === id ? c : x)),
      }));
    } catch (e) {
      fail(e);
    }
  },

  setStatut: async (id, statut) => {
    await get().update(id, { statut });
  },

  remove: async (id) => {
    try {
      await api.del(`/collectes/${id}`);
      set((st) => ({
        list: st.list.filter((x) => x.id !== id),
        current: st.current?.id === id ? null : st.current,
      }));
    } catch (e) {
      fail(e);
    }
  },

  saveLignes: async (id, onglet, lignes) => {
    try {
      const c = await api.put<CollecteFull>(
        `/collectes/${id}/lignes/${onglet}`,
        { lignes },
      );
      set((st) => ({ current: st.current?.id === id ? c : st.current }));
    } catch (e) {
      fail(e);
    }
  },

  saveComment: async (id, onglet, commentaire) => {
    try {
      const c = await api.patch<CollecteFull>(
        `/collectes/${id}/sections/${onglet}`,
        { commentaire },
      );
      set((st) => ({ current: st.current?.id === id ? c : st.current }));
    } catch (e) {
      fail(e);
    }
  },

  addNote: async (id, onglet, texte) => {
    try {
      const c = await api.post<CollecteFull>(`/collectes/${id}/notes`, {
        onglet,
        texte,
      });
      set((st) => ({ current: st.current?.id === id ? c : st.current }));
    } catch (e) {
      fail(e);
    }
  },
  sendRecapSection: async (id, onglet, count) => {
    try {
      const c = await api.post<CollecteFull>(
        `/collectes/${id}/sections/${onglet}/recap/send`,
        { count },
      );
      set((st) => ({
        current: st.current?.id === id ? c : st.current,
        list: st.list.map((x) => (x.id === id ? c : x)),
      }));
    } catch (e) {
      fail(e);
    }
  },
  closeRecapSection: async (id, onglet) => {
    try {
      const c = await api.post<CollecteFull>(
        `/collectes/${id}/sections/${onglet}/recap/close`,
      );
      set((st) => ({
        current: st.current?.id === id ? c : st.current,
        list: st.list.map((x) => (x.id === id ? c : x)),
      }));
    } catch (e) {
      fail(e);
    }
  },
  submitRecap: async (id) => {
    try {
      const c = await api.post<CollecteFull>(`/collectes/${id}/recap/submit`);
      set((st) => ({
        current: st.current?.id === id ? c : st.current,
        list: st.list.map((x) => (x.id === id ? c : x)),
      }));
    } catch (e) {
      fail(e);
    }
  },

  fetchJournal: async (id) => {
    try {
      return await api.get<CollecteJournalEntry[]>(`/collectes/${id}/journal`);
    } catch (e) {
      return fail(e);
    }
  },

  relanceNow: async (id) => {
    try {
      await api.post(`/collectes/${id}/relance`);
    } catch (e) {
      fail(e);
    }
  },

  uploadFichier: async (id, fichier) => {
    try {
      const c = await api.post<CollecteFull>(`/collectes/${id}/fichiers`, fichier);
      set((st) => ({
        current: st.current?.id === id ? c : st.current,
        list: st.list.map((x) => (x.id === id ? c : x)),
      }));
    } catch (e) {
      fail(e);
    }
  },

  deleteFichier: async (id, fichierId) => {
    try {
      const c = await api.del<CollecteFull>(`/collectes/${id}/fichiers/${fichierId}`);
      set((st) => ({
        current: st.current?.id === id ? c : st.current,
        list: st.list.map((x) => (x.id === id ? c : x)),
      }));
    } catch (e) {
      fail(e);
    }
  },
}));
