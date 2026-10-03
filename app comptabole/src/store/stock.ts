import { create } from "zustand";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import type {
  StockDocType,
  StockExtractPage,
  StockExtractResult,
  StockMouvement,
} from "@/types";

/** Délai maximal d'attente d'une extraction lancée en tâche de fond. */
const EXTRACT_TIMEOUT_MS = 12 * 60_000;
const EXTRACT_POLL_MS = 2_000;

/** Les extractions du moteur RUSPINA durent de quelques dizaines de secondes à
 * plusieurs minutes : le serveur répond `{ jobId }` et on interroge son état.
 * Les autres moteurs répondent directement avec le résultat. */
async function waitForExtraction<T>(response: T | { jobId: string }): Promise<T> {
  if (!response || typeof response !== "object" || !("jobId" in response)) {
    return response as T;
  }
  const started = Date.now();
  for (;;) {
    await new Promise((resolve) => setTimeout(resolve, EXTRACT_POLL_MS));
    const job = await api.get<
      | { status: "pending" }
      | { status: "error"; error?: string }
      | { status: "done"; result: T }
    >(`/stock/extract-jobs/${response.jobId}`);
    if (job.status === "done") return job.result;
    if (job.status === "error") {
      throw new ApiError(job.error ?? "Extraction impossible sur ce document.", 500);
    }
    if (Date.now() - started > EXTRACT_TIMEOUT_MS) {
      throw new ApiError("L'extraction prend trop de temps. Réessayez dans un instant.", 504);
    }
  }
}

function fail(err: unknown): never {
  toast.error(err instanceof ApiError ? err.message : "Opération impossible");
  throw err;
}

export type StockMouvementInput = Omit<
  StockMouvement,
  "id" | "ordre" | "ecart" | "ecartParDesignation" | "creeLe" | "majLe"
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
  extract: (type: StockDocType, dataUrl: string, societeId?: string) => Promise<StockExtractResult>;
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

  extract: async (type, dataUrl, societeId) => {
    set({ extracting: true });
    try {
      const response = await api.post<StockExtractResult | { jobId: string }>("/stock/extract", {
        type,
        dataUrl,
        societeId,
      });
      return await waitForExtraction<StockExtractResult>(response);
    } catch (e) {
      return fail(e);
    } finally {
      set({ extracting: false });
    }
  },

  extractPages: async (societeId, dataUrl) => {
    set({ extracting: true });
    try {
      const response = await api.post<{ pages: StockExtractPage[] } | { jobId: string }>(
        "/stock/extract-pages",
        { societeId, dataUrl },
      );
      const { pages } = await waitForExtraction<{ pages: StockExtractPage[] }>(response);
      return pages;
    } catch (e) {
      return fail(e);
    } finally {
      set({ extracting: false });
    }
  },

}));
