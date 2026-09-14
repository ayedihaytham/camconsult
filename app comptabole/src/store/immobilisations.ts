import { create } from "zustand";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import type { ImmoBien, ImmoCategorie, ImmoMasseCategorie } from "@/types";

export interface BulkBienInput {
  categorieNom: string;
  masse: ImmoMasseCategorie;
  libelle: string;
  dateAcquisition: string;
  coutAcquisition: number;
  taux: number;
}

function fail(err: unknown): never {
  toast.error(err instanceof ApiError ? err.message : "Opération impossible");
  throw err;
}

export interface BienInput {
  categorieId: string;
  libelle: string;
  dateAcquisition: string;
  coutAcquisition: number;
  taux: number;
  dateCession: string | null;
  valeurCession: number;
}

interface ImmobilisationsState {
  categories: ImmoCategorie[];
  loadingCategories: boolean;
  fetchCategories: () => Promise<void>;
  addCategorie: (nom: string, taux: number, masse: ImmoMasseCategorie) => Promise<ImmoCategorie>;
  updateCategorie: (
    id: string,
    data: Partial<{ nom: string; taux: number; masse: ImmoMasseCategorie }>,
  ) => Promise<void>;
  removeCategorie: (id: string) => Promise<void>;

  biens: ImmoBien[];
  loadingBiens: boolean;
  fetchBiens: (societeId: string) => Promise<void>;
  clearBiens: () => void;
  addBien: (societeId: string, data: BienInput) => Promise<void>;
  bulkAddBiens: (societeId: string, biens: BulkBienInput[]) => Promise<number>;
  updateBien: (id: string, data: Partial<BienInput>) => Promise<void>;
  removeBien: (id: string) => Promise<void>;
}

export const useImmobilisations = create<ImmobilisationsState>((set) => ({
  categories: [],
  loadingCategories: false,
  fetchCategories: async () => {
    set({ loadingCategories: true });
    try {
      const categories = await api.get<ImmoCategorie[]>("/immobilisations/categories");
      set({ categories, loadingCategories: false });
    } catch (e) {
      set({ loadingCategories: false });
      fail(e);
    }
  },
  addCategorie: async (nom, taux, masse) => {
    try {
      const categorie = await api.post<ImmoCategorie>("/immobilisations/categories", { nom, taux, masse });
      set((st) => ({ categories: [...st.categories, categorie] }));
      return categorie;
    } catch (e) {
      return fail(e);
    }
  },
  updateCategorie: async (id, data) => {
    try {
      const categorie = await api.patch<ImmoCategorie>(`/immobilisations/categories/${id}`, data);
      set((st) => ({ categories: st.categories.map((c) => (c.id === id ? categorie : c)) }));
    } catch (e) {
      fail(e);
    }
  },
  removeCategorie: async (id) => {
    try {
      await api.del(`/immobilisations/categories/${id}`);
      set((st) => ({ categories: st.categories.filter((c) => c.id !== id) }));
    } catch (e) {
      fail(e);
    }
  },

  biens: [],
  loadingBiens: false,
  fetchBiens: async (societeId) => {
    set({ loadingBiens: true });
    try {
      const biens = await api.get<ImmoBien[]>(`/immobilisations/biens?societeId=${societeId}`);
      set({ biens, loadingBiens: false });
    } catch (e) {
      set({ loadingBiens: false });
      fail(e);
    }
  },
  clearBiens: () => set({ biens: [] }),
  addBien: async (societeId, data) => {
    try {
      const bien = await api.post<ImmoBien>("/immobilisations/biens", { societeId, ...data });
      set((st) => ({ biens: [...st.biens, bien] }));
    } catch (e) {
      fail(e);
    }
  },
  bulkAddBiens: async (societeId, biens) => {
    try {
      const created = await api.post<ImmoBien[]>("/immobilisations/biens/bulk", { societeId, biens });
      set((st) => ({ biens: [...st.biens, ...created] }));
      return created.length;
    } catch (e) {
      return fail(e);
    }
  },
  updateBien: async (id, data) => {
    try {
      const bien = await api.patch<ImmoBien>(`/immobilisations/biens/${id}`, data);
      set((st) => ({ biens: st.biens.map((b) => (b.id === id ? bien : b)) }));
    } catch (e) {
      fail(e);
    }
  },
  removeBien: async (id) => {
    try {
      await api.del(`/immobilisations/biens/${id}`);
      set((st) => ({ biens: st.biens.filter((b) => b.id !== id) }));
    } catch (e) {
      fail(e);
    }
  },
}));
