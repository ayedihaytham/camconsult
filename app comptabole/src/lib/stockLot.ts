import type { StockMouvementInput } from "@/store/stock";
import type { StockChamps, StockDocConfidence, StockDocType, StockLigne, StockMouvement } from "@/types";
import { mouvementsAvecNumero } from "@/lib/facturesDoublons";

/**
 * Import d'un lot de pièces dans la Gestion de stock : chaque page lue (voir « document complet ») devient une pièce, les pièces sont
 * rapprochées en mouvements (achat + vente + douane), puis contrôlées. Rien n'est enregistré ici : la fenêtre d'import présente le
 * résultat et seules les lignes cochées sont créées.
 */

export type TypeAffecte = StockDocType | "ignorer";

export interface PieceLot {
  /** Identifiant stable dans le lot : `${fichier}#${page}`. */
  id: string;
  fichier: string;
  page: number;
  imageDataUrl: string | null;
  /** Type deviné par le moteur, null si la page n'a pas pu être classée. */
  typeDevine: StockDocType | null;
  confiance: StockDocConfidence | null;
  champsByType: Record<StockDocType, StockChamps>;
}

export interface PieceAffectee extends PieceLot {
  type: StockDocType;
  champs: StockChamps;
}

export interface GroupeLot {
  /** Clé stable d'un groupe : identifiants de ses pièces. */
  cle: string;
  achat: PieceAffectee | null;
  vente: PieceAffectee | null;
  douane: PieceAffectee | null;
  /** Anomalies par pièce (id de pièce -> messages) : confiance, champs absents, montants incohérents. */
  anomalies: Record<string, string[]>;
  /** Anomalies du mouvement entier (doublon, quantité vendue supérieure à l'achat). */
  alertes: string[];
  /** doublon : refusé (déjà dans le stock ou répété dans le lot) ; verifier : à relire ; pret : aucune anomalie. */
  statut: "pret" | "verifier" | "doublon";
}

const MOTS_VIDES = new Set(["the", "and", "for", "des", "les", "une", "pour", "avec", "sur", "dans", "par", "sarl", "sa", "ltd", "co", "sas", "spa", "gmbh", "tunisie", "tunis"]);

const sansAccent = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Mots significatifs d'un texte (sans accents, ponctuation, mots courts ni formes juridiques). */
export function mots(texte: string | undefined | null): Set<string> {
  return new Set(
    sansAccent(String(texte ?? ""))
      .split(/[^a-z0-9]+/)
      .filter((m) => m.length >= 3 && !MOTS_VIDES.has(m)),
  );
}

/** Part commune de deux ensembles de mots, rapportée au plus petit : « SOTACIB » est contenu dans « SOTACIB KAIROUAN » (1). */
export function proximite(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let commun = 0;
  for (const m of a) if (b.has(m)) commun++;
  return commun / Math.min(a.size, b.size);
}

/** Même tiers : écriture identique (sans accents ni casse) ou mots en commun. */
const memeTiers = (a: string | undefined, b: string | undefined) =>
  sansAccent(String(a ?? "")).replace(/[^a-z0-9]/g, "") === sansAccent(String(b ?? "")).replace(/[^a-z0-9]/g, "") || proximite(mots(a), mots(b)) > 0.5;

const arrondi3 = (n: number) => Math.round(n * 1000) / 1000;
const quantiteTotale = (lignes: StockLigne[] | undefined) => (lignes ?? []).reduce((s, l) => s + (Number(l.quantite) || 0), 0);
const montantTotal = (lignes: StockLigne[] | undefined) => (lignes ?? []).reduce((s, l) => s + (Number(l.montantDevise) || 0), 0);
const motsLignes = (lignes: StockLigne[] | undefined) => mots((lignes ?? []).map((l) => l.designation).join(" "));

const jours = (iso: string | undefined): number | null => {
  if (!iso) return null;
  const t = Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(t) ? null : t / 86_400_000;
};

/** Pièce affectée à un type : les champs sont ceux déjà calculés par le moteur pour ce type. */
export function affecter(piece: PieceLot, type: StockDocType): PieceAffectee {
  return { ...piece, type, champs: piece.champsByType[type] };
}

