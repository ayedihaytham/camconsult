import { create } from "zustand";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import type { SwiftFacture, SwiftVirement } from "@/types";

function fail(err: unknown): never {
  toast.error(err instanceof ApiError ? err.message : "Opération impossible");
  throw err;
}

export interface VirementInput {
  date: string;
  montant: number;
  libelle: string;
  banque: string;
  envoyer: boolean;
}

interface EtatSwiftState {
  virements: SwiftVirement[];
  loading: boolean;
  fetch: (societeId: string) => Promise<void>;
  clear: () => void;
  create: (societeId: string, data: VirementInput) => Promise<void>;
  update: (id: string, data: Partial<VirementInput>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  /** Remplace les factures d'un virement : la société les ajoute une à une jusqu'à atteindre le montant. */
  saveFactures: (id: string, factures: SwiftFacture[], reference?: { equivalentDevise: number; devise: string }) => Promise<SwiftVirement>;
}

export const useEtatSwift = create<EtatSwiftState>((set, get) => ({
  virements: [],
  loading: false,

  fetch: async (societeId) => {
    set({ loading: true });
    try {
      set({ virements: await api.get<SwiftVirement[]>(`/etat-swift?societeId=${societeId}`) });
    } catch (err) {
      fail(err);
    } finally {
      set({ loading: false });
    }
  },

  clear: () => set({ virements: [], loading: false }),

  create: async (societeId, data) => {
    try {
      const v = await api.post<SwiftVirement>("/etat-swift", { societeId, ...data });
      set({ virements: [v, ...get().virements] });
    } catch (err) {
      fail(err);
    }
  },

  update: async (id, data) => {
    try {
      const v = await api.patch<SwiftVirement>(`/etat-swift/${id}`, data);
      set({ virements: get().virements.map((x) => (x.id === id ? v : x)) });
    } catch (err) {
      fail(err);
    }
  },

  remove: async (id) => {
    try {
      await api.del(`/etat-swift/${id}`);
      set({ virements: get().virements.filter((x) => x.id !== id) });
    } catch (err) {
      fail(err);
    }
  },

  saveFactures: async (id, factures, reference) => {
    try {
      const v = await api.put<SwiftVirement>(`/etat-swift/${id}/factures`, { factures, ...reference });
      set({ virements: get().virements.map((x) => (x.id === id ? v : x)) });
      return v;
    } catch (err) {
      return fail(err);
    }
  },
}));
