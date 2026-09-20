import { create } from "zustand";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import type {
  Balance,
  BalanceFull,
  BalanceLigne,
  GrilleAffectatCode,
  GrilleCompte,
  ImmoMasse,
  ImmoMouvement,
  FinancementMouvement,
  TdrfKind,
  TdrfLigne,
  TdrfParametres,
} from "@/types";
import type { Postes } from "@/lib/etatsFinanciers/postes";

export interface PostesExercice {
  exercice: string;
  postes: Postes;
  /** Débit/crédit cumulés séparément (pas juste le solde net) — utilisés
   * pour suggérer les mouvements d'immobilisations par différence d'un
   * exercice à l'autre, voir suggestImmoMouvement(). */
  postesDebit: Postes;
  postesCredit: Postes;
  /** Solde par code AFFECTAT brut ("" = lignes sans code), indépendant du
   * reclassement en poste — pour vérifier un import (onglet « Synthèse
   * AFFECTAT »), voir server/routes/balances.js "/postes". */
  codes: Postes;
  /** CA local/export suggéré pour le TDRF (voir server/routes/balances.js
   * "/postes") — détecté depuis le libellé des comptes de ventes, à
   * confirmer par l'expert-comptable exercice par exercice. */
  caLocalSuggere: number;
  caExportSuggere: number;
}

function fail(err: unknown): never {
  toast.error(err instanceof ApiError ? err.message : "Opération impossible");
  throw err;
}

export type BalanceLigneInput = Omit<BalanceLigne, "id" | "ordre" | "solde"> & {
  /** Vrai = l'association compte -> code AFFECTAT n'est apprise que pour
   * cette société (grille_comptes_societe), jamais cabinet-wide. */
  scopeSociete?: boolean;
};

interface BalancesState {
  list: Balance[]; // en-têtes (exercices) de la société courante
  loadingList: boolean;
  current: BalanceFull | null; // balance ouverte (avec ses lignes)
  loadingCurrent: boolean;

  grilleCodes: GrilleAffectatCode[];
  grilleComptes: GrilleCompte[];
  /** Overrides compte -> AFFECTAT propres à la société consultée en dernier
   * (grille_comptes_societe) — vide tant qu'aucun fetchGrille(societeId)
   * n'a été fait. */
  grilleComptesSociete: GrilleCompte[];
  grilleLoaded: boolean;

  postesParExercice: PostesExercice[];
  loadingPostes: boolean;
  fetchPostes: (societeId: string) => Promise<void>;
  clearPostes: () => void;

  fetchList: (societeId: string) => Promise<void>;
  clearList: () => void;
  create: (societeId: string, exercice: string, note?: string) => Promise<Balance>;
  update: (id: string, data: { exercice?: string; note?: string }) => Promise<void>;
  remove: (id: string) => Promise<void>;

  fetchOne: (id: string) => Promise<void>;
  clearCurrent: () => void;
  addLigne: (balanceId: string, data: BalanceLigneInput) => Promise<void>;
  updateLigne: (
    balanceId: string,
    ligneId: string,
    data: Partial<BalanceLigneInput>,
  ) => Promise<void>;
  removeLigne: (balanceId: string, ligneId: string) => Promise<void>;
  replaceLignes: (
    balanceId: string,
    lignes: BalanceLigneInput[],
    societeId?: string,
  ) => Promise<void>;

  fetchGrille: (societeId?: string) => Promise<void>;
  renameCode: (code: string, newCode: string) => Promise<void>;
  updateCode: (code: string, data: { libelle?: string; poste?: string }) => Promise<void>;
  removeCode: (code: string) => Promise<void>;

  immoMouvements: ImmoMouvement[];
  loadingImmoMouvements: boolean;
  fetchImmoMouvements: (societeId: string) => Promise<void>;
  clearImmoMouvements: () => void;
  saveImmoMouvement: (
    societeId: string,
    exercice: string,
    masse: ImmoMasse,
    data: { acquisitions: number; cessions: number; dotations: number; reprises: number },
  ) => Promise<void>;

