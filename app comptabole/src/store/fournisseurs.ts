import { create } from "zustand";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import type { EtatFournisseurs, FactureSuivi, ReglementFournisseur } from "@/types";

function fail(err: unknown): never {
  toast.error(err instanceof ApiError ? err.message : "Opération impossible");
  throw err;
}

export type ReglementInput = Omit<ReglementFournisseur, "id" | "brut" | "vire" | "date"> & {
  societeId: string;
  dateReglement: string | null;
};

interface FournisseursState extends EtatFournisseurs {
  loading: boolean;
  fetchEtat: (societeId: string) => Promise<void>;
  clear: () => void;
  createReglement: (data: ReglementInput) => Promise<void>;
  updateReglement: (id: string, data: ReglementInput) => Promise<void>;
  removeReglement: (id: string) => Promise<void>;
  saveSuivi: (mouvementId: string, data: FactureSuivi) => Promise<void>;
}

const vide: EtatFournisseurs = { factures: [], reglements: [] };

export const useFournisseurs = create<FournisseursState>((set) => {
  const run = async (action: () => Promise<EtatFournisseurs>) => {
    try {
      set(await action());
    } catch (e) {
      fail(e);
    }
  };
  return {
    ...vide,
    loading: false,
    fetchEtat: async (societeId) => {
      set({ loading: true });
      try {
        set({ ...(await api.get<EtatFournisseurs>(`/fournisseurs?societeId=${societeId}`)), loading: false });
      } catch (e) {
        set({ loading: false });
        fail(e);
      }
    },
    clear: () => set(vide),
    createReglement: (data) => run(() => api.post<EtatFournisseurs>("/fournisseurs/reglements", data)),
    updateReglement: (id, data) => run(() => api.patch<EtatFournisseurs>(`/fournisseurs/reglements/${id}`, data)),
    removeReglement: (id) => run(() => api.del<EtatFournisseurs>(`/fournisseurs/reglements/${id}`)),
    saveSuivi: (mouvementId, data) => run(() => api.put<EtatFournisseurs>(`/fournisseurs/suivi/${mouvementId}`, data)),
  };
});
