import type { FinancementMouvement, ImmoMouvement } from "@/types";
import type { PostesExercice } from "@/store/balances";
import { resultatNet, type Postes } from "./postes";

/**
 * Flux de trésorerie — méthode indirecte, structure et libellés calqués sur
 * le document réel du cabinet (résultat net + ajustements + variations,
 * PAS le modèle de référence "méthode directe" évoqué dans le texte des
 * Notes — c'est le document réel qui fait foi, le texte a été corrigé en
 * conséquence).
 *
 * Le volet investissement réutilise les mouvements saisis pour le TAB VAR
 * Immob (présentés nets, comme dans le document : une seule ligne
 * Acquisition/Cession par masse). Le volet financement combine des postes
 * déjà suivis dans la balance (Variation des placements, depuis
 * actif.placements) et des mouvements saisis manuellement (augmentation de
 * capital, dividendes — ainsi qu'emprunts contractés/remboursés, absents du
 * document de ce client mais gardés disponibles pour les clients qui en
 * ont).
 */

export interface FluxResult {
  exercice: string;
  aExercicePrecedent: boolean;

  resultatNet: number;
  dotationsNettes: number;
  interetsCourusNonEchus: number;
  variationClients: number | null;
  variationAutresActifs: number | null;
  variationFournisseursAutresDettes: number | null;
  variationModificationsComptables: number | null;
  fluxExploitation: number | null;

  acquisitionCessionImmoCorpIncorp: number;
  acquisitionCessionImmoFin: number;
  fluxInvestissement: number;

  variationPlacements: number | null;
  capitalNumeraire: number;
  dividendesDistribues: number;
  empruntsContractes: number;
  empruntsRembourses: number;
  fluxFinancement: number | null;

  variationTresorerie: number | null;
  tresorerieOuverture: number | null;
  tresorerieCloture: number;
}

const ZERO_FINANCEMENT = {
  empruntsContractes: 0,
  empruntsRembourses: 0,
  dividendesDistribues: 0,
  capitalNumeraire: 0,
  interetsCourusNonEchus: 0,
};

/** Contribution en trésorerie d'un poste de bilan : identité "solde N-1 −
 * solde N", valable pour un actif comme pour un passif grâce à la
 * convention débit − crédit. null si l'exercice précédent n'est pas
 * disponible. */
function variationCash(
  prev: Record<string, number> | null,
  current: Record<string, number>,
  key: string,
): number | null {
  if (!prev) return null;
  return (prev[key] ?? 0) - (current[key] ?? 0);
}

/**
 * Suggère emprunts contractés/remboursés pour un exercice à partir de la
 * balance, quand l'exercice précédent est disponible — même principe que
 * suggestImmoMouvement() : le poste passif.emprunts est enregistré en cumul
 * depuis l'origine (crédit cumulé = total des emprunts contractés, débit
 * cumulé = total des remboursements), donc la variation d'une année sur
 * l'autre du crédit cumulé = les emprunts contractés dans l'exercice, et du
 * débit cumulé = les remboursements. Bornée à 0, simple suggestion
 * modifiable — jamais une valeur imposée.
 */
export function suggestEmpruntsMouvement(
  postesDebit: Postes,
  postesCredit: Postes,
  prevPostesDebit: Postes | null,
  prevPostesCredit: Postes | null,
): { empruntsContractes: number; empruntsRembourses: number } | null {
  if (!prevPostesDebit || !prevPostesCredit) return null;
  const delta = (cur: Postes, prev: Postes, key: string) =>
    Math.max(0, (cur[key] ?? 0) - (prev[key] ?? 0));
  return {
    empruntsContractes: delta(postesCredit, prevPostesCredit, "passif.emprunts"),
    empruntsRembourses: delta(postesDebit, prevPostesDebit, "passif.emprunts"),
  };
}