/** Ressemblance d'une vente avec un achat : produits, quantité, ordre des dates. De 0 à 1. */
export function scoreVenteAchat(achat: PieceAffectee, vente: PieceAffectee): number {
  let score = 0.5 * proximite(motsLignes(achat.champs.lignes), motsLignes(vente.champs.lignes));
  const qa = quantiteTotale(achat.champs.lignes);
  const qv = quantiteTotale(vente.champs.lignes);
  if (qa > 0 && qv > 0) {
    if (Math.abs(qa - qv) <= qa * 0.01) score += 0.35;
    else if (qv < qa) score += 0.15;
  }
  const da = jours(achat.champs.date);
  const dv = jours(vente.champs.date);
  if (da !== null && dv !== null) score += dv >= da ? 0.15 : -0.2;
  return score;
}

/** Ressemblance d'une déclaration avec un mouvement : exportateur ≈ fournisseur, valeur ≈ montant × taux, dates proches. De 0 à 1. */
export function scoreDouane(douane: PieceAffectee, achat: PieceAffectee | null, vente: PieceAffectee | null): number {
  const d = douane.champs;
  let score = 0;
  if (achat) score = Math.max(score, 0.5 * proximite(mots(d.exportateur), mots(achat.champs.fournisseur)));
  if (vente) score = Math.max(score, 0.5 * proximite(mots(d.importateur), mots(vente.champs.client)));
  const reference = achat ?? vente;
  if (reference) {
    const attendu = montantTotal(reference.champs.lignes) * (d.tauxChange ?? 0);
    if (attendu > 0 && (d.valeurTnd ?? 0) > 0 && Math.abs(attendu - (d.valeurTnd ?? 0)) <= attendu * 0.05) score += 0.4;
    const ecart = jours(d.date) !== null && jours(reference.champs.date) !== null ? Math.abs((jours(d.date) as number) - (jours(reference.champs.date) as number)) : null;
    if (ecart !== null && ecart <= 90) score += 0.1;
  }
  return score;
}

const SEUIL = 0.5;

interface Brouillon {
  achat: PieceAffectee | null;
  vente: PieceAffectee | null;
  douane: PieceAffectee | null;
}

/** Une seule pièce par type dans un mouvement : appariement glouton, du meilleur score au plus faible. */
function apparier<A, B>(gauche: A[], droite: B[], score: (a: A, b: B) => number): [A, B][] {
  const candidats: { a: A; b: B; s: number }[] = [];
  for (const a of gauche) for (const b of droite) candidats.push({ a, b, s: score(a, b) });
  candidats.sort((x, y) => y.s - x.s);
  const pris = new Set<unknown>();
  const paires: [A, B][] = [];
  for (const c of candidats) {
    if (c.s < SEUIL || pris.has(c.a) || pris.has(c.b)) continue;
    pris.add(c.a);
    pris.add(c.b);
    paires.push([c.a, c.b]);
  }
  return paires;
}

function anomaliesPiece(p: PieceAffectee): string[] {
  const out: string[] = [];
  if (p.confiance && p.confiance !== "haute") out.push(`Lecture à confiance ${p.confiance}`);
  if (p.typeDevine && p.typeDevine !== p.type) out.push(`Type corrigé (deviné : ${p.typeDevine})`);
  if (!p.typeDevine) out.push("Type non reconnu par le moteur");
  const c = p.champs;
  if (p.type === "douane") {
    if (!c.numDeclaration) out.push("N° de déclaration absent");
    if (!c.tauxChange) out.push("Taux de change absent");
    if (!c.valeurTnd) out.push("Valeur en dinars absente");
    return out;
  }
  if (!c.date) out.push("Date absente");
  if (!c.numFacture) out.push("N° de facture absent");
  if (!(p.type === "achat" ? c.fournisseur : c.client)) out.push(p.type === "achat" ? "Fournisseur absent" : "Client absent");
  if (!c.lignes || c.lignes.length === 0) out.push("Aucun produit lu");
  for (const l of c.lignes ?? []) {
    const calcule = (Number(l.quantite) || 0) * (Number(l.prixUnitaire) || 0);
    const lu = Number(l.montantDevise) || 0;
    if (calcule > 0 && lu > 0 && Math.abs(calcule - lu) > Math.max(0.05, lu * 0.005)) out.push(`« ${l.designation || "produit"} » : quantité × prix ≠ montant`);
    if (!l.quantite || !lu) out.push(`« ${l.designation || "produit"} » : quantité ou montant absent`);
  }
  return out;
}

