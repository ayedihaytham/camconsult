import { create } from "zustand";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import type { CompteBancaire, EtatBanque } from "@/types";
import type { MouvementImport } from "@/lib/banque";

function fail(err: unknown): never {
  toast.error(err instanceof ApiError ? err.message : "Opération impossible");
  throw err;
}

export type CompteInput = Omit<CompteBancaire, "id">;
export type MouvementInput = MouvementImport;

interface BanqueState extends EtatBanque {
  loading: boolean;
  fetchEtat: (societeId: string) => Promise<void>;
  clear: () => void;
  createCompte: (societeId: string, data: CompteInput) => Promise<void>;
  updateCompte: (id: string, data: CompteInput) => Promise<void>;
  removeCompte: (id: string) => Promise<void>;
  addMouvement: (compteId: string, data: MouvementInput) => Promise<void>;
  /** Importe un relevé : renvoie le nombre de mouvements créés et ignorés (déjà présents). */
  importMouvements: (compteId: string, mouvements: MouvementInput[]) => Promise<{ importes: number; ignores: number }>;
  updateMouvement: (id: string, data: MouvementInput) => Promise<void>;
  removeMouvement: (id: string) => Promise<void>;
}

const vide: EtatBanque = { comptes: [], mouvements: [] };

export const useBanque = create<BanqueState>((set) => {
  const run = async (action: () => Promise<EtatBanque>) => {
    try {
      const { comptes, mouvements } = await action();
      set({ comptes, mouvements });
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
        set({ ...(await api.get<EtatBanque>(`/banque?societeId=${societeId}`)), loading: false });
      } catch (e) {
        set({ loading: false });
        fail(e);
      }
    },
    clear: () => set(vide),
    createCompte: (societeId, data) => run(() => api.post<EtatBanque>("/banque/comptes", { ...data, societeId })),
    updateCompte: (id, data) => run(() => api.patch<EtatBanque>(`/banque/comptes/${id}`, data)),
    removeCompte: (id) => run(() => api.del<EtatBanque>(`/banque/comptes/${id}`)),
    addMouvement: (compteId, data) => run(() => api.post<EtatBanque>(`/banque/comptes/${compteId}/mouvements`, data)),
    importMouvements: async (compteId, mouvements) => {
      try {
        const r = await api.post<EtatBanque & { importes: number; ignores: number }>(`/banque/comptes/${compteId}/import`, { mouvements });
        set({ comptes: r.comptes, mouvements: r.mouvements });
        return { importes: r.importes, ignores: r.ignores };
      } catch (e) {
        return fail(e);
      }
    },
    updateMouvement: (id, data) => run(() => api.patch<EtatBanque>(`/banque/mouvements/${id}`, data)),
    removeMouvement: (id) => run(() => api.del<EtatBanque>(`/banque/mouvements/${id}`)),
  };
});
