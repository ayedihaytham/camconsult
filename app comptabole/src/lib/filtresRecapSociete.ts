import { norme } from "@/lib/stockFiltres";
import { fmtMontant, fmtQuantite } from "@/lib/stockRecap";
import { dateJourMoisAnnee, totauxDe, type CoteRecap, type LigneRecapSociete, type RecapSociete } from "@/lib/stockRecapSociete";

/**
 * Filtres « façon Excel » du récapitulatif de société : chaque colonne se filtre par ses valeurs (cases à cocher) et/ou par une condition
 * (contient, supérieur à, date antérieure à…), et se trie. Les filtres se cumulent entre colonnes (ET) ; plusieurs valeurs d'une même colonne
 * s'additionnent (OU). La liste des valeurs proposées pour une colonne tient compte des filtres des autres colonnes, jamais du sien.
 */

export type TypeColonne = "texte" | "nombre" | "date";

export interface ColonneRecap {
  id: string;
  titre: string;
  bloc: "vente" | "ecart" | "achat" | "douane";
  type: TypeColonne;
  /** Texte affiché dans la cellule ; vide quand la cellule est vide. */
  affichage: (l: LigneRecapSociete) => string;
  /** Valeur de tri et de comparaison (nombre, date ISO ou texte) ; null quand la cellule est vide (toujours en dernier). */
  tri: (l: LigneRecapSociete) => number | string | null;
}

const montant = (c: CoteRecap, n: number) => (c.present ? fmtMontant(n) : "");
const quantite = (c: CoteRecap) => (c.present ? fmtQuantite(c.quantite) : "");

function colonnesDuCote(bloc: "vente" | "achat"): ColonneRecap[] {
  const c = (l: LigneRecapSociete) => l[bloc];
  const col = (id: string, titre: string, type: TypeColonne, affichage: ColonneRecap["affichage"], tri: ColonneRecap["tri"]): ColonneRecap => ({ id: `${bloc}.${id}`, titre, bloc, type, affichage, tri });
  return [
    col("date", "Date", "date", (l) => dateJourMoisAnnee(c(l).date), (l) => c(l).date),
    col("facture", "N° facture", "texte", (l) => c(l).numFacture, (l) => c(l).numFacture || null),
    col("nature", "Nature", "texte", (l) => (c(l).present ? l.nature : ""), (l) => (c(l).present ? l.nature || null : null)),
    col("tiers", bloc === "vente" ? "Client" : "Fournisseur", "texte", (l) => c(l).tiers, (l) => c(l).tiers || null),
    col("quantite", "Quantité", "nombre", (l) => quantite(c(l)), (l) => (c(l).present ? c(l).quantite : null)),
    col("devise-montant", "En devise", "nombre", (l) => montant(c(l), c(l).enDevise), (l) => (c(l).present ? c(l).enDevise : null)),
    col("devise", "Devise", "texte", (l) => c(l).devise, (l) => c(l).devise || null),
    ...(bloc === "achat" ? [col("cours", "Cours", "nombre", (l) => (c(l).cours ? String(c(l).cours).replace(".", ",") : ""), (l) => c(l).cours || null)] : []),
    col("mt-tnd", "MT TND", "nombre", (l) => montant(c(l), c(l).mtTnd), (l) => (c(l).present ? c(l).mtTnd : null)),
  ];
}

const nombreDouane = (n: number) => (n ? n.toLocaleString("fr-FR", { maximumFractionDigits: 5 }) : "");

const COLONNES_DOUANE: ColonneRecap[] = [
  { id: "douane.declaration", titre: "N° déclaration", bloc: "douane", type: "texte", affichage: (l) => l.douane.numDeclaration, tri: (l) => l.douane.numDeclaration || null },
  { id: "douane.date", titre: "Date", bloc: "douane", type: "date", affichage: (l) => dateJourMoisAnnee(l.douane.date), tri: (l) => l.douane.date },
  { id: "douane.type", titre: "Type", bloc: "douane", type: "texte", affichage: (l) => l.douane.type, tri: (l) => l.douane.type || null },
  { id: "douane.taux", titre: "Taux de change", bloc: "douane", type: "nombre", affichage: (l) => nombreDouane(l.douane.tauxChange), tri: (l) => l.douane.tauxChange || null },
  { id: "douane.valeur", titre: "Valeur (TND)", bloc: "douane", type: "nombre", affichage: (l) => (l.douane.valeurTnd ? fmtMontant(l.douane.valeurTnd) : ""), tri: (l) => l.douane.valeurTnd || null },
];

/** Toutes les colonnes filtrables, dans l'ordre du tableau (le numéro de ligne n'en fait pas partie) ; celles de la douane sont facultatives. */
export const COLONNES_RECAP: ColonneRecap[] = [
  ...colonnesDuCote("vente"),
  { id: "ecart", titre: "Écart", bloc: "ecart", type: "nombre", affichage: (l) => fmtQuantite(l.ecart), tri: (l) => l.ecart },
  ...colonnesDuCote("achat"),
  ...COLONNES_DOUANE,
];