/**
 * Rapproche les pièces en mouvements. `affectations` donne le type retenu de chaque pièce (« ignorer » l'écarte) ; une pièce sans
 * affectation prend le type deviné. `existants` sert à refuser les factures déjà dans le stock.
 */
export function regrouperPieces(
  pieces: PieceLot[],
  affectations: Record<string, TypeAffecte | undefined>,
  existants: Pick<StockMouvement, "id" | "venteNumFacture" | "achatNumFacture" | "fournisseur">[] = [],
): GroupeLot[] {
  const retenues: PieceAffectee[] = [];
  for (const p of pieces) {
    const type = affectations[p.id] ?? p.typeDevine ?? "ignorer";
    if (type !== "ignorer") retenues.push(affecter(p, type));
  }
  const achats = retenues.filter((p) => p.type === "achat");
  const ventes = retenues.filter((p) => p.type === "vente");
  const douanes = retenues.filter((p) => p.type === "douane");

  const brouillons: Brouillon[] = [];
  const venteAppariee = new Set<PieceAffectee>();
  for (const [a, v] of apparier(achats, ventes, scoreVenteAchat)) {
    brouillons.push({ achat: a, vente: v, douane: null });
    venteAppariee.add(v);
  }
  const achatAppariee = new Set(brouillons.map((b) => b.achat));
  for (const a of achats) if (!achatAppariee.has(a)) brouillons.push({ achat: a, vente: null, douane: null });
  for (const v of ventes) if (!venteAppariee.has(v)) brouillons.push({ achat: null, vente: v, douane: null });

  const douaneApparieee = new Set<PieceAffectee>();
  for (const [d, b] of apparier(douanes, brouillons, (dd, bb) => scoreDouane(dd, bb.achat, bb.vente))) {
    b.douane = d;
    douaneApparieee.add(d);
  }
  for (const d of douanes) if (!douaneApparieee.has(d)) brouillons.push({ achat: null, vente: null, douane: d });

  const vusAchat: PieceAffectee[] = [];
  const vusVente: PieceAffectee[] = [];
  return brouillons.map((b) => {
    const pieces3 = [b.achat, b.vente, b.douane].filter((p): p is PieceAffectee => p !== null);
    const anomalies: Record<string, string[]> = {};
    for (const p of pieces3) {
      const liste = anomaliesPiece(p);
      if (liste.length > 0) anomalies[p.id] = liste;
    }
    const alertes: string[] = [];
    let doublon = false;
    if (b.achat?.champs.numFacture) {
      const dedans = vusAchat.some((o) => o.champs.numFacture === b.achat?.champs.numFacture && memeTiers(o.champs.fournisseur, b.achat?.champs.fournisseur));
      if (dedans || mouvementsAvecNumero(existants as StockMouvement[], "achat", b.achat.champs.numFacture, b.achat.champs.fournisseur ?? "", null).length > 0) {
        alertes.push(`Facture d'achat ${b.achat.champs.numFacture} déjà présente dans le stock ou dans ce lot`);
        doublon = true;
      }
      vusAchat.push(b.achat);
    }
    if (b.vente?.champs.numFacture) {
      const dedans = vusVente.some((o) => o.champs.numFacture === b.vente?.champs.numFacture);
      if (dedans || mouvementsAvecNumero(existants as StockMouvement[], "vente", b.vente.champs.numFacture, "", null).length > 0) {
        alertes.push(`Facture de vente ${b.vente.champs.numFacture} déjà présente dans le stock ou dans ce lot`);
        doublon = true;
      }
      vusVente.push(b.vente);
    }
    if (b.achat && b.vente) {
      const qa = quantiteTotale(b.achat.champs.lignes);
      const qv = quantiteTotale(b.vente.champs.lignes);
      if (qa > 0 && qv > qa * 1.01) alertes.push("Quantité vendue supérieure à la quantité achetée");
    }
    if (b.achat && !b.vente && !b.douane) alertes.push("Aucune vente ni déclaration rapprochée");
    if (!b.achat && (b.vente || b.douane)) alertes.push("Aucune facture d'achat rapprochée");
    const statut: GroupeLot["statut"] = doublon ? "doublon" : Object.keys(anomalies).length > 0 || alertes.length > 0 ? "verifier" : "pret";
    return { cle: pieces3.map((p) => p.id).join("|"), ...b, anomalies, alertes, statut };
  });
}

