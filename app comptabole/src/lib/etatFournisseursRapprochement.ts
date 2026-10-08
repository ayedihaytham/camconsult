import { cleNumero } from "@/lib/facturesDoublons";
import type { FactureClasseur, FeuilleFournisseur, ReglementClasseur } from "@/lib/etatFournisseursClasseur";
import type { FactureFournisseur, ModeReglement } from "@/types";

const r3 = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000;
/** En dessous, un écart est un arrondi du classeur (1 TND), pas une erreur. */
export const TOLERANCE = 1;

export type EtatPlan = "ok" | "partiel" | "excedent" | "orphelin" | "incomplet";

/** Un règlement du classeur réparti sur les lignes de facture qu'il solde. */
export interface PlanReglement {
  index: number;
  reglement: ReglementClasseur;
  /** Montant porté par chaque ligne de facture du classeur (indice dans `factures`). */
  parts: { facture: number; montant: number }[];
  /** Total réglé : montant viré + retenue à la source. */
  brut: number;
  /** Ce qui n'a pu être imputé sur aucune facture. */
  excedent: number;
  etat: EtatPlan;
  /** Numéros de facture de ce règlement absents de la gestion de stock (ou ambigus). */
  manquants: string[];
  /** Phrase courte qui explique l'état. */
  note: string;
}

/** Répartit chaque règlement sur les factures, dans l'ordre du classeur.
 *
 * Un règlement solde d'abord les factures de sa propre ligne ; quand il dépasse leur total (paiement qui termine une
 * facture réglée en deux fois), il complète d'abord les factures déjà payées en partie, qui le précèdent. Un règlement
 * sans facture sur sa ligne (listé à part) solde les premières factures qui restent dues. */
export function planifier(feuille: FeuilleFournisseur): { plans: PlanReglement[]; restant: number[] } {
  const reste = feuille.factures.map((f) => f.montant);
  const aPaye = feuille.factures.map(() => false);
  const plans: PlanReglement[] = [];

  feuille.reglements.forEach((reglement, index) => {
    const brut = r3(reglement.vire + reglement.rsMontant);
    let aRepartir = brut;
    const parts: { facture: number; montant: number }[] = [];
    const prendre = (i: number) => {
      if (aRepartir <= 0.0005 || reste[i] <= 0.0005) return;
      const m = r3(Math.min(reste[i], aRepartir));
      reste[i] = r3(reste[i] - m);
      aRepartir = r3(aRepartir - m);
      aPaye[i] = true;
      const existante = parts.find((p) => p.facture === i);
      if (existante) existante.montant = r3(existante.montant + m);
      else parts.push({ facture: i, montant: m });
    };

    const propres = reglement.factures;
    if (propres.length > 0) {
      // 1. les factures de la ligne, dans l'ordre
      for (const i of propres) prendre(i);
      // 2. ce qui reste d'abord sur des factures payées en partie plus haut dans le classeur
      if (aRepartir > TOLERANCE) {
        const premiere = Math.min(...propres);
        for (let i = 0; i < premiere && aRepartir > TOLERANCE; i++) if (aPaye[i] && reste[i] > TOLERANCE) prendre(i);
      }
    } else {
      // Règlement listé à part : les premières factures encore dues.
      for (let i = 0; i < reste.length && aRepartir > 0.0005; i++) if (reste[i] > 0.0005) prendre(i);
    }

    const excedent = aRepartir > TOLERANCE ? r3(aRepartir) : 0;
    const partielle = parts.some((p) => reste[p.facture] > TOLERANCE);
    const etat: EtatPlan = propres.length === 0 ? "orphelin" : excedent > 0 ? "excedent" : partielle ? "partiel" : "ok";
    const fr = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
    plans.push({
      index,
      reglement,
      parts,
      brut,
      excedent,
      etat,
      manquants: [],
      note:
        etat === "ok"
          ? "Solde exactement les factures de sa ligne."
          : etat === "partiel"
            ? "Règle une partie seulement des factures : le reste est payé par un autre règlement, ou reste dû."
            : etat === "excedent"
              ? `Dépasse les factures de ${fr(excedent)} : écart à vérifier dans le classeur.`
              : parts.length > 0
                ? "Listé à part des factures : réparti sur les premières factures encore dues."
                : "Aucune facture à solder.",
    });
  });
  return { plans, restant: reste };
}

export interface MouvementRapproche {
  /** Mouvement de stock (facture d'achat) retrouvé. */
  id: string;
  fournisseurCle: string;
  /** Montant de la facture d'après la gestion de stock. */
  montant: number;
  devise: string;
  numFacture: string;
}

export interface LigneRapprochee {
  facture: FactureClasseur;
  mouvements: MouvementRapproche[];
  /** Numéros du classeur introuvables dans la gestion de stock. */
  manquants: string[];
  /** Numéros présents plusieurs fois dans la gestion de stock : impossible de choisir. */
  ambigus: string[];
}

