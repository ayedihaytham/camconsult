import type { CollecteFull } from "@/types";
import { TAB_BY_KEY } from "./tabs";

/** Colonnes jamais signalées comme manquantes (en plus des colonnes calculées). */
const SKIP: Record<string, string[]> = {
  // le solde se calcule tout seul (sauf 1re ligne = solde initial, laissé libre)
  etat_caisse: ["solde"],
};

const isEmpty = (v: unknown) =>
  v === undefined || v === null || String(v).trim() === "";

export interface Manque {
  onglet: string;
  /** index de ligne (null = tableau entier non rempli) */
  ordre: number | null;
  /** clé de colonne (null = tableau entier) */
  col: string | null;
  ref: string;
  texte: string;
}

/**
 * Liste TOUTES les cases vides de la collecte (hors colonnes calculées / ignorées).
 * - onglet sans aucune ligne → 1 manque « Tableau non rempli ».
 * - sinon 1 manque par (ligne, colonne) vide.
 */
export function computeManques(c: CollecteFull): Manque[] {
  const out: Manque[] = [];
  for (const key of c.onglets) {
    const def = TAB_BY_KEY[key];
    if (!def) continue;
    const label = def.label;
    const skip = new Set(SKIP[key] ?? []);
    const lignes = c.lignes
      .filter((l) => l.onglet === key)
      .sort((a, b) => a.ordre - b.ordre);

    if (lignes.length === 0) {
      out.push({
        onglet: key,
        ordre: null,
        col: null,
        ref: "Tableau non rempli",
        texte: `« ${label} » : aucune ligne saisie.`,
      });
      continue;
    }
    lignes.forEach((l, i) => {
      for (const col of def.columns) {
        if (col.computed || skip.has(col.key)) continue;
        if (isEmpty(l.data[col.key])) {
          out.push({
            onglet: key,
            ordre: i,
            col: col.key,
            ref: `Ligne ${i + 1} · ${col.label}`,
            texte: `« ${label} » — ligne ${i + 1} : « ${col.label} » à compléter.`,
          });
        }
      }
    });
  }
  return out;
}