/** Mouvement vide d'une société (mêmes valeurs par défaut que le formulaire de saisie). */
export const mouvementVide = (societeId: string): StockMouvementInput => ({
  societeId,
  natureMarchandise: "",
  achatDate: null,
  achatNumFacture: "",
  achatDocType: "",
  fournisseur: "",
  achatDevise: "EUR",
  achatCours: 0,
  achatCoursUsd: 0,
  achatLignes: [],
  venteDate: null,
  venteNumFacture: "",
  venteDocType: "",
  client: "",
  venteDevise: "EUR",
  venteCours: 0,
  venteCoursUsd: 0,
  venteLignes: [],
  douaneNumDeclaration: "",
  douaneDate: null,
  douaneRegime: "",
  douaneTypeDeclaration: "",
  douaneReference: "",
  douaneTauxChange: 0,
  douaneValeurTnd: 0,
  douanePtfn: 0,
  douaneExportateur: "",
  douaneImportateur: "",
  achatDocDataUrl: null,
  venteDocDataUrl: null,
  douaneDocDataUrl: null,
  note: "",
});

/** Mouvement d'un groupe : champs lus, sans cours ni pièces jointes (ajoutés ensuite par la fenêtre d'import). */
export function mouvementDuGroupe(g: GroupeLot, societeId: string): StockMouvementInput {
  const m = mouvementVide(societeId);
  const a = g.achat?.champs;
  const v = g.vente?.champs;
  const d = g.douane?.champs;
  if (a) {
    m.achatDate = a.date || null;
    m.achatNumFacture = a.numFacture ?? "";
    m.fournisseur = a.fournisseur ?? "";
    m.achatDevise = a.devise || "EUR";
    m.achatLignes = (a.lignes ?? []).map((l) => ({ ...l, montantTnd: 0 }));
  }
  if (v) {
    m.venteDate = v.date || null;
    m.venteNumFacture = v.numFacture ?? "";
    m.client = v.client ?? "";
    m.venteDevise = v.devise || "EUR";
    m.venteLignes = (v.lignes ?? []).map((l) => ({ ...l, montantTnd: 0 }));
  }
  if (d) {
    m.douaneNumDeclaration = d.numDeclaration ?? "";
    m.douaneDate = d.date || null;
    m.douaneTypeDeclaration = d.typeDeclaration ?? "";
    m.douaneReference = d.reference ?? "";
    m.douaneTauxChange = d.tauxChange ?? 0;
    m.douaneValeurTnd = d.valeurTnd ?? 0;
    m.douanePtfn = d.ptfn ?? 0;
    m.douaneExportateur = d.exportateur ?? "";
    m.douaneImportateur = d.importateur ?? "";
  }
  m.natureMarchandise = a?.lignes?.[0]?.designation || v?.lignes?.[0]?.designation || "";
  return m;
}

/** Résumé d'un montant pour l'affichage d'une pièce : « 44 000,000 EUR ». */
export const resumeMontant = (lignes: StockLigne[] | undefined, devise: string | undefined) => {
  const total = arrondi3(montantTotal(lignes));
  return total ? `${total.toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} ${devise || ""}`.trim() : "—";
};
