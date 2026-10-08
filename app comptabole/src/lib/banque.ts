import { convertirNombre } from "@/lib/pdfToTables";
import type { CompteBancaire, FactureFournisseur, MouvementBancaire, TypeMouvementBancaire } from "@/types";

const r3 = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000;

export const TYPE_LABELS: Record<TypeMouvementBancaire, string> = {
  encaissement_client: "Encaissement client",
  paiement_fournisseur: "Paiement fournisseur",
  frais: "Frais bancaires",
  credit: "Crédit",
  change: "Change",
  autre: "Autre",
};

export const normaliser = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase();

/** Type d'un mouvement d'après son libellé, son sens (débit = sortie du compte, crédit = entrée) et son n° de pièce.
 * Le préfixe de la pièce renseigne la banque : LD… = opération de crédit, CHG… = frais, « COURS 3.38 » = change. */
export function classerMouvement(libelle: string, debit: number, credit: number, piece = ""): TypeMouvementBancaire {
  const l = normaliser(libelle);
  const p = normaliser(piece).trim();
  if (/\bINTERETS?\b|DEBLOCAGE|DECAISSEMENT|REMBOURSEMENT (DE )?CREDIT|ECHEANCE/.test(l)) return "credit";
  if (/\bTVA\b|COMMISSION|\bCOMM\b|FRAIS|AGIOS|TENUE DE COMPTE/.test(l) || /^CHG/.test(p)) return "frais";
  if (/CHANGE|ACHAT DEVISE|VENTE DEVISE|CESSION/.test(l) || /^COURS\b/.test(p)) return "change";
  if (/^LD\d/.test(p)) return "credit";
  if (credit > 0 && debit === 0) return "encaissement_client";
  if (debit > 0 && /LC PAYMENT|REGLEMENT|CERTIFICATION CHEQ|PAIEMENT FACTURE/.test(l)) return "paiement_fournisseur";
  return "autre";
}

/** Cours de la dernière opération de change qui précède (ou date) un paiement : proposé pour régler une facture en devise. */
export function coursAvant(mouvements: Pick<MouvementBancaire, "type" | "cours" | "dateOp">[], date: string): number | undefined {
  return mouvements
    .filter((m) => m.type === "change" && m.cours && m.dateOp <= date)
    .sort((a, b) => b.dateOp.localeCompare(a.dateOp))[0]?.cours ?? undefined;
}

/** Numéros de plus de 3 chiffres cités dans un libellé (« FAC N 263500 », « FACTURE N°2026061 »). */
export function numerosDansLibelle(texte: string): string[] {
  return [...new Set(texte.match(/\d{4,}/g) ?? [])];
}

/** Factures d'un fournisseur dont le numéro est cité dans le libellé d'un mouvement bancaire. */
export function facturesCitees(libelle: string, factures: Pick<FactureFournisseur, "id" | "numFacture">[]): string[] {
  const numeros = numerosDansLibelle(libelle);
  if (numeros.length === 0) return [];
  return factures
    .filter((f) => {
      const n = f.numFacture.replace(/\D/g, "");
      return n.length >= 4 && numeros.some((x) => x === n || n.endsWith(x) || x.endsWith(n));
    })
    .map((f) => f.id);
}

/** Texte du fournisseur le mieux reconnu dans un libellé (nom complet, sinon premier mot significatif). */
export function fournisseurCite<T extends { cle: string; nom: string }>(libelle: string, fournisseurs: T[]): T | null {
  const l = normaliser(libelle);
  const complet = fournisseurs.find((f) => l.includes(normaliser(f.nom).trim()));
  if (complet) return complet;
  const premier = fournisseurs.filter((f) => {
    const mot = normaliser(f.nom).split(/[^A-Z0-9]+/).find((m) => m.length >= 4);
    return mot ? l.includes(mot) : false;
  });
  return premier.length === 1 ? premier[0] : null;
}

// ── Soldes ────────────────────────────────────────────────────────────────

/** Solde du compte après chaque mouvement (dans l'ordre fourni : date puis saisie). */
export function soldesCourants(compte: CompteBancaire, mouvements: MouvementBancaire[]): Map<string, number> {
  const soldes = new Map<string, number>();
  let solde = compte.soldeDepart;
  for (const m of mouvements) {
    solde = r3(solde + m.credit - m.debit);
    soldes.set(m.id, solde);
  }
  return soldes;
}

export interface TotauxBanque {
  debit: number;
  credit: number;
}

export const totaux = (mouvements: MouvementBancaire[]): TotauxBanque => ({
  debit: r3(mouvements.reduce((s, m) => s + m.debit, 0)),
  credit: r3(mouvements.reduce((s, m) => s + m.credit, 0)),
});

/** Solde calculé du compte et écart avec le solde du relevé de la banque (null tant qu'il n'est pas saisi). */
export function controleSolde(compte: CompteBancaire, mouvements: MouvementBancaire[]): { calcule: number; ecart: number | null } {
  const t = totaux(mouvements);
  const calcule = r3(compte.soldeDepart + t.credit - t.debit);
  return { calcule, ecart: compte.soldeReel == null ? null : r3(compte.soldeReel - calcule) };
}

/** Mois (AAAA-MM) présents dans les mouvements, du plus récent au plus ancien. */
export const moisDesMouvements = (mouvements: MouvementBancaire[]) =>
  [...new Set(mouvements.map((m) => m.dateOp.slice(0, 7)))].sort().reverse();

// ── Import d'un relevé ────────────────────────────────────────────────────

export type MouvementImport = Pick<
  MouvementBancaire,
  "dateOp" | "dateValeur" | "libelle" | "details" | "reference" | "numPiece" | "debit" | "credit" | "type" | "cours"
>;

const pad = (n: number) => String(n).padStart(2, "0");

/** Date d'une cellule de relevé (« 02-01-2026 », « 3/8/2026 », date Excel, nombre de série) -> AAAA-MM-JJ. */
export function dateFlexible(v: unknown): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
  if (typeof v === "number" && v > 20000 && v < 80000) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }
  if (typeof v !== "string") return null;
  const t = v.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const m = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2}|\d{4})$/.exec(t);
  if (!m) return null;
  const annee = m[3].length === 2 ? `20${m[3]}` : m[3];
  const jour = Number(m[1]);
  const mois = Number(m[2]);
  if (jour < 1 || jour > 31 || mois < 1 || mois > 12) return null;
  return `${annee}-${pad(mois)}-${pad(jour)}`;
}

export function montantCellule(v: unknown): number {
  if (typeof v === "number") return Math.abs(r3(v));
  if (typeof v !== "string") return 0;
  const n = convertirNombre(v.replace(/\s*(TND|DT|EUR|USD)\s*$/i, ""));
  return n === null ? 0 : Math.abs(r3(n));
}

export const texte = (v: unknown) => (v == null ? "" : typeof v === "string" ? v.trim() : String(v));
