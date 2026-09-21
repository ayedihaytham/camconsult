import {
  computeRows,
  computeSig,
  resultatNet,
  resultatComptableAvantImpot,
  ROWS_BILAN_ACTIF,
  ROWS_BILAN_PASSIF,
  ROWS_ETAT_RESULTAT,
} from "./postes";
import { computeFlux } from "./flux";
import { computeTdrf } from "./tdrf";
import type { PostesExercice } from "@/store/balances";
import type { FinancementMouvement, ImmoMouvement, TdrfLigne, TdrfParametres } from "@/types";

export interface ControleLigne {
  libelle: string;
  sourceLabel1: string;
  valeur1: number;
  sourceLabel2: string;
  valeur2: number;
}

export interface ControleExercice {
  exercice: string;
  lignes: ControleLigne[];
}

export interface ControleMargeLigne {
  exercice: string;
  exercicePrecedent: string;
  productionVentes1: number;
  productionVentes2: number;
  achatsConsommes1: number;
  achatsConsommes2: number;
  margeValeur1: number;
  margeValeur2: number;
  margePct1: number | null;
  margePct2: number | null;
}

const ECART_SEUIL = 0.01;

export function ecartNonNul(l: ControleLigne): boolean {
  return Math.abs(l.valeur1 - l.valeur2) > ECART_SEUIL;
}

/** Tableau de contrôle des états financiers — recoupe les tableaux déjà
 * calculés du module (Bilan, État de résultat, SIG, Flux, TDRF), qui
 * partagent la même donnée source (postesParExercice) mais des chemins de
 * calcul en partie indépendants. Certains recoupements (résultat net Bilan
 * / État de résultat / SIG / Flux) sont vrais par construction dans cette
 * appli — les mêmes fonctions calculent la même chose — et servent surtout
 * de garde-fou visuel si cette identité venait à être cassée par une
 * évolution future. Les deux qui comptent vraiment, parce qu'ils recoupent
 * des chemins de calcul RÉELLEMENT indépendants :
 * - Impôt sur les sociétés comptabilisé (cpc.impot_societes, dans la
 *   balance) vs calculé par le TDRF (taux/CA saisis à la main) — un écart
 *   signale une provision d'IS mal comptabilisée ou des paramètres TDRF
 *   erronés.
 * - Trésorerie de clôture du Bilan (solde réel de la balance) vs celle du
 *   Flux de trésorerie (reconstruite à partir des mouvements saisis) — un
 *   écart signale un mouvement d'immobilisation/financement manquant ou
 *   faux.
 */
export function computeControle(
  exercices: PostesExercice[],
  immoMouvements: ImmoMouvement[],
  financementMouvements: FinancementMouvement[],
  tdrfLignes: TdrfLigne[],
  tdrfParametres: TdrfParametres[],
): ControleExercice[] {
  const chrono = [...exercices].sort((a, b) => b.exercice.localeCompare(a.exercice));
  const flux = computeFlux(exercices, immoMouvements, financementMouvements);

  return chrono.map((e) => {
    const rowsActif = computeRows(ROWS_BILAN_ACTIF, e.postes);
    const rNet = resultatNet(e.postes);
    const rowsPassif = computeRows(ROWS_BILAN_PASSIF, e.postes, { resultat_exercice: rNet });
    const rowsResultat = computeRows(ROWS_ETAT_RESULTAT, e.postes);
    const sig = computeSig(e.postes);
    const fluxExercice = flux.find((f) => f.exercice === e.exercice);

    const tdrfResult = computeTdrf(
      resultatComptableAvantImpot(e.postes),
      tdrfLignes.filter((l) => l.exercice === e.exercice),
      tdrfParametres.find((p) => p.exercice === e.exercice),
    );

    const lignes: ControleLigne[] = [
      {
        libelle: "Total",
        sourceLabel1: "ACTIF DU BILAN",
        valeur1: rowsActif.total_actifs ?? 0,
        sourceLabel2: "PASSIF DU BILAN",
        valeur2: rowsPassif.total_cp_et_passifs ?? 0,
      },
      {
        libelle: "Résultat net de l'exercice",
        sourceLabel1: "BILAN",
        valeur1: rNet,
        sourceLabel2: "ÉTAT DE RÉSULTAT",
        valeur2: rowsResultat.resultat_net_er ?? 0,
      },
      {
        libelle: "Résultat net de l'exercice",
        sourceLabel1: "S.I.G.",
        valeur1: sig.resultatNet,
        sourceLabel2: "ÉTAT DE RÉSULTAT",
        valeur2: rowsResultat.resultat_net_er ?? 0,
      },
      {
        libelle: "Résultat net de l'exercice",
        sourceLabel1: "BILAN",
        valeur1: rNet,
        sourceLabel2: "FLUX DE TRÉSORERIE",
        valeur2: fluxExercice?.resultatNet ?? 0,
      },
      {
        libelle: "Impôt sur les sociétés",
        sourceLabel1: "BILAN / ÉTAT DE RÉSULTAT (comptabilisé)",
        valeur1: e.postes["cpc.impot_societes"] ?? 0,
        sourceLabel2: "TDRF (calculé)",
        valeur2: tdrfResult.impotSocietes,
      },
      {
        libelle: "Trésorerie de fin de période",
        sourceLabel1: "BILAN",
        valeur1: e.postes["actif.liquidites"] ?? 0,
        sourceLabel2: "FLUX DE TRÉSORERIE",
        valeur2: fluxExercice?.tresorerieCloture ?? 0,
      },
    ];

    return { exercice: e.exercice, lignes };
  });
}

/** Contrôle de marge — comparaison Production/Ventes et Achats consommés
 * d'un exercice à l'autre, pour repérer une variation de marge anormale
 * (analytique, pas une identité comptable — jamais "en écart" au sens
 * strict, juste un signal à interpréter). */
export function computeControleMarge(exercices: PostesExercice[]): ControleMargeLigne[] {
  const chrono = [...exercices].sort((a, b) => b.exercice.localeCompare(a.exercice));
  const out: ControleMargeLigne[] = [];
  for (let i = 0; i < chrono.length - 1; i++) {
    const cur = chrono[i];
    const prev = chrono[i + 1];
    const rowsCur = computeRows(ROWS_ETAT_RESULTAT, cur.postes);
    const rowsPrev = computeRows(ROWS_ETAT_RESULTAT, prev.postes);
    const productionVentes1 = rowsCur.total_produits_expl ?? 0;
    const productionVentes2 = rowsPrev.total_produits_expl ?? 0;
    // Rows en sign:-1 (convention Etat de résultat) : une charge y est déjà
    // négative — on récupère ici la magnitude positive du coût.
    const achats1 = -(rowsCur.achats ?? 0) - (rowsCur.achats_marchandises ?? 0) - (rowsCur.achats_approvisionnements ?? 0);
    const achats2 = -(rowsPrev.achats ?? 0) - (rowsPrev.achats_marchandises ?? 0) - (rowsPrev.achats_approvisionnements ?? 0);
    const marge1 = productionVentes1 - achats1;
    const marge2 = productionVentes2 - achats2;
    out.push({
      exercice: cur.exercice,
      exercicePrecedent: prev.exercice,
      productionVentes1,
      productionVentes2,
      achatsConsommes1: achats1,
      achatsConsommes2: achats2,
      margeValeur1: marge1,
      margeValeur2: marge2,
      margePct1: productionVentes1 !== 0 ? marge1 / productionVentes1 : null,
      margePct2: productionVentes2 !== 0 ? marge2 / productionVentes2 : null,
    });
  }
  return out;
}
