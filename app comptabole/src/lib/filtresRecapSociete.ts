import { norme } from "@/lib/stockFiltres";
import { fmtMontant, fmtQuantite } from "@/lib/stockRecap";
import { dateJourMoisAnnee, totauxDe, type CoteRecap, type LigneRecapSociete, type RecapSociete } from "@/lib/stockRecapSociete";

/**
 * Filtres « façon Excel » du récapitulatif de société : chaque colonne se filtre par ses valeurs (cases à cocher) et se trie.
 * Les filtres se cumulent entre colonnes (ET) ; plusieurs valeurs d'une même colonne s'additionnent (OU). La liste des valeurs
 * proposées pour une colonne tient compte des filtres des autres colonnes, jamais du sien — comme dans Excel.
 */

export interface ColonneRecap {
  id: string;
  titre: string;
  bloc: "vente" | "ecart" | "achat";
  /** Texte affiché dans la cellule ; vide quand la cellule est vide. */
  affichage: (l: LigneRecapSociete) => string;
  /** Valeur de tri (nombre, date ISO ou texte) ; null quand la cellule est vide (toujours en dernier). */
  tri: (l: LigneRecapSociete) => number | string | null;
}

const montant = (c: CoteRecap, n: number) => (c.present ? fmtMontant(n) : "");
const quantite = (c: CoteRecap) => (c.present ? fmtQuantite(c.quantite) : "");

function colonnesDuCote(bloc: "vente" | "achat"): ColonneRecap[] {
  const c = (l: LigneRecapSociete) => l[bloc];
  const col = (id: string, titre: string, affichage: ColonneRecap["affichage"], tri: ColonneRecap["tri"]): ColonneRecap => ({ id: `${bloc}.${id}`, titre, bloc, affichage, tri });
  return [
    col("date", "Date", (l) => dateJourMoisAnnee(c(l).date), (l) => c(l).date),
    col("facture", "N° facture", (l) => c(l).numFacture, (l) => c(l).numFacture || null),
    col("nature", "Nature", (l) => (c(l).present ? l.nature : ""), (l) => (c(l).present ? l.nature || null : null)),
    col("tiers", bloc === "vente" ? "Client" : "Fournisseur", (l) => c(l).tiers, (l) => c(l).tiers || null),
    col("quantite", "Quantité", (l) => quantite(c(l)), (l) => (c(l).present ? c(l).quantite : null)),
    col("devise-montant", "En devise", (l) => montant(c(l), c(l).enDevise), (l) => (c(l).present ? c(l).enDevise : null)),
    col("devise", "Devise", (l) => c(l).devise, (l) => c(l).devise || null),
    ...(bloc === "achat" ? [col("cours", "Cours", (l) => (c(l).cours ? String(c(l).cours).replace(".", ",") : ""), (l) => c(l).cours || null)] : []),
    col("mt-tnd", "MT TND", (l) => montant(c(l), c(l).mtTnd), (l) => (c(l).present ? c(l).mtTnd : null)),
  ];
}

/** Les 18 colonnes filtrables, dans l'ordre du tableau (le numéro de ligne n'en fait pas partie). */
export const COLONNES_RECAP: ColonneRecap[] = [
  ...colonnesDuCote("vente"),
  { id: "ecart", titre: "Écart", bloc: "ecart", affichage: (l) => fmtQuantite(l.ecart), tri: (l) => l.ecart },
  ...colonnesDuCote("achat"),
];

export interface FiltresRecap {
  /** Clés des valeurs retenues, par colonne ; une colonne absente n'est pas filtrée. */
  colonnes: Readonly<Record<string, ReadonlySet<string>>>;
  tri: { colonne: string; sens: "asc" | "desc" } | null;
}

export const FILTRES_RECAP_VIDES: FiltresRecap = { colonnes: {}, tri: null };

/** Clé de comparaison d'une valeur : texte sans accents ni casse ; « » pour une cellule vide. */
export const cleValeur = (affichage: string) => norme(affichage);

export function nombreFiltresRecap(f: FiltresRecap): number {
  return Object.values(f.colonnes).filter((v) => v.size > 0).length;
}

const colonneDe = (id: string) => COLONNES_RECAP.find((c) => c.id === id);

function passe(l: LigneRecapSociete, colonnes: FiltresRecap["colonnes"], sauf?: string): boolean {
  for (const [id, retenues] of Object.entries(colonnes)) {
    if (id === sauf || retenues.size === 0) continue;
    const col = colonneDe(id);
    if (col && !retenues.has(cleValeur(col.affichage(l)))) return false;
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
    if (!passe(l, filtres.colonnes, colonneId)) continue;
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
  let lignes = recap.lignes.filter((l) => passe(l, filtres.colonnes));
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
