/** Compteurs du bandeau de la page Conversions, remontés par chaque sens de conversion. */
export interface StatsConversion {
  fichiers: number;
  convertis: number;
  erreurs: number;
  /** Feuilles (Excel vers PDF) ou tableaux (PDF vers Excel) prêts. */
  elements: number;
  libelleElements: string;
}

export const STATS_VIDES: StatsConversion = { fichiers: 0, convertis: 0, erreurs: 0, elements: 0, libelleElements: "Tableaux" };
