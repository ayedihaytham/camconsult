import { create } from "zustand";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import type { HonoraireLigne } from "@/types";

function fail(err: unknown): never {
  toast.error(err instanceof ApiError ? err.message : "Opération impossible");
  throw err;
}

export type HonoraireLigneInput = Omit<
  HonoraireLigne,
  "id" | "ordre" | "total" | "solde" | "creeLe" | "majLe"
>;

interface HonorairesState {
  list: HonoraireLigne[];
  loading: boolean;

  fetchList: (societeId: string) => Promise<void>;
  clear: () => void;
  create: (data: HonoraireLigneInput) => Promise<void>;
  update: (id: string, data: Partial<HonoraireLigneInput>) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useHonoraires = create<HonorairesState>((set) => ({
  list: [],
  loading: false,

  fetchList: async (societeId) => {
    set({ loading: true });
    try {
      const list = await api.get<HonoraireLigne[]>(
        `/honoraires?societeId=${societeId}`,
      );
      set({ list, loading: false });
    } catch (e) {
      set({ loading: false });
      fail(e);
    }
  },

  clear: () => set({ list: [] }),

  create: async (data) => {
    try {
      const list = await api.post<HonoraireLigne[]>("/honoraires", data);
      set({ list });
    } catch (e) {
      fail(e);
    }
  },

  update: async (id, data) => {
    try {
      const list = await api.patch<HonoraireLigne[]>(`/honoraires/${id}`, data);
      set({ list });
    } catch (e) {
      fail(e);
    }
  },

  remove: async (id) => {
    try {
      const list = await api.del<HonoraireLigne[]>(`/honoraires/${id}`);
      set({ list });
    } catch (e) {
      fail(e);
    }
  },
}));
