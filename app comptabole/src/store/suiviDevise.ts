import { create } from "zustand";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import type {
  SuiviDevise,
  SuiviDeviseFull,
  SuiviDeviseLot,
  SuiviDeviseFacture,
  SuiviDeviseMouvement,
} from "@/types";

function fail(err: unknown): never {
  toast.error(err instanceof ApiError ? err.message : "Opération impossible");
  throw err;
}

/** Ligne de la liste : la fiche + solde et total ventes déjà calculés
 * (voir GET /suivi-devise côté serveur). */
export type SuiviDeviseResume = SuiviDevise & { solde: number; totalVentes: number };

export type LotInput = Omit<SuiviDeviseLot, "id" | "suiviId" | "ordre" | "ecart">;
export type FactureInput = Omit<SuiviDeviseFacture, "id" | "suiviId" | "ordre">;
export type MouvementInput = Omit<SuiviDeviseMouvement, "id" | "suiviId" | "ordre">;

interface SuiviDeviseState {
  list: SuiviDeviseResume[];
  loadingList: boolean;
  current: SuiviDeviseFull | null;
  loadingCurrent: boolean;

  fetchList: (societeId: string) => Promise<void>;
  clearList: () => void;
  create: (data: {
    societeId: string;
    client: string;
    exercice?: string;
    devise?: string;
    note?: string;
    soldeOuverture?: number;
  }) => Promise<SuiviDeviseFull>;
  update: (
    id: string,
    data: Partial<{
      client: string;
      exercice: string;
      devise: string;
      note: string;
      soldeOuverture: number;
    }>,
  ) => Promise<void>;
  remove: (id: string) => Promise<void>;

  fetchOne: (id: string) => Promise<void>;
  clearCurrent: () => void;

  addLot: (suiviId: string, data: LotInput) => Promise<void>;
  updateLot: (lotId: string, data: Partial<LotInput>) => Promise<void>;
  removeLot: (lotId: string) => Promise<void>;

  addFacture: (suiviId: string, data: FactureInput) => Promise<void>;
  updateFacture: (factureId: string, data: Partial<FactureInput>) => Promise<void>;
  removeFacture: (factureId: string) => Promise<void>;

  addMouvement: (suiviId: string, data: MouvementInput) => Promise<void>;
  updateMouvement: (mouvementId: string, data: Partial<MouvementInput>) => Promise<void>;
  removeMouvement: (mouvementId: string) => Promise<void>;
}

export const useSuiviDevise = create<SuiviDeviseState>((set) => ({
  list: [],
  loadingList: false,
  current: null,
  loadingCurrent: false,

  fetchList: async (societeId) => {
    set({ loadingList: true });
    try {
      const list = await api.get<SuiviDeviseResume[]>(`/suivi-devise?societeId=${societeId}`);
      set({ list, loadingList: false });
    } catch (e) {
      set({ loadingList: false });
      fail(e);
    }
  },

  clearList: () => set({ list: [] }),

  create: async (data) => {
    try {
      const full = await api.post<SuiviDeviseFull>("/suivi-devise", data);
      set((st) => ({
        list: [{ ...full, solde: full.solde, totalVentes: full.totalVentes }, ...st.list],
      }));
      return full;
    } catch (e) {
      return fail(e);
    }
  },

  update: async (id, data) => {
    try {
      const full = await api.patch<SuiviDeviseFull>(`/suivi-devise/${id}`, data);
      set((st) => ({
        list: st.list.map((x) => (x.id === id ? { ...full, solde: full.solde, totalVentes: full.totalVentes } : x)),
        current: st.current && st.current.id === id ? full : st.current,
      }));
    } catch (e) {
      fail(e);
    }
  },

  remove: async (id) => {
    try {
      await api.del(`/suivi-devise/${id}`);
      set((st) => ({ list: st.list.filter((x) => x.id !== id) }));
    } catch (e) {
      fail(e);
    }
  },

  fetchOne: async (id) => {
    set({ loadingCurrent: true });
    try {
      const current = await api.get<SuiviDeviseFull>(`/suivi-devise/${id}`);
      set({ current, loadingCurrent: false });
    } catch (e) {
      set({ loadingCurrent: false });
      fail(e);
    }
  },

  clearCurrent: () => set({ current: null }),

  addLot: async (suiviId, data) => {
    try {
      const current = await api.post<SuiviDeviseFull>(`/suivi-devise/${suiviId}/lots`, data);
      set({ current });
    } catch (e) {
      fail(e);
    }
  },
  updateLot: async (lotId, data) => {
    try {
      const current = await api.patch<SuiviDeviseFull>(`/suivi-devise/lots/${lotId}`, data);
      set({ current });
    } catch (e) {
      fail(e);
    }
  },
  removeLot: async (lotId) => {
    try {
      const current = await api.del<SuiviDeviseFull>(`/suivi-devise/lots/${lotId}`);
      set({ current });
    } catch (e) {
      fail(e);
    }
  },

  addFacture: async (suiviId, data) => {
    try {
      const current = await api.post<SuiviDeviseFull>(`/suivi-devise/${suiviId}/factures`, data);
      set({ current });
    } catch (e) {
      fail(e);
    }
  },
  updateFacture: async (factureId, data) => {
    try {
      const current = await api.patch<SuiviDeviseFull>(`/suivi-devise/factures/${factureId}`, data);
      set({ current });
    } catch (e) {
      fail(e);
    }
  },
  removeFacture: async (factureId) => {
    try {
      const current = await api.del<SuiviDeviseFull>(`/suivi-devise/factures/${factureId}`);
      set({ current });
    } catch (e) {
      fail(e);
    }
  },

  addMouvement: async (suiviId, data) => {
    try {
      const current = await api.post<SuiviDeviseFull>(`/suivi-devise/${suiviId}/mouvements`, data);
      set({ current });
    } catch (e) {
      fail(e);
    }
  },
  updateMouvement: async (mouvementId, data) => {
    try {
      const current = await api.patch<SuiviDeviseFull>(`/suivi-devise/mouvements/${mouvementId}`, data);
      set({ current });
    } catch (e) {
      fail(e);
    }
  },
  removeMouvement: async (mouvementId) => {
    try {
      const current = await api.del<SuiviDeviseFull>(`/suivi-devise/mouvements/${mouvementId}`);
      set({ current });
    } catch (e) {
      fail(e);
    }
  },
}));
