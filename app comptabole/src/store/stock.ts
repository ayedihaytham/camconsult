import { create } from "zustand";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import type {
  StockDocType,
  StockExtractPage,
  StockExtractPagesResult,
  StockExtractResult,
  StockMouvement,
} from "@/types";

/** Délai maximal d'attente d'une extraction lancée en tâche de fond. */
const EXTRACT_TIMEOUT_MS = 12 * 60_000;
const EXTRACT_POLL_MS = 2_000;
/** Enregistrer un mouvement envoie ses documents : au-delà, on rend la main avec un message clair. */
const SAVE_TIMEOUT_MS = 180_000;

/** Les extractions du moteur RUSPINA durent de quelques dizaines de secondes à
 * plusieurs minutes : le serveur répond `{ jobId }` et on interroge son état.
 * Les autres moteurs répondent directement avec le résultat. */
async function waitForExtraction<T>(response: T | { jobId: string }): Promise<T> {
  if (!response || typeof response !== "object" || !("jobId" in response)) {
    return response as T;
  }
  const started = Date.now();
  const notice = toast.loading(
    "Lecture du document en cours — cela peut prendre quelques minutes. Gardez cette fenêtre ouverte.",
  );
  try {
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
  } finally {
    toast.dismiss(notice);
  }
}

function fail(err: unknown): never {
  toast.error(err instanceof ApiError ? err.message : "Opération impossible");
  throw err;
}

export type StockMouvementInput = Omit<
  StockMouvement,
  "id" | "ordre" | "ecart" | "ecartUnite" | "ecartParDesignation" | "creeLe" | "majLe"
>;

/** Synthèse d'une société pour l'accueil du module (valeur en TND). */
export interface SyntheseStock {
  mouvements: number;
  dernierLe: string | null;
  valeur: number;
  alertes: number;
  coursManquants: number;
  enDevise: number;
}

interface StockState {
  list: StockMouvement[];
  loading: boolean;
  extracting: boolean;
  /** Nombre de mouvements par société (page d'accueil du module). */
  counts: Record<string, number>;
  /** Nombre de mouvements et date du dernier, par société (tableau de suivi de l'accueil). */
  synthese: Record<string, SyntheseStock>;

  fetchCounts: () => Promise<void>;
  fetchSynthese: () => Promise<void>;
  fetchList: (societeId: string) => Promise<void>;
  clear: () => void;
  create: (data: StockMouvementInput) => Promise<StockMouvement>;
  /** `supprimerReglements` : retrait de la facture d'achat avec suppression de ses règlements (Suivi fournisseur), demandé expressément. */
  update: (id: string, data: Partial<StockMouvementInput> & { supprimerReglements?: boolean }) => Promise<void>;
  /** `supprimerReglements` : supprime aussi les règlements de la facture d'achat (sinon le serveur refuse). */
  remove: (id: string, options?: { supprimerReglements?: boolean }) => Promise<void>;
  extract: (type: StockDocType, dataUrl: string, societeId?: string) => Promise<StockExtractResult>;
  /** Import "document complet" : un PDF/image combinant plusieurs pièces —
   * chaque page est analysée séparément et son type deviné. */
  extractPages: (societeId: string, dataUrl: string) => Promise<StockExtractPagesResult>;
}

export const useStock = create<StockState>((set) => ({
  list: [],
  loading: false,
  extracting: false,
  counts: {},
  synthese: {},

  fetchSynthese: async () => {
    try {
      set({ synthese: await api.get<Record<string, SyntheseStock>>("/stock/synthese") });
    } catch {
      /* l'accueil s'affiche sans synthèse */
    }
  },

  fetchCounts: async () => {
    try {
      set({ counts: await api.get<Record<string, number>>("/stock/compteurs") });
    } catch {
      /* l'accueil s'affiche sans compteurs */
    }
  },

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
      const m = await api.post<StockMouvement>("/stock/mouvements", data, { timeoutMs: SAVE_TIMEOUT_MS });
      set((st) => ({ list: [...st.list, m] }));
      return m;
    } catch (e) {
      return fail(e);
    }
  },

  update: async (id, data) => {
    try {
      const m = await api.patch<StockMouvement>(`/stock/mouvements/${id}`, data, { timeoutMs: SAVE_TIMEOUT_MS });
      set((st) => ({ list: st.list.map((x) => (x.id === id ? m : x)) }));
    } catch (e) {
      fail(e);
    }
  },

  remove: async (id, options) => {
    try {
      await api.del(`/stock/mouvements/${id}${options?.supprimerReglements ? "?supprimerReglements=true" : ""}`);
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
      const response = await api.post<{ pages: StockExtractPage[]; avertissements?: string[] } | { jobId: string }>(
        "/stock/extract-pages",
        { societeId, dataUrl },
      );
      const { pages, avertissements } = await waitForExtraction<{ pages: StockExtractPage[]; avertissements?: string[] }>(response);
      return { pages, avertissements: avertissements ?? [] };
    } catch (e) {
      return fail(e);
    } finally {
      set({ extracting: false });
    }
  },

}));
