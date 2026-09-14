import { create } from "zustand";
import { api } from "@/lib/api";

export type JournalAction =
  | "creation"
  | "modification"
  | "suppression"
  | "duplication"
  | "connexion"
  | "deconnexion"
  | "reinitialisation"
  | "import"
  | "acces";

export type JournalEntity =
  | "societe"
  | "employe"
  | "employe_societe"
  | "tache"
  | "collecte"
  | "bordereau"
  | "stock"
  | "balance"
  | "dossier"
  | "fichier"
  | "message"
  | "compte"
  | "donnees";

export interface JournalEntry {
  id: string;
  at: string;
  actor: string;
  action: JournalAction;
  entity: JournalEntity;
  label: string;
}

interface JournalState {
  entries: JournalEntry[];
  loading: boolean;
  fetch: () => Promise<void>;
  clear: () => Promise<void>;
}

export const useJournal = create<JournalState>((set) => ({
  entries: [],
  loading: false,
  fetch: async () => {
    set({ loading: true });
    try {
      const entries = await api.get<JournalEntry[]>("/journal");
      set({ entries, loading: false });
    } catch {
      set({ loading: false });
    }
  },
  clear: async () => {
    await api.del("/journal");
    set({ entries: [] });
  },
}));

/**
 * Conservé pour compatibilité : le journal est désormais alimenté
 * automatiquement côté serveur à chaque action. No-op côté client.
 */
export function logJournal(
  _action: JournalAction,
  _entity: JournalEntity,
  _label: string,
  _actor?: string,
): void {
  /* no-op — journalisation serveur */
}

export function registerActorResolver(_fn: () => string): void {
  /* no-op — l'acteur est déterminé côté serveur via le jeton */
}