// ───────────────────────── Conditions ─────────────────────────

export type OperateurRecap =
  | "vide" | "non-vide"
  | "contient" | "ne-contient-pas" | "commence" | "finit" | "exactement"
  | "date-est" | "avant" | "apres"
  | "sup" | "sup-egal" | "inf" | "inf-egal" | "egal" | "different" | "entre" | "pas-entre";

export interface ConditionRecap {
  op: OperateurRecap;
  /** Première valeur saisie (texte, nombre ou date ISO) ; seconde pour « compris entre ». */
  v1: string;
  v2: string;
}

export const OPERATEURS: Record<TypeColonne, { op: OperateurRecap; nom: string; valeurs: 0 | 1 | 2 }[]> = {
  texte: [
    { op: "vide", nom: "Est vide", valeurs: 0 },
    { op: "non-vide", nom: "N'est pas vide", valeurs: 0 },
    { op: "contient", nom: "Le texte contient", valeurs: 1 },
    { op: "ne-contient-pas", nom: "Le texte ne contient pas", valeurs: 1 },
    { op: "commence", nom: "Le texte commence par", valeurs: 1 },
    { op: "finit", nom: "Le texte se termine par", valeurs: 1 },
    { op: "exactement", nom: "Le texte est exactement", valeurs: 1 },
  ],
  date: [
    { op: "vide", nom: "Est vide", valeurs: 0 },
    { op: "non-vide", nom: "N'est pas vide", valeurs: 0 },
    { op: "date-est", nom: "La date est", valeurs: 1 },
    { op: "avant", nom: "La date est antérieure à", valeurs: 1 },
    { op: "apres", nom: "La date est postérieure à", valeurs: 1 },
  ],
  nombre: [
    { op: "vide", nom: "Est vide", valeurs: 0 },
    { op: "non-vide", nom: "N'est pas vide", valeurs: 0 },
    { op: "sup", nom: "Supérieur(e) à", valeurs: 1 },
    { op: "sup-egal", nom: "Supérieur(e) ou égal à", valeurs: 1 },
    { op: "inf", nom: "Inférieur(e) à", valeurs: 1 },
    { op: "inf-egal", nom: "Inférieur(e) ou égal à", valeurs: 1 },
    { op: "egal", nom: "Est égal(e) à", valeurs: 1 },
    { op: "different", nom: "Est différent(e) de", valeurs: 1 },
    { op: "entre", nom: "Est compris(e) entre", valeurs: 2 },
    { op: "pas-entre", nom: "N'est pas compris(e) entre", valeurs: 2 },
  ],
};

/** « 1 000,5 » ou « 1000.5 » → 1000.5 ; NaN si ce n'est pas un nombre. */
export function lireNombre(texte: string): number {
  const t = texte.replace(/[\s ]/g, "").replace(",", ".");
  return t === "" ? NaN : Number(t);
}

/** La condition est-elle complète (les valeurs que son opérateur demande sont saisies et lisibles) ? */
export function conditionValide(type: TypeColonne, c: ConditionRecap): boolean {
  const def = OPERATEURS[type].find((o) => o.op === c.op);
  if (!def) return false;
  if (def.valeurs === 0) return true;
  const ok = (v: string) => (type === "nombre" ? !Number.isNaN(lireNombre(v)) : v.trim() !== "");
  return def.valeurs === 1 ? ok(c.v1) : ok(c.v1) && ok(c.v2);
}

function repond(col: ColonneRecap, l: LigneRecapSociete, c: ConditionRecap): boolean {
  const affiche = col.affichage(l);
  if (c.op === "vide") return affiche === "";
  if (c.op === "non-vide") return affiche !== "";
  if (col.type === "texte") {
    const t = norme(affiche);
    const v = norme(c.v1);
    switch (c.op) {
      case "contient": return t.includes(v);
      case "ne-contient-pas": return !t.includes(v);
      case "commence": return t.startsWith(v);
      case "finit": return t.endsWith(v);
      case "exactement": return t === v;
      default: return true;
    }
  }
  const brut = col.tri(l);
  if (brut === null) return false;
  if (col.type === "date") {
    const d = String(brut);
    return c.op === "date-est" ? d === c.v1 : c.op === "avant" ? d < c.v1 : c.op === "apres" ? d > c.v1 : true;
  }
  const x = Number(brut);
  const a = lireNombre(c.v1);
  const b = lireNombre(c.v2);
  switch (c.op) {
    case "sup": return x > a;
    case "sup-egal": return x >= a;
    case "inf": return x < a;
    case "inf-egal": return x <= a;
    case "egal": return Math.abs(x - a) < 1e-9;
    case "different": return Math.abs(x - a) >= 1e-9;
    case "entre": return x >= Math.min(a, b) && x <= Math.max(a, b);
    case "pas-entre": return x < Math.min(a, b) || x > Math.max(a, b);
    default: return true;
  }
}

