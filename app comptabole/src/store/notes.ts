import { create } from "zustand";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import type {
  Associe,
  BlocLibre,
  DetailCompteLigne,
  FicheSociete,
  NotesExercice,
  NotesModele,
  ObjetSocialBloc,
} from "@/types";

function fail(err: unknown): never {
  toast.error(err instanceof ApiError ? err.message : "Opération impossible");
  throw err;
}

interface FicheInput {
  formeJuridique: string;
  statutFiscal: string;
  dateCreation: string | null;
  capitalInitial: number;
  partsInitiales: number;
  valeurNominale: number;
  objetSocial: ObjetSocialBloc[];
  associes: Associe[];
}

interface NotesState {
  modele: NotesModele | null;
  loadingModele: boolean;
  fetchModele: () => Promise<void>;
  saveModele: (texte: string) => Promise<void>;

  fiche: FicheSociete | null;
  loadingFiche: boolean;
  fetchFiche: (societeId: string) => Promise<void>;
  clearFiche: () => void;
  saveFiche: (societeId: string, data: FicheInput) => Promise<void>;

  notesExercice: NotesExercice | null;
  loadingNotesExercice: boolean;
  fetchNotesExercice: (societeId: string, exercice: string) => Promise<void>;
  clearNotesExercice: () => void;
  saveNotesExercice: (
    societeId: string,
    exercice: string,
    data: { texteOverride: string; blocsLibres: BlocLibre[] },
  ) => Promise<void>;

  detailComptes: DetailCompteLigne[];
  loadingDetailComptes: boolean;
  fetchDetailComptes: (societeId: string) => Promise<void>;
  clearDetailComptes: () => void;
}

export const useNotes = create<NotesState>((set) => ({
  modele: null,
  loadingModele: false,
  fetchModele: async () => {
    set({ loadingModele: true });
    try {
      const modele = await api.get<NotesModele>("/notes/modele");
      set({ modele, loadingModele: false });
    } catch (e) {
      set({ loadingModele: false });
      fail(e);
    }
  },
  saveModele: async (texte) => {
    try {
      const modele = await api.put<NotesModele>("/notes/modele", { texte });
      set({ modele });
    } catch (e) {
      fail(e);
    }
  },

  fiche: null,
  loadingFiche: false,
  fetchFiche: async (societeId) => {
    set({ loadingFiche: true });
    try {
      const fiche = await api.get<FicheSociete>(`/notes/fiche-societe/${societeId}`);
      set({ fiche, loadingFiche: false });
    } catch (e) {
      set({ loadingFiche: false });
      fail(e);
    }
  },
  clearFiche: () => set({ fiche: null }),
  saveFiche: async (societeId, data) => {
    try {
      const fiche = await api.put<FicheSociete>(`/notes/fiche-societe/${societeId}`, data);
      set({ fiche });
    } catch (e) {
      fail(e);
    }
  },

  notesExercice: null,
  loadingNotesExercice: false,
  fetchNotesExercice: async (societeId, exercice) => {
    set({ loadingNotesExercice: true });
    try {
      const notesExercice = await api.get<NotesExercice>(
        `/notes/exercice?societeId=${societeId}&exercice=${encodeURIComponent(exercice)}`,
      );
      set({ notesExercice, loadingNotesExercice: false });
    } catch (e) {
      set({ loadingNotesExercice: false });
      fail(e);
    }
  },
  clearNotesExercice: () => set({ notesExercice: null }),
  saveNotesExercice: async (societeId, exercice, data) => {
    try {
      const notesExercice = await api.put<NotesExercice>("/notes/exercice", {
        societeId,
        exercice,
        ...data,
      });
      set({ notesExercice });
    } catch (e) {
      fail(e);
    }
  },

  detailComptes: [],
  loadingDetailComptes: false,
  fetchDetailComptes: async (societeId) => {
    set({ loadingDetailComptes: true });
    try {
      const detailComptes = await api.get<DetailCompteLigne[]>(
        `/notes/detail-comptes?societeId=${societeId}`,
      );
      set({ detailComptes, loadingDetailComptes: false });
    } catch (e) {
      set({ loadingDetailComptes: false });
      fail(e);
    }
  },
  clearDetailComptes: () => set({ detailComptes: [] }),
}));
