import { create } from "zustand";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import type {
  StockDocType,
  StockExtractPage,
  StockExtractResult,
  StockMouvement,
} from "@/types";

function fail(err: unknown): never {
  toast.error(err instanceof ApiError ? err.message : "Opération impossible");
  throw err;
}

export type StockMouvementInput = Omit<
  StockMouvement,
  "id" | "ordre" | "ecart" | "creeLe" | "majLe"
>;

interface StockState {
  list: StockMouvement[];
  loading: boolean;
  extracting: boolean;

  fetchList: (societeId: string) => Promise<void>;
  clear: () => void;
  create: (data: StockMouvementInput) => Promise<StockMouvement>;
  update: (id: string, data: Partial<StockMouvementInput>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  extract: (type: StockDocType, dataUrl: string) => Promise<StockExtractResult>;
  /** Import "document complet" : un PDF/image combinant plusieurs pièces —
   * chaque page est analysée séparément et son type deviné. */
  extractPages: (societeId: string, dataUrl: string) => Promise<StockExtractPage[]>;
}

export const useStock = create<StockState>((set) => ({
  list: [],
  loading: false,
  extracting: false,

  fetchList: async (societeId) => {
    set({ loading: true });
    try {
      const list = await api.get<StockMouvement[]>(
        `/stock/mouvements?societeId=${societeId}`,
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
      const m = await api.post<StockMouvement>("/stock/mouvements", data);
      set((st) => ({ list: [...st.list, m] }));
      return m;
    } catch (e) {
      return fail(e);
    }
  },

  update: async (id, data) => {
    try {
      const m = await api.patch<StockMouvement>(`/stock/mouvements/${id}`, data);
      set((st) => ({ list: st.list.map((x) => (x.id === id ? m : x)) }));
    } catch (e) {
      fail(e);
    }
  },

  remove: async (id) => {
    try {
      await api.del(`/stock/mouvements/${id}`);
      set((st) => ({ list: st.list.filter((x) => x.id !== id) }));
    } catch (e) {
      fail(e);
    }
  },

  extract: async (type, dataUrl) => {
    set({ extracting: true });
    try {
      const result = await api.post<StockExtractResult>("/stock/extract", {
        type,
        dataUrl,
      });
      return result;
    } catch (e) {
      return fail(e);
    } finally {
      set({ extracting: false });
    }
  },

  extractPages: async (societeId, dataUrl) => {
    set({ extracting: true });
    try {
      const { pages } = await api.post<{ pages: StockExtractPage[] }>(
        "/stock/extract-pages",
        { societeId, dataUrl },
      );
      return pages;
    } catch (e) {
      return fail(e);
    } finally {
      set({ extracting: false });
    }
  },

}));