// ───────────────────────── Filtres ─────────────────────────

export interface FiltresRecap {
  /** Clés des valeurs retenues, par colonne ; une colonne absente n'est pas filtrée par valeurs. */
  colonnes: Readonly<Record<string, ReadonlySet<string>>>;
  /** Condition par colonne (en plus des valeurs cochées). */
  conditions: Readonly<Record<string, ConditionRecap>>;
  tri: { colonne: string; sens: "asc" | "desc" } | null;
}

export const FILTRES_RECAP_VIDES: FiltresRecap = { colonnes: {}, conditions: {}, tri: null };

/** Clé de comparaison d'une valeur : texte sans accents ni casse ; « » pour une cellule vide. */
export const cleValeur = (affichage: string) => norme(affichage);

const colonneDe = (id: string) => COLONNES_RECAP.find((c) => c.id === id);

/** Colonnes qui portent un filtre (valeurs cochées et/ou condition). */
export function colonnesFiltrees(f: FiltresRecap): string[] {
  const ids = new Set<string>();
  for (const [id, v] of Object.entries(f.colonnes)) if (v.size > 0) ids.add(id);
  for (const id of Object.keys(f.conditions)) ids.add(id);
  return [...ids];
}

export const nombreFiltresRecap = (f: FiltresRecap) => colonnesFiltrees(f).length;

/** Retire les filtres (et le tri) des colonnes de la douane — quand elle est masquée, ses filtres ne doivent pas cacher des lignes en silence. */
export function sansFiltresDouane(f: FiltresRecap): FiltresRecap {
  const hors = <T,>(o: Readonly<Record<string, T>>) => Object.fromEntries(Object.entries(o).filter(([id]) => !id.startsWith("douane."))) as Record<string, T>;
  return { colonnes: hors(f.colonnes), conditions: hors(f.conditions), tri: f.tri?.colonne.startsWith("douane.") ? null : f.tri };
}

function passe(l: LigneRecapSociete, f: FiltresRecap, sauf?: string): boolean {
  for (const [id, retenues] of Object.entries(f.colonnes)) {
    if (id === sauf || retenues.size === 0) continue;
    const col = colonneDe(id);
    if (col && !retenues.has(cleValeur(col.affichage(l)))) return false;
  }
  for (const [id, c] of Object.entries(f.conditions)) {
    if (id === sauf) continue;
    const col = colonneDe(id);
    if (col && !repond(col, l, c)) return false;
  }
  return true;
}

export interface ValeurColonne {
  cle: string;
  /** Texte affiché ; « (Vides) » pour les cellules vides. */
  affichage: string;
  nombre: number;
}

/** Valeurs distinctes d'une colonne parmi les lignes que laissent passer les filtres des autres colonnes, triées (les vides en dernier). */
export function valeursDeColonne(lignes: LigneRecapSociete[], colonneId: string, filtres: FiltresRecap): ValeurColonne[] {
  const col = colonneDe(colonneId);
  if (!col) return [];
  const groupes = new Map<string, { ligne: LigneRecapSociete; affichage: string; nombre: number }>();
  for (const l of lignes) {
    if (!passe(l, filtres, colonneId)) continue;
    const affichage = col.affichage(l);
    const cle = cleValeur(affichage);
    const g = groupes.get(cle);
    if (g) g.nombre++;
    else groupes.set(cle, { ligne: l, affichage, nombre: 1 });
  }
  return [...groupes.entries()]
    .sort(([, a], [, b]) => comparer(col.tri(a.ligne), col.tri(b.ligne)))
    .map(([cle, g]) => ({ cle, affichage: cle === "" ? "(Vides)" : g.affichage, nombre: g.nombre }));
}

/** Ordre croissant : nombres et dates dans l'ordre, textes à la manière du français (chiffres compris) ; les vides en dernier. */
function comparer(a: number | string | null, b: number | string | null): number {
  if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "fr", { numeric: true, sensitivity: "base" });
}

/** Récapitulatif réduit aux lignes que les filtres laissent visibles, trié, avec ses totaux recalculés (le rang d'origine de chaque ligne est conservé). */
export function appliquerFiltresRecap(recap: RecapSociete, filtres: FiltresRecap): RecapSociete {
  let lignes = recap.lignes.filter((l) => passe(l, filtres));
  const col = filtres.tri ? colonneDe(filtres.tri.colonne) : undefined;
  if (col && filtres.tri) {
    const sens = filtres.tri.sens === "asc" ? 1 : -1;
    lignes = [...lignes].sort((x, y) => {
      const a = col.tri(x);
      const b = col.tri(y);
      // Les vides restent en dernier quel que soit le sens.
      if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1;
      return sens * comparer(a, b);
    });
  }
  return { ...recap, lignes, totaux: totauxDe(lignes) };
}