  financementMouvements: FinancementMouvement[];
  loadingFinancementMouvements: boolean;
  fetchFinancementMouvements: (societeId: string) => Promise<void>;
  clearFinancementMouvements: () => void;
  saveFinancementMouvement: (
    societeId: string,
    exercice: string,
    data: {
      empruntsContractes: number;
      empruntsRembourses: number;
      dividendesDistribues: number;
      capitalNumeraire: number;
      interetsCourusNonEchus: number;
    },
  ) => Promise<void>;

  tdrfLignes: TdrfLigne[];
  loadingTdrfLignes: boolean;
  fetchTdrfLignes: (societeId: string) => Promise<void>;
  clearTdrfLignes: () => void;
  addTdrfLigne: (
    societeId: string,
    exercice: string,
    kind: TdrfKind,
    libelle: string,
    montant: number,
  ) => Promise<void>;
  updateTdrfLigne: (
    id: string,
    data: Partial<{ kind: TdrfKind; libelle: string; montant: number }>,
  ) => Promise<void>;
  removeTdrfLigne: (id: string) => Promise<void>;

  tdrfParametres: TdrfParametres[];
  loadingTdrfParametres: boolean;
  fetchTdrfParametres: (societeId: string) => Promise<void>;
  clearTdrfParametres: () => void;
  saveTdrfParametres: (
    societeId: string,
    exercice: string,
    data: {
      chiffreAffairesLocal: number;
      chiffreAffairesExport: number;
      tauxImposition: number;
      tauxExport: number;
      tauxMinimum: number;
      plancherMinimum: number;
      contributionSociale: number;
      excedentsAcomptes: number;
    },
  ) => Promise<void>;
}

