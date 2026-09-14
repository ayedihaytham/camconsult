import { create } from "zustand";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import type { Bordereau, BordereauLigne, BordereauType, BordereauVolet } from "@/types";

function fail(err: unknown): never {
  toast.error(err instanceof ApiError ? err.message : "Opération impossible");
  throw err;
}

export interface BordereauInput {
  type: BordereauType;
  volet: BordereauVolet;
  numero: string;
  dateOperation: string | null;
  pointe: boolean;
  note: string;
  lignes: Omit<BordereauLigne, "id">[];
}

interface BordereauxState {
  list: Bordereau[];
  loading: boolean;
  fetchList: () => Promise<void>;
  create: (data: BordereauInput) => Promise<Bordereau>;
  update: (id: string, data: Partial<BordereauInput>) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useBordereaux = create<BordereauxState>((set) => ({
  list: [],
  loading: false,

  fetchList: async () => {
    set({ loading: true });
    try {
      const list = await api.get<Bordereau[]>("/bordereaux");
      set({ list, loading: false });
    } catch (e) {
      set({ loading: false });
      fail(e);
    }
  },

  create: async (data) => {
    try {
      const b = await api.post<Bordereau>("/bordereaux", data);
      set((st) => ({ list: [b, ...st.list] }));
      return b;
    } catch (e) {
      return fail(e);
    }
  },

  update: async (id, data) => {
    try {
      const b = await api.patch<Bordereau>(`/bordereaux/${id}`, data);
      set((st) => ({ list: st.list.map((x) => (x.id === id ? b : x)) }));
    } catch (e) {
      fail(e);
    }
  },

  remove: async (id) => {
    try {
      await api.del(`/bordereaux/${id}`);
      set((st) => ({ list: st.list.filter((x) => x.id !== id) }));
    } catch (e) {
      fail(e);
    }
  },
}));
