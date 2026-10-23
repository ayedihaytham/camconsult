/** Préférences d'affichage du tableau de stock : colonnes visibles et densité. Gardées dans ce navigateur seulement. */
export type ColonneStock = "cours" | "devise" | "tnd" | "piece" | "douane";
export type DensiteStock = "compact" | "aere";

export interface PrefsTableauStock {
  colonnes: Record<ColonneStock, boolean>;
  densite: DensiteStock;
}

export const COLONNES_MASQUABLES: { cle: ColonneStock; nom: string }[] = [
  { cle: "cours", nom: "Cours" },
  { cle: "devise", nom: "En devise et devise" },
  { cle: "tnd", nom: "Montant TND" },
  { cle: "piece", nom: "Pièce" },
  { cle: "douane", nom: "Douane" },
];

/** La douane est masquée au départ : elle se consulte dans le panneau du mouvement. */
export const PREFS_PAR_DEFAUT: PrefsTableauStock = {
  colonnes: { cours: true, devise: true, tnd: true, piece: true, douane: false },
  densite: "compact",
};

const CLE = "cabinet.stock.tableau";

export function lirePrefsStock(): PrefsTableauStock {
  try {
    const brut = JSON.parse(window.localStorage.getItem(CLE) ?? "null") as Partial<PrefsTableauStock> | null;
    if (!brut || typeof brut !== "object") return PREFS_PAR_DEFAUT;
    return {
      colonnes: { ...PREFS_PAR_DEFAUT.colonnes, ...(typeof brut.colonnes === "object" && brut.colonnes ? brut.colonnes : {}) },
      densite: brut.densite === "aere" ? "aere" : "compact",
    };
  } catch {
    return PREFS_PAR_DEFAUT;
  }
}

export function ecrirePrefsStock(prefs: PrefsTableauStock) {
  try {
    window.localStorage.setItem(CLE, JSON.stringify(prefs));
  } catch {
    /* navigation privée ou stockage bloqué : les préférences ne sont pas gardées, l'écran fonctionne */
  }
}
