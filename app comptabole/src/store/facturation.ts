import { create } from "zustand";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import type { Facture, FactureStatut } from "@/types";

function fail(err: unknown): never {
  toast.error(err instanceof ApiError ? err.message : "Opération impossible");
  throw err;
}

export interface FactureInput {
  societeId: string;
  dateEmission: string;
  echeance: string | null;
  tvaTaux: number;
  timbre: number;
  note: string;
  lignes: { description: string; quantite: number; montantHt: number }[];
}

interface FacturationState {
  list: Facture[];
  loading: boolean;
  fetchList: () => Promise<void>;
  create: (data: FactureInput) => Promise<Facture>;
  update: (id: string, data: { statut?: FactureStatut; signee?: boolean }) => Promise<void>;
}

export const useFacturation = create<FacturationState>((set) => ({
  list: [],
  loading: false,

  fetchList: async () => {
    set({ loading: true });
    try {
      const list = await api.get<Facture[]>("/facturation");
      set({ list, loading: false });
    } catch (e) {
      set({ loading: false });
      fail(e);
    }
  },

  create: async (data) => {
    try {
      const f = await api.post<Facture>("/facturation", data);
      set((st) => ({ list: [f, ...st.list] }));
      return f;
    } catch (e) {
      return fail(e);
    }
  },

  update: async (id, data) => {
    try {
      const f = await api.patch<Facture>(`/facturation/${id}`, data);
      set((st) => ({ list: st.list.map((x) => (x.id === id ? f : x)) }));
    } catch (e) {
      fail(e);
    }
  },
}));
