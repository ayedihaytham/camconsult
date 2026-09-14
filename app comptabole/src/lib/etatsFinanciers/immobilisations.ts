import type { ImmoMasse, ImmoMouvement } from "@/types";
import type { Postes } from "./postes";

/**
 * Tableau des variations d'immobilisations — étape 3. La balance ne donne
 * que le solde de clôture ; les mouvements de l'exercice (acquisitions,
 * cessions, dotations, reprises) sont saisis manuellement (voir
 * `saveImmoMouvement` dans le store). L'ouverture est ensuite déduite par
 * calcul : ouverture = clôture − acquisitions + cessions (et de même pour
 * l'amortissement/provision), ce qui ne dépend donc pas d'avoir importé
 * l'exercice précédent — mais quand celui-ci existe, on peut recouper.
 */
export const MASSES: ImmoMasse[] = ["incorporelles", "corporelles", "financieres"];

export const MASSE_LABELS: Record<ImmoMasse, string> = {
  incorporelles: "Immobilisations incorporelles",
  corporelles: "Immobilisations corporelles",
  financieres: "Immobilisations financières",
};

/** Le compte de contrepartie s'appelle "Amortissements" pour les
 * incorporelles/corporelles, "Provisions" pour les financières (dépréciation,
 * pas amortissement, mais mécanique de variation identique). */
export const MASSE_AMORT_LABELS: Record<ImmoMasse, string> = {
  incorporelles: "Amortissements",
  corporelles: "Amortissements",
  financieres: "Provisions",
};

export const BRUT_KEY: Record<ImmoMasse, string> = {
  incorporelles: "actif.immo_incorp_brut",
  corporelles: "actif.immo_corp_brut",
  financieres: "actif.immo_fin",
};

export const AMORT_KEY: Record<ImmoMasse, string> = {
  incorporelles: "actif.immo_incorp_amort",
  corporelles: "actif.immo_corp_amort",
  financieres: "actif.immo_fin_provisions",
};

export interface ImmoVariationLigne {
  masse: ImmoMasse;
  brutOuverture: number;
  acquisitions: number;
  cessions: number;
  brutCloture: number;
  /** Écart entre l'ouverture déduite et le solde réel de l'exercice
   * précédent (s'il est importé) — signal de cohérence, pas bloquant. */
  brutOuvertureEcart: number | null;
  amortOuverture: number;
  dotations: number;
  reprises: number;
  amortCloture: number;
  netOuverture: number;
  netCloture: number;
}

function mouvementFor(mouvements: ImmoMouvement[], exercice: string, masse: ImmoMasse) {
  return (
    mouvements.find((m) => m.exercice === exercice && m.masse === masse) ?? {
      acquisitions: 0,
      cessions: 0,
      dotations: 0,
      reprises: 0,
    }
  );
}

/**
 * Suggère acquisitions/cessions/dotations/reprises pour un exercice+masse à
 * partir de la balance, quand l'exercice précédent est disponible — sans
 * remplacer la saisie manuelle. Principe : les postes d'immobilisations sont
 * enregistrés en cumul depuis l'origine (débit = total des entrées jamais
 * enregistrées, crédit = total des sorties), donc la variation d'une année
 * sur l'autre du débit cumulé = les entrées de l'exercice, et du crédit
 * cumulé = les sorties — vérifié sur des données réelles. Bornée à 0 en cas
 * de delta négatif (peut arriver si une cession a été enregistrée en
 * réduisant directement le débit plutôt que via un crédit — écriture non
 * standard mais déjà rencontrée en pratique) : ce n'est alors qu'une
 * suggestion à corriger, jamais une valeur imposée.
 */
export function suggestImmoMouvement(
  masse: ImmoMasse,
  postesDebit: Postes,
  postesCredit: Postes,
  prevPostesDebit: Postes | null,
  prevPostesCredit: Postes | null,
): { acquisitions: number; cessions: number; dotations: number; reprises: number } | null {
  if (!prevPostesDebit || !prevPostesCredit) return null;
  const delta = (cur: Postes, prev: Postes, key: string) =>
    Math.max(0, (cur[key] ?? 0) - (prev[key] ?? 0));
  return {
    acquisitions: delta(postesDebit, prevPostesDebit, BRUT_KEY[masse]),
    cessions: delta(postesCredit, prevPostesCredit, BRUT_KEY[masse]),
    dotations: delta(postesCredit, prevPostesCredit, AMORT_KEY[masse]),
    reprises: delta(postesDebit, prevPostesDebit, AMORT_KEY[masse]),
  };
}

export function computeImmoVariation(
  exercice: string,
  postes: Postes,
  postesPrecedent: Postes | null,
  mouvements: ImmoMouvement[],
): ImmoVariationLigne[] {
  return MASSES.map((masse) => {
    const m = mouvementFor(mouvements, exercice, masse);
    const brutCloture = postes[BRUT_KEY[masse]] ?? 0;
    // Poste "amortissements" négatif par nature (compte de contrepartie
    // créditeur) — on manipule la magnitude positive pour l'affichage.
    const amortCloture = -(postes[AMORT_KEY[masse]] ?? 0);
    const brutOuverture = brutCloture - m.acquisitions + m.cessions;
    const amortOuverture = amortCloture - m.dotations + m.reprises;
    const brutOuvertureBalance = postesPrecedent ? (postesPrecedent[BRUT_KEY[masse]] ?? 0) : null;

    return {
      masse,
      brutOuverture,
      acquisitions: m.acquisitions,
      cessions: m.cessions,
      brutCloture,
      brutOuvertureEcart:
        brutOuvertureBalance === null ? null : brutOuverture - brutOuvertureBalance,
      amortOuverture,
      dotations: m.dotations,
      reprises: m.reprises,
      amortCloture,
      netOuverture: brutOuverture - amortOuverture,
      netCloture: brutCloture - amortCloture,
    };
  });
}
