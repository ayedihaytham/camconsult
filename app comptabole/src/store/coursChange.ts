import { create } from "zustand";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import type { CoursChange, DeviseChange } from "@/types";

interface Etat {
  devises: DeviseChange[];
  cours: CoursChange[];
  charge: boolean;
  fetch: (force?: boolean) => Promise<void>;
  /** Enregistre des cours d'une année (null efface le cours du mois). */
  saveAnnee: (annee: number, valeurs: { devise: string; mois: number; cours: number | null }[]) => Promise<void>;
  addDevise: (d: { code: string; libelle: string; unite: number }) => Promise<void>;
  removeDevise: (code: string) => Promise<void>;
}

function echec(err: unknown): never {
  toast.error(err instanceof ApiError ? err.message : "Opération impossible");
  throw err;
}

/** Cours de change : une seule copie partagée par la page de gestion et par les formulaires qui proposent le cours du mois. */
export const useCoursChange = create<Etat>((set, get) => ({
  devises: [],
  cours: [],
  charge: false,
  fetch: async (force = false) => {
    if (get().charge && !force) return;
    try {
      const r = await api.get<{ devises: DeviseChange[]; cours: CoursChange[] }>("/cours-change");
      set({ devises: r.devises, cours: r.cours, charge: true });
    } catch {
      // un formulaire de saisie ne doit pas échouer parce que les cours sont indisponibles
      set({ charge: true });
    }
  },
  saveAnnee: async (annee, valeurs) => {
    try {
      const r = await api.put<{ devises: DeviseChange[]; cours: CoursChange[] }>(`/cours-change/${annee}`, { cours: valeurs });
      set({ devises: r.devises, cours: r.cours, charge: true });
    } catch (e) {
      echec(e);
    }
  },
  addDevise: async (d) => {
    try {
      const r = await api.post<{ devises: DeviseChange[]; cours: CoursChange[] }>("/cours-change/devises", d);
      set({ devises: r.devises, cours: r.cours });
    } catch (e) {
      echec(e);
    }
  },
  removeDevise: async (code) => {
    try {
      const r = await api.del<{ devises: DeviseChange[]; cours: CoursChange[] }>(`/cours-change/devises/${code}`);
      set({ devises: r.devises, cours: r.cours });
    } catch (e) {
      echec(e);
    }
  },
}));
