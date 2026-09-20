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

  // ── Cascade détaillée (Annexe n°2, note commune n°26/2016) — chaque
  // "code B/P" du document officiel, dans l'ordre où il se calcule.
  resultatFiscalAvantDeductionProvisions: number;
  provisionsDeductibles: number;
  plafondProvisions: number;
  resultatFiscalApresProvisions: number;
  moinsValueLeveeOptionDeductible: number;
  plafondMoinsValueLeveeOption: number;
  resultatFiscalAvantDeficitsAmortissements: number;
  resultatFiscalApresDeficitsAmortissements: number;
  resultatImposable: number;
}

const DEFAULT_PARAMETRES: TdrfParametres = {
  societeId: "",
  exercice: "",
  chiffreAffairesLocal: 0,
  chiffreAffairesExport: 0,
  tauxImposition: 0.2,
  tauxExport: 0.2,
  tauxMinimum: 0.002,
  plancherMinimum: 500,
  contributionSociale: 0,
  excedentsAcomptes: 0,
  pertesChangeNonRealisees: 0,
  gainsChangeNonRealisesAnterieurs: 0,
  remunerationsExcedentairesTitres: 0,
  chargesEspeces5000: 0,
  moinsValueCessionTitresOpcvm: 0,
  impotsDirectsLieuAutrui: 0,
  taxeVoyage: 0,
  transactionsAmendesPenalites: 0,
  depensesEssaimage: 0,
  facturesNonParvenues: 0,
  amortissementsBiensReevalues: 0,
  provisionsNonDeductibles: 0,
  provisionsCreancesDouteusesReintegrees: 0,
  produitsEtranger: 0,
  provisionsCreancesDouteuses: 0,
  provisionsDeprecStocksVente: 0,
  provisionsDeprecActionsCotees: 0,
  provisionsNonExigibiliteEngagements: 0,
  moinsValueLeveeOption: 0,
  reintegrationAmortissementsExercice: 0,
  deductionDeficitsReportes: 0,
  deductionAmortissementsExercice: 0,
  deductionAmortissementsDifferes: 0,
  interetsDepotsTitresDevises: 0,
  excedentsAnterieurs: 0,
  acomptesProvisionnelsPayes: 0,
  retenueALaSource: 0,
  avanceIrppImport: 0,
  majLe: null,
};

/** Résultat fiscal = résultat comptable AVANT IMPÔT + réintégrations −
 * déductions, en suivant exactement l'enchaînement de l'Annexe n°2 à la
 * note commune n°26/2016 (chaque "code B/P" du document officiel) :
 *
 * 1. Réintégrations (charges non déductibles, amortissements, provisions —
 *    lignes standard du formulaire, + tout ce d'autre ajouté librement en
 *    tdrf_lignes) → Résultat fiscal AVANT déduction des provisions.
 * 2. Déduction des provisions, plafonnée à 50% de ce résultat (0 si le
 *    résultat est négatif — aucune provision n'est déductible en l'absence
 *    de bénéfice fiscal à limiter) → Résultat fiscal APRÈS provisions.
 * 3. Déduction de la moins-value de levée d'option, plafonnée à 5% du
 *    résultat après provisions → Résultat fiscal avant déficits/amort.
 * 4. Amortissements différés et déficits reportés (signes mixtes : la
 *    "réintégration des amortissements de l'exercice" s'ajoute, le reste se
 *    déduit) → Résultat fiscal après déficits et amortissements.
 * 5. Bénéfices/revenus exceptionnels non imposables + tout le reste ajouté
 *    librement en tdrf_lignes (déductions non couvertes par le formulaire
 *    standard) → RÉSULTAT IMPOSABLE.
 *
 * La suite (IS/minimum d'impôt réparti local/export, CSS, impôts à payer)
 * reste inchangée par rapport à la version précédente de ce module.
 */
