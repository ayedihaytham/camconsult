import { create } from "zustand";
import { safeLocalStorage } from "@/lib/safeStorage";

/** Dossiers (sociétés) ouverts comme onglets dans la barre du haut : pure commodité d'affichage, retenue d'une session à l'autre.
 * Ouvrir un onglet ne donne aucun accès : la société reste soumise aux droits de l'utilisateur à chaque affichage. */
const CLE = "cc.dossiers-ouverts.v1";
export const MAX_DOSSIERS_OUVERTS = 6;

function lire(): string[] {
  try {
    const brut = JSON.parse(safeLocalStorage.getItem(CLE) ?? "[]");
    return Array.isArray(brut) ? brut.filter((x): x is string => typeof x === "string").slice(-MAX_DOSSIERS_OUVERTS) : [];
  } catch {
    return [];
  }
}

interface DossiersOuvertsState {
  ids: string[];
  ouvrir: (id: string) => void;
  fermer: (id: string) => void;
}

export const useDossiersOuverts = create<DossiersOuvertsState>((set, get) => ({
  ids: lire(),
  ouvrir: (id) => {
    if (get().ids.includes(id)) return;
    const ids = [...get().ids, id].slice(-MAX_DOSSIERS_OUVERTS);
    safeLocalStorage.setItem(CLE, JSON.stringify(ids));
    set({ ids });
  },
  fermer: (id) => {
    const ids = get().ids.filter((x) => x !== id);
    safeLocalStorage.setItem(CLE, JSON.stringify(ids));
    set({ ids });
  },
}));