export const useBalances = create<BalancesState>((set, get) => ({
  list: [],
  loadingList: false,
  current: null,
  loadingCurrent: false,

  grilleCodes: [],
  grilleComptes: [],
  grilleComptesSociete: [],
  grilleLoaded: false,

  postesParExercice: [],
  loadingPostes: false,

  fetchPostes: async (societeId) => {
    set({ loadingPostes: true });
    try {
      const postesParExercice = await api.get<PostesExercice[]>(
        `/balances/postes?societeId=${societeId}`,
      );
      set({ postesParExercice, loadingPostes: false });
    } catch (e) {
      set({ loadingPostes: false });
      fail(e);
    }
  },

  clearPostes: () => set({ postesParExercice: [] }),

  fetchList: async (societeId) => {
    set({ loadingList: true });
    try {
      const list = await api.get<Balance[]>(`/balances?societeId=${societeId}`);
      set({ list, loadingList: false });
    } catch (e) {
      set({ loadingList: false });
      fail(e);
    }
  },

  clearList: () => set({ list: [] }),

  create: async (societeId, exercice, note = "") => {
    try {
      const b = await api.post<Balance>("/balances", { societeId, exercice, note });
      set((st) => ({ list: [b, ...st.list] }));
      return b;
    } catch (e) {
      return fail(e);
    }
  },

  update: async (id, data) => {
    try {
      const b = await api.patch<Balance>(`/balances/${id}`, data);
      set((st) => ({
        list: st.list.map((x) => (x.id === id ? b : x)),
        current: st.current && st.current.id === id ? { ...st.current, ...b } : st.current,
      }));
    } catch (e) {
      fail(e);
    }
  },

  remove: async (id) => {
    try {
      await api.del(`/balances/${id}`);
      set((st) => ({ list: st.list.filter((x) => x.id !== id) }));
    } catch (e) {
      fail(e);
    }
  },

  fetchOne: async (id) => {
    set({ loadingCurrent: true });
    try {
      const current = await api.get<BalanceFull>(`/balances/${id}`);
      set({ current, loadingCurrent: false });
    } catch (e) {
      set({ loadingCurrent: false });
      fail(e);
    }
  },

  clearCurrent: () => set({ current: null }),

  addLigne: async (balanceId, data) => {
    try {
      const ligne = await api.post<BalanceLigne>(`/balances/${balanceId}/lignes`, data);
      set((st) =>
        st.current && st.current.id === balanceId
          ? { current: { ...st.current, lignes: [...st.current.lignes, ligne] } }
          : {},
      );
    } catch (e) {
      fail(e);
    }
  },

  updateLigne: async (balanceId, ligneId, data) => {
    try {
      const ligne = await api.patch<BalanceLigne>(
        `/balances/${balanceId}/lignes/${ligneId}`,
        data,
      );
      set((st) =>
        st.current && st.current.id === balanceId
          ? {
              current: {
                ...st.current,
                lignes: st.current.lignes.map((l) => (l.id === ligneId ? ligne : l)),
              },
            }
          : {},
      );
    } catch (e) {
      fail(e);
    }
  },

  removeLigne: async (balanceId, ligneId) => {
    try {
      await api.del(`/balances/${balanceId}/lignes/${ligneId}`);
      set((st) =>
        st.current && st.current.id === balanceId
          ? {
              current: {
                ...st.current,
                lignes: st.current.lignes.filter((l) => l.id !== ligneId),
              },
            }
          : {},
      );
    } catch (e) {
      fail(e);
    }
  },

  replaceLignes: async (balanceId, lignes, societeId) => {
    try {
      const saved = await api.put<BalanceLigne[]>(`/balances/${balanceId}/lignes`, {
        lignes,
      });
      set((st) =>
        st.current && st.current.id === balanceId
          ? { current: { ...st.current, lignes: saved } }
          : {},
      );
      // La grille (comptes -> AFFECTAT, cabinet-wide et/ou société) a pu
      // être enrichie par l'import.
      get().fetchGrille(societeId);
    } catch (e) {
      fail(e);
    }
  },

  fetchGrille: async (societeId) => {
    try {
      const q = societeId ? `?societeId=${societeId}` : "";
      const { codes, comptes, comptesSociete } = await api.get<{
        codes: GrilleAffectatCode[];
        comptes: GrilleCompte[];
        comptesSociete?: GrilleCompte[];
      }>(`/grille-affectat${q}`);
      set({
        grilleCodes: codes,
        grilleComptes: comptes,
        grilleComptesSociete: comptesSociete ?? [],
        grilleLoaded: true,
      });
    } catch (e) {
      fail(e);
    }
  },

  renameCode: async (code, newCode) => {
    try {
      await api.post(`/grille-affectat/codes/${encodeURIComponent(code)}/rename`, {
        newCode,
      });
      await get().fetchGrille();
    } catch (e) {
      fail(e);
    }
  },

  updateCode: async (code, data) => {
    try {
      const updated = await api.patch<GrilleAffectatCode>(
        `/grille-affectat/codes/${encodeURIComponent(code)}`,
        data,
      );
      set((st) => ({
        grilleCodes: st.grilleCodes.map((c) => (c.code === code ? updated : c)),
      }));
    } catch (e) {
      fail(e);
    }
  },

  removeCode: async (code) => {
    try {
      await api.del(`/grille-affectat/codes/${encodeURIComponent(code)}`);
      set((st) => ({ grilleCodes: st.grilleCodes.filter((c) => c.code !== code) }));
    } catch (e) {
      fail(e);
    }
  },

  immoMouvements: [],
  loadingImmoMouvements: false,

  fetchImmoMouvements: async (societeId) => {
    set({ loadingImmoMouvements: true });
    try {
      const immoMouvements = await api.get<ImmoMouvement[]>(
        `/balances/immo-mouvements?societeId=${societeId}`,
      );
      set({ immoMouvements, loadingImmoMouvements: false });
    } catch (e) {
      set({ loadingImmoMouvements: false });
      fail(e);
    }
  },

  clearImmoMouvements: () => set({ immoMouvements: [] }),

  saveImmoMouvement: async (societeId, exercice, masse, data) => {
    try {
      const saved = await api.put<ImmoMouvement>("/balances/immo-mouvements", {
        societeId,
        exercice,
        masse,
        ...data,
      });
      set((st) => ({
        immoMouvements: [
          ...st.immoMouvements.filter((m) => !(m.exercice === exercice && m.masse === masse)),
          saved,
        ],
      }));
    } catch (e) {
      fail(e);
    }
  },

  financementMouvements: [],
  loadingFinancementMouvements: false,

  fetchFinancementMouvements: async (societeId) => {
    set({ loadingFinancementMouvements: true });
    try {
      const financementMouvements = await api.get<FinancementMouvement[]>(
        `/balances/financement-mouvements?societeId=${societeId}`,
      );
      set({ financementMouvements, loadingFinancementMouvements: false });
    } catch (e) {
      set({ loadingFinancementMouvements: false });
      fail(e);
    }
  },

  clearFinancementMouvements: () => set({ financementMouvements: [] }),

  saveFinancementMouvement: async (societeId, exercice, data) => {
    try {
      const saved = await api.put<FinancementMouvement>("/balances/financement-mouvements", {
        societeId,
        exercice,
        ...data,
      });
      set((st) => ({
        financementMouvements: [
          ...st.financementMouvements.filter((m) => m.exercice !== exercice),
          saved,
        ],
      }));
    } catch (e) {
      fail(e);
    }
  },

  tdrfLignes: [],
  loadingTdrfLignes: false,

  fetchTdrfLignes: async (societeId) => {
    set({ loadingTdrfLignes: true });
    try {
      const tdrfLignes = await api.get<TdrfLigne[]>(`/balances/tdrf-lignes?societeId=${societeId}`);
      set({ tdrfLignes, loadingTdrfLignes: false });
    } catch (e) {
      set({ loadingTdrfLignes: false });
      fail(e);
    }
  },

  clearTdrfLignes: () => set({ tdrfLignes: [] }),

  addTdrfLigne: async (societeId, exercice, kind, libelle, montant) => {
    try {
      const ligne = await api.post<TdrfLigne>("/balances/tdrf-lignes", {
        societeId,
        exercice,
        kind,
        libelle,
        montant,
      });
      set((st) => ({ tdrfLignes: [...st.tdrfLignes, ligne] }));
    } catch (e) {
      fail(e);
    }
  },

  updateTdrfLigne: async (id, data) => {
    try {
      const ligne = await api.patch<TdrfLigne>(`/balances/tdrf-lignes/${id}`, data);
      set((st) => ({ tdrfLignes: st.tdrfLignes.map((l) => (l.id === id ? ligne : l)) }));
    } catch (e) {
      fail(e);
    }
  },

  removeTdrfLigne: async (id) => {
    try {
      await api.del(`/balances/tdrf-lignes/${id}`);
      set((st) => ({ tdrfLignes: st.tdrfLignes.filter((l) => l.id !== id) }));
    } catch (e) {
      fail(e);
    }
  },

  tdrfParametres: [],
  loadingTdrfParametres: false,

  fetchTdrfParametres: async (societeId) => {
    set({ loadingTdrfParametres: true });
    try {
      const tdrfParametres = await api.get<TdrfParametres[]>(
        `/balances/tdrf-parametres?societeId=${societeId}`,
      );
      set({ tdrfParametres, loadingTdrfParametres: false });
    } catch (e) {
      set({ loadingTdrfParametres: false });
      fail(e);
    }
  },

  clearTdrfParametres: () => set({ tdrfParametres: [] }),

  saveTdrfParametres: async (societeId, exercice, data) => {
    try {
      const saved = await api.put<TdrfParametres>("/balances/tdrf-parametres", {
        societeId,
        exercice,
        ...data,
      });
      set((st) => ({
        tdrfParametres: [...st.tdrfParametres.filter((p) => p.exercice !== exercice), saved],
      }));
    } catch (e) {
      fail(e);
    }
  },
}));