/** Retrouve, pour chaque ligne du classeur, les factures d'achat correspondantes de la gestion de stock. */
export function rapprocherLignes(feuille: FeuilleFournisseur, stock: FactureFournisseur[]): LigneRapprochee[] {
  const parNumero = new Map<string, FactureFournisseur[]>();
  for (const f of stock) {
    const n = cleNumero(f.numFacture);
    if (n) parNumero.set(n, [...(parNumero.get(n) ?? []), f]);
  }
  return feuille.factures.map((facture) => {
    const mouvements: MouvementRapproche[] = [];
    const manquants: string[] = [];
    const ambigus: string[] = [];
    for (const n of facture.numeros) {
      const trouves = parNumero.get(n) ?? [];
      if (trouves.length === 1) {
        const f = trouves[0];
        mouvements.push({ id: f.id, fournisseurCle: f.fournisseurCle, montant: f.montant, devise: f.devise, numFacture: f.numFacture });
      } else if (trouves.length > 1) ambigus.push(n);
      else manquants.push(n);
    }
    // Une ligne sans numéro (facture pas encore établie) n'a rien à retrouver.
    if (facture.numeros.length === 0) manquants.push(facture.texteNumero || "sans numéro");
    return { facture, mouvements, manquants, ambigus };
  });
}

export interface AffectationPlan {
  mouvementId: string;
  montant: number;
}

export interface RapprochementFeuille {
  lignes: LigneRapprochee[];
  plans: PlanReglement[];
  /** Règlements prêts à être importés : toutes leurs factures sont dans la gestion de stock, d'un même fournisseur. */
  importables: { plan: PlanReglement; fournisseurCle: string; devise: string; affectations: AffectationPlan[] }[];
}

/** Répartit les montants d'un règlement sur les factures du stock : une ligne du classeur qui regroupe plusieurs factures
 * partage son montant entre elles, au prorata de leurs montants. */
function affecter(plan: PlanReglement, lignes: LigneRapprochee[]): AffectationPlan[] {
  const out = new Map<string, number>();
  for (const p of plan.parts) {
    const l = lignes[p.facture];
    const total = l.mouvements.reduce((s, m) => s + m.montant, 0);
    let dejaDonne = 0;
    l.mouvements.forEach((m, k) => {
      const dernier = k === l.mouvements.length - 1;
      const part = dernier ? r3(p.montant - dejaDonne) : r3(total > 0 ? (p.montant * m.montant) / total : p.montant / l.mouvements.length);
      dejaDonne = r3(dejaDonne + part);
      out.set(m.id, r3((out.get(m.id) ?? 0) + part));
    });
  }
  return [...out.entries()].filter(([, v]) => v > 0).map(([mouvementId, montant]) => ({ mouvementId, montant }));
}

/** Rapproche une feuille du classeur avec les factures d'achat de la gestion de stock. Un règlement n'est importable que si
 * toutes ses factures y sont (tout ou rien), pour qu'il garde le même sens que dans le classeur. */
export function rapprocherFeuille(feuille: FeuilleFournisseur, stock: FactureFournisseur[]): RapprochementFeuille {
  const lignes = rapprocherLignes(feuille, stock);
  const { plans } = planifier(feuille);
  const importables: RapprochementFeuille["importables"] = [];
  for (const plan of plans) {
    const concernees = plan.parts.map((p) => lignes[p.facture]);
    const manquants = concernees.flatMap((l) => [...l.manquants, ...l.ambigus]);
    if (plan.parts.length === 0) {
      plan.etat = "incomplet";
      plan.note = "Aucune facture à solder pour ce règlement.";
      continue;
    }
    if (manquants.length > 0) {
      plan.manquants = manquants;
      plan.etat = "incomplet";
      plan.note = `Facture${manquants.length > 1 ? "s" : ""} absente${manquants.length > 1 ? "s" : ""} de la gestion de stock : ${manquants.slice(0, 3).join(", ")}${manquants.length > 3 ? "…" : ""}.`;
      continue;
    }
    const cles = new Set(concernees.flatMap((l) => l.mouvements.map((m) => m.fournisseurCle)));
    const devises = new Set(concernees.flatMap((l) => l.mouvements.map((m) => m.devise)));
    if (cles.size !== 1 || devises.size !== 1) {
      plan.etat = "incomplet";
      plan.note = cles.size !== 1 ? "Les factures de ce règlement ne sont pas du même fournisseur dans la gestion de stock." : "Les factures de ce règlement n'ont pas la même devise dans la gestion de stock.";
      continue;
    }
    importables.push({ plan, fournisseurCle: [...cles][0], devise: [...devises][0], affectations: affecter(plan, lignes) });
  }
  return { lignes, plans, importables };
}

/** Mode sans objet pour l'API : le mode est celui du classeur. */
export type ModeClasseur = ModeReglement;

/** Anomalies d'une ligne du classeur comparée à la gestion de stock (facture de vente ou montant différents). */
export function anomaliesLigne(l: LigneRapprochee, stock: FactureFournisseur[]): string[] {
  if (l.mouvements.length === 0) return [];
  const out: string[] = [];
  const parId = new Map(stock.map((f) => [f.id, f]));
  const vente = cleNumero(l.facture.venteNumFacture.split(/[/\s]+/)[0] ?? "");
  const ventesStock = l.mouvements.map((m) => cleNumero(parId.get(m.id)?.venteNumFacture ?? ""));
  if (vente && ventesStock.every(Boolean) && !ventesStock.some((v) => vente.includes(v) || v.includes(vente))) {
    out.push(`Facture de vente ${l.facture.venteNumFacture} dans le classeur, ${parId.get(l.mouvements[0].id)?.venteNumFacture} dans la gestion de stock.`);
  }
  const totalStock = l.mouvements.reduce((s, m) => s + m.montant, 0);
  if (l.facture.montant > 0 && Math.abs(totalStock - l.facture.montant) > TOLERANCE) {
    out.push(`Montant ${l.facture.montant.toLocaleString("fr-FR")} dans le classeur, ${totalStock.toLocaleString("fr-FR")} dans la gestion de stock.`);
  }
  return out;
}