export function computeTdrf(
  resultatComptable: number,
  lignes: TdrfLigne[],
  parametres?: Partial<TdrfParametres>,
): TdrfResult {
  const p = { ...DEFAULT_PARAMETRES, ...parametres };

  // Lignes libres (tdrf_lignes) — tout ce que le formulaire standard ne
  // prévoit pas, ajouté par l'expert-comptable au cas par cas.
  const totalReintegrationsLibres = lignes
    .filter((l) => l.kind === "reintegration")
    .reduce((s, l) => s + l.montant, 0);
  const totalDeductionsLibres = lignes
    .filter((l) => l.kind === "deduction")
    .reduce((s, l) => s + l.montant, 0);

  const totalReintegrationsStandard =
    p.pertesChangeNonRealisees +
    p.gainsChangeNonRealisesAnterieurs +
    p.remunerationsExcedentairesTitres +
    p.chargesEspeces5000 +
    p.moinsValueCessionTitresOpcvm +
    p.impotsDirectsLieuAutrui +
    p.taxeVoyage +
    p.transactionsAmendesPenalites +
    p.depensesEssaimage +
    p.facturesNonParvenues +
    p.amortissementsBiensReevalues +
    p.provisionsNonDeductibles +
    p.provisionsCreancesDouteusesReintegrees;
  const totalReintegrations = totalReintegrationsStandard + totalReintegrationsLibres;

  // Étape 1 — avant déduction des provisions
  const resultatFiscalAvantDeductionProvisions =
    resultatComptable + totalReintegrations - p.produitsEtranger;

  // Étape 2 — provisions, plafonnées à 50% du résultat ci-dessus
  const sommeProvisions =
    p.provisionsCreancesDouteuses +
    p.provisionsDeprecStocksVente +
    p.provisionsDeprecActionsCotees +
    p.provisionsNonExigibiliteEngagements;
  const plafondProvisions = Math.max(0, 0.5 * resultatFiscalAvantDeductionProvisions);
  const provisionsDeductibles = Math.min(sommeProvisions, plafondProvisions);
  const resultatFiscalApresProvisions = resultatFiscalAvantDeductionProvisions - provisionsDeductibles;

  // Étape 3 — moins-value de levée d'option, plafonnée à 5%
  const plafondMoinsValueLeveeOption = Math.max(0, 0.05 * resultatFiscalApresProvisions);
  const moinsValueLeveeOptionDeductible = Math.min(p.moinsValueLeveeOption, plafondMoinsValueLeveeOption);
  const resultatFiscalAvantDeficitsAmortissements =
    resultatFiscalApresProvisions - moinsValueLeveeOptionDeductible;

  // Étape 4 — amortissements différés et déficits reportés (signes mixtes)
  const resultatFiscalApresDeficitsAmortissements =
    resultatFiscalAvantDeficitsAmortissements +
    p.reintegrationAmortissementsExercice -
    p.deductionDeficitsReportes -
    p.deductionAmortissementsExercice -
    p.deductionAmortissementsDifferes;

  // Étape 5 — bénéfices/revenus exceptionnels non imposables + déductions libres
  const resultatImposable =
    resultatFiscalApresDeficitsAmortissements - p.interetsDepotsTitresDevises - totalDeductionsLibres;

  const totalDeductions =
    p.produitsEtranger +
    provisionsDeductibles +
    moinsValueLeveeOptionDeductible +
    p.deductionDeficitsReportes +
    p.deductionAmortissementsExercice +
    p.deductionAmortissementsDifferes +
    p.interetsDepotsTitresDevises +
    totalDeductionsLibres -
    p.reintegrationAmortissementsExercice;

  const resultatFiscal = resultatImposable;

  const caTotal = p.chiffreAffairesLocal + p.chiffreAffairesExport;
  const partExport = caTotal > 0 ? p.chiffreAffairesExport / caTotal : 0;
  const resultatImposablePositif = Math.max(0, resultatImposable);
  const isCalcule =
    resultatImposablePositif * (1 - partExport) * p.tauxImposition +
    resultatImposablePositif * partExport * p.tauxExport;
  const minimumImpot = Math.max(p.chiffreAffairesLocal * p.tauxMinimum, p.plancherMinimum);
  const impotSocietes = Math.max(isCalcule, minimumImpot);
  const impotsAPayer =
    impotSocietes +
    p.contributionSociale -
    p.excedentsAcomptes -
    p.excedentsAnterieurs -
    p.acomptesProvisionnelsPayes -
    p.retenueALaSource -
    p.avanceIrppImport;
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
    resultatFiscalAvantDeductionProvisions,
    provisionsDeductibles,
    plafondProvisions,
    resultatFiscalApresProvisions,
    moinsValueLeveeOptionDeductible,
    plafondMoinsValueLeveeOption,
    resultatFiscalAvantDeficitsAmortissements,
    resultatFiscalApresDeficitsAmortissements,
    resultatImposable,
  };
}