export function computeFlux(
  exercices: PostesExercice[], // du plus récent au plus ancien, comme renvoyé par l'API
  immoMouvements: ImmoMouvement[],
  financementMouvements: FinancementMouvement[],
): FluxResult[] {
  const chrono = [...exercices].sort((a, b) => a.exercice.localeCompare(b.exercice));

  const results = chrono.map((e, i) => {
    const prev = i > 0 ? chrono[i - 1] : null;
    const prevPostes = prev ? prev.postes : null;
    const postes = e.postes;

    const fin = financementMouvements.find((f) => f.exercice === e.exercice) ?? ZERO_FINANCEMENT;

    const rNet = resultatNet(postes);
    const dotationsNettes =
      (postes["cpc.dotations_amort_provisions"] ?? 0) + (postes["cpc.reprises_provisions"] ?? 0);
    const interetsCourusNonEchus = fin.interetsCourusNonEchus;

    const variationClients = variationCash(prevPostes, postes, "actif.clients");
    // "Autres actifs" : autres actifs courants + stocks (le document du
    // client ne montre pas les stocks séparément — regroupés ici pour ne
    // rien perdre pour les clients qui en ont).
    const variationAutresActifs =
      prevPostes === null
        ? null
        : (variationCash(prevPostes, postes, "actif.autres_courants") ?? 0) +
          (variationCash(prevPostes, postes, "actif.stocks") ?? 0);
    const variationFournisseursAutresDettes =
      prevPostes === null
        ? null
        : (variationCash(prevPostes, postes, "passif.fournisseurs") ?? 0) +
          (variationCash(prevPostes, postes, "passif.autres_passifs_courants") ?? 0);
    // Vérifié contre le document réel du cabinet : la ligne "Modifications
    // comptables" y reflète en réalité la variation des Provisions (P03),
    // pas passif.modifications_comptables (jamais alimenté pour ce client).
    const variationModificationsComptables = variationCash(prevPostes, postes, "passif.provisions");

    const fluxExploitation =
      variationClients === null ||
      variationAutresActifs === null ||
      variationFournisseursAutresDettes === null ||
      variationModificationsComptables === null
        ? null
        : rNet +
          dotationsNettes +
          interetsCourusNonEchus +
          variationClients +
          variationAutresActifs +
          variationFournisseursAutresDettes +
          variationModificationsComptables;

    const immoCorpIncorp = immoMouvements.filter(
      (m) => m.exercice === e.exercice && m.masse !== "financieres",
    );
    const immoFin = immoMouvements.filter(
      (m) => m.exercice === e.exercice && m.masse === "financieres",
    );
    const acquisitionCessionImmoCorpIncorp = immoCorpIncorp.reduce(
      (s, m) => s + m.cessions - m.acquisitions,
      0,
    );
    const acquisitionCessionImmoFin = immoFin.reduce((s, m) => s + m.cessions - m.acquisitions, 0);
    const fluxInvestissement = acquisitionCessionImmoCorpIncorp + acquisitionCessionImmoFin;

    const variationPlacements = variationCash(prevPostes, postes, "actif.placements");
    const fluxFinancement =
      variationPlacements === null
        ? null
        : variationPlacements +
          fin.capitalNumeraire +
          fin.empruntsContractes -
          fin.empruntsRembourses -
          fin.dividendesDistribues;

    const variationTresorerie =
      fluxExploitation === null || fluxFinancement === null
        ? null
        : fluxExploitation + fluxInvestissement + fluxFinancement;
    const tresorerieCloture = postes["actif.liquidites"] ?? 0;
    const tresorerieOuverture = prevPostes ? (prevPostes["actif.liquidites"] ?? 0) : null;

    return {
      exercice: e.exercice,
      aExercicePrecedent: Boolean(prev),
      resultatNet: rNet,
      dotationsNettes,
      interetsCourusNonEchus,
      variationClients,
      variationAutresActifs,
      variationFournisseursAutresDettes,
      variationModificationsComptables,
      fluxExploitation,
      acquisitionCessionImmoCorpIncorp,
      acquisitionCessionImmoFin,
      fluxInvestissement,
      variationPlacements,
      capitalNumeraire: fin.capitalNumeraire,
      dividendesDistribues: fin.dividendesDistribues,
      empruntsContractes: fin.empruntsContractes,
      empruntsRembourses: fin.empruntsRembourses,
      fluxFinancement,
      variationTresorerie,
      tresorerieOuverture,
      tresorerieCloture,
    };
  });

  return results.reverse(); // le plus récent d'abord, comme les autres tableaux du module
}
