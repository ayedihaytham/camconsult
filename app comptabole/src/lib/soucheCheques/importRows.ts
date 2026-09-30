import { toNumber } from "@/lib/amount";
import { toDateString } from "@/lib/importCells";
import type { SoucheChequeInput } from "@/store/soucheCheques";
import type { SoucheChequeDevise } from "@/types";

type Champ =
  | "banque"
  | "numCheque"
  | "dateEmission"
  | "beneficiaire"
  | "motif"
  | "montant"
  | "debite"
  | "dateDebit"
  | "devise";

export function normalize(s: string) {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/** En-tête → champ. Tolère les variantes du modèle du cabinet
 * (« N° de Chèque », « Date d'Émission », « Montant (TND-EUR-USD) »,
 * « Statut Débité (Oui/Non) »…). */
export function champPour(header: unknown): Champ | null {
  const h = normalize(String(header ?? ""));
  if (!h) return null;
  if (h === "banque") return "banque";
  if (/^(n|no|num|numero)?(de)?cheque$/.test(h) || h === "ndecheque") return "numCheque";
  if (h.startsWith("dateded") || h.startsWith("datedeb") || h === "datedebit") return "dateDebit";
  if (h.startsWith("dateem") || h.startsWith("datedem") || h === "emission") return "dateEmission";
  if (h.startsWith("benef")) return "beneficiaire";
  if (h.startsWith("motif") || h === "description" || h === "objet") return "motif";
  if (h.startsWith("montant")) return "montant";
  if (h.startsWith("statut") || h.startsWith("debite")) return "debite";
  if (h === "devise" || h === "monnaie") return "devise";
  return null;
}

const OUI = new Set(["oui", "o", "yes", "y", "true", "vrai", "1", "x", "debite"]);
export const toBool = (v: unknown) => v === true || OUI.has(normalize(String(v ?? "")));

export function toDevise(v: unknown): SoucheChequeDevise {
  const d = String(v ?? "").trim().toUpperCase();
  if (d === "EUR" || d === "€" || d === "EURO") return "EUR";
  if (d === "USD" || d === "$" || d === "DOLLAR") return "USD";
  return "TND";
}

/** Cherche la ligne d'en-tête dans les 10 premières lignes (la colonne
 * « N° de Chèque » est obligatoire pour la reconnaître), puis lit les
 * chèques. Les lignes vides et « Total… » sont ignorées. */
export function parseRows(raw: unknown[][]): SoucheChequeInput[] {
  let headerIdx = -1;
  let colMap: Partial<Record<Champ, number>> = {};
  for (let i = 0; i < Math.min(raw.length, 10); i++) {
    const map: Partial<Record<Champ, number>> = {};
    (raw[i] ?? []).forEach((cell, j) => {
      const c = champPour(cell);
      if (c && map[c] === undefined) map[c] = j;
    });
    if (map.numCheque !== undefined) {
      headerIdx = i;
      colMap = map;
      break;
    }
  }
  if (headerIdx === -1) return [];

  const at = (row: unknown[], k: Champ) =>
    colMap[k] !== undefined ? row[colMap[k] as number] : undefined;
  const text = (row: unknown[], k: Champ) => String(at(row, k) ?? "").trim();

  const out: SoucheChequeInput[] = [];
  for (let i = headerIdx + 1; i < raw.length; i++) {
    const row = raw[i] ?? [];
    const numCheque = text(row, "numCheque");
    const beneficiaire = text(row, "beneficiaire");
    const montant = toNumber(at(row, "montant"));
    const premiere = String(row.find((v) => String(v ?? "").trim() !== "") ?? "")
      .trim()
      .toLowerCase();
    if (!numCheque && !beneficiaire && !montant) continue;
    if (/^total\b/.test(premiere)) continue;
    const debite = toBool(at(row, "debite"));
    out.push({
      banque: text(row, "banque"),
      numCheque,
      dateEmission: toDateString(at(row, "dateEmission")),
      beneficiaire,
      motif: text(row, "motif"),
      montant,
      devise: toDevise(at(row, "devise")),
      debite,
      dateDebit: debite ? toDateString(at(row, "dateDebit")) : null,
    });
  }
  return out;
}
