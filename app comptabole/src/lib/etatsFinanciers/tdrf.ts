import type { TdrfLigne, TdrfParametres } from "@/types";

export interface TdrfResult {
  resultatComptable: number;
  totalReintegrations: number;
  totalDeductions: number;
  /** Résultat fiscal = résultat imposable dans ce modèle : les ajustements
   * propres à un exercice (déficits reportés, amortissements différés…) se
   * saisissent comme des lignes de déduction/réintégration libres, il n'y a
   * pas d'étage séparé — voir tdrf_lignes. */
  resultatFiscal: number;

  chiffreAffairesLocal: number;
  chiffreAffairesExport: number;
  tauxImposition: number;
  tauxExport: number;
  tauxMinimum: number;
  plancherMinimum: number;
  /** IS calculé sur le résultat imposable (0 si négatif ou nul), réparti au
   * prorata du CA local/export entre les deux taux. */
  isCalcule: number;
  /** Minimum d'impôt = max(CA LOCAL × taux minimum, plancher) — la part
   * export en est exclue. */
  minimumImpot: number;
  /** Impôt sur les sociétés dû = max(IS calculé, minimum d'impôt). */
  impotSocietes: number;
  contributionSociale: number;
  excedentsAcomptes: number;
  /** Impôts à payer / (report) = IS dû + CSS − acomptes et excédents imputables. */
  impotsAPayer: number;
  /** Impôt dû / résultat comptable — négatif si résultat comptable négatif
   * (cas d'un exercice déficitaire redevable du minimum d'impôt), null si
   * résultat comptable nul. */
  tauxEffectif: number | null;
}

const DEFAULT_PARAMETRES = {
  chiffreAffairesLocal: 0,
  chiffreAffairesExport: 0,
  tauxImposition: 0.2,
  tauxExport: 0.2,
  tauxMinimum: 0.002,
  plancherMinimum: 500,
  contributionSociale: 0,
  excedentsAcomptes: 0,
};

/** Résultat fiscal = résultat comptable AVANT IMPÔT + réintégrations −
 * déductions (jugement professionnel propre à chaque exercice, saisi
 * librement — voir tdrf_lignes, rien de tout ça n'est dans la balance).
 *
 * La suite (Annexe n°2 à la note commune n°26/2016) : le résultat imposable
 * positif est réparti au prorata du chiffre d'affaires local/export, chaque
 * part taxée à son propre taux — une société partiellement exportatrice
 * bénéficie typiquement d'un taux réduit sur l'ensemble de ses bénéfices et
 * d'un taux encore plus favorable sur la part export (régime courant ~15 %
 * / ~10 %, mais rien n'est figé : tout est saisi par exercice). Comparé au
 * minimum d'impôt, qui ne porte QUE sur le CA local (le CA export en est
 * exclu) — l'impôt dû est le plus élevé des deux, comme le prévoit la loi
 * même en cas de déficit ou de régime de faveur. Contribution sociale de
 * solidarité et acomptes/excédents imputables s'ajoutent pour obtenir les
 * impôts à payer. Taux/plancher par défaut = simple point de départ
 * (identiques local/export tant que rien n'est saisi, dégénérant vers le
 * calcul standard) : à corriger par l'expert-comptable exercice par
 * exercice selon le régime réel de la société et la loi de finances en
 * vigueur cette année-là.
 */
export function computeTdrf(
  resultatComptable: number,
  lignes: TdrfLigne[],
  parametres?: Partial<TdrfParametres>,
): TdrfResult {
  const totalReintegrations = lignes
    .filter((l) => l.kind === "reintegration")
    .reduce((s, l) => s + l.montant, 0);
  const totalDeductions = lignes
    .filter((l) => l.kind === "deduction")
    .reduce((s, l) => s + l.montant, 0);
  const resultatFiscal = resultatComptable + totalReintegrations - totalDeductions;

  const p = { ...DEFAULT_PARAMETRES, ...parametres };

  const caTotal = p.chiffreAffairesLocal + p.chiffreAffairesExport;
  const partExport = caTotal > 0 ? p.chiffreAffairesExport / caTotal : 0;
  const resultatImposablePositif = Math.max(0, resultatFiscal);
  const isCalcule =
    resultatImposablePositif * (1 - partExport) * p.tauxImposition +
    resultatImposablePositif * partExport * p.tauxExport;
  const minimumImpot = Math.max(p.chiffreAffairesLocal * p.tauxMinimum, p.plancherMinimum);
  const impotSocietes = Math.max(isCalcule, minimumImpot);
  const impotsAPayer = impotSocietes + p.contributionSociale - p.excedentsAcomptes;
  const tauxEffectif = resultatComptable !== 0 ? impotSocietes / resultatComptable : null;

  return {
    resultatComptable,
    totalReintegrations,
    totalDeductions,
    resultatFiscal,
    chiffreAffairesLocal: p.chiffreAffairesLocal,
    chiffreAffairesExport: p.chiffreAffairesExport,
    tauxImposition: p.tauxImposition,
    tauxExport: p.tauxExport,
    tauxMinimum: p.tauxMinimum,
    plancherMinimum: p.plancherMinimum,
    isCalcule,
    minimumImpot,
    impotSocietes,
    contributionSociale: p.contributionSociale,
    excedentsAcomptes: p.excedentsAcomptes,
    impotsAPayer,
    tauxEffectif,
  };
}
