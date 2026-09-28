import { create } from "zustand";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import type { SoucheCheque } from "@/types";

function fail(err: unknown): never {
  toast.error(err instanceof ApiError ? err.message : "Opération impossible");
  throw err;
}

export type SoucheChequeInput = Omit<
  SoucheCheque,
  "id" | "societeId" | "ordre" | "creeLe" | "majLe"
>;

interface SoucheChequesState {
  list: SoucheCheque[];
  loading: boolean;

  fetchList: (societeId: string) => Promise<void>;
  clear: () => void;
  create: (societeId: string, data: SoucheChequeInput) => Promise<void>;
  update: (id: string, data: SoucheChequeInput) => Promise<void>;
  remove: (id: string) => Promise<void>;
  /** Ajoute les chèques d'un fichier Excel ; les n° déjà présents sont ignorés. */
  importLignes: (
    societeId: string,
    lignes: SoucheChequeInput[],
  ) => Promise<{ importes: number; ignores: number }>;
}

export const useSoucheCheques = create<SoucheChequesState>((set) => ({
  list: [],
  loading: false,

  fetchList: async (societeId) => {
    set({ loading: true });
    try {
      const list = await api.get<SoucheCheque[]>(`/souche-cheques?societeId=${societeId}`);
      set({ list, loading: false });
    } catch (e) {
      set({ loading: false });
      fail(e);
    }
  },

  clear: () => set({ list: [] }),

  create: async (societeId, data) => {
    try {
      const list = await api.post<SoucheCheque[]>("/souche-cheques", { ...data, societeId });
      set({ list });
    } catch (e) {
      fail(e);
    }
  },

  update: async (id, data) => {
    try {
      const list = await api.patch<SoucheCheque[]>(`/souche-cheques/${id}`, data);
      set({ list });
    } catch (e) {
      fail(e);
    }
  },

  remove: async (id) => {
    try {
      const list = await api.del<SoucheCheque[]>(`/souche-cheques/${id}`);
      set({ list });
    } catch (e) {
      fail(e);
    }
  },

  importLignes: async (societeId, lignes) => {
    try {
      const res = await api.post<{ lignes: SoucheCheque[]; importes: number; ignores: number }>(
        "/souche-cheques/import",
        { societeId, lignes },
      );
      set({ list: res.lignes });
      return { importes: res.importes, ignores: res.ignores };
    } catch (e) {
      return fail(e);
    }
  },
}));
