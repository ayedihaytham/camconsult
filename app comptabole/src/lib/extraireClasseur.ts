/**
 * Noyau d'extraction d'un classeur : s'exécute dans le travailleur (classeurWorker.ts), mais reste pur et testable.
 * Il ne renvoie que des données simples (nombres, textes, booléens, null, dates en « AAAA-MM-JJ »), jamais l'objet classeur.
 */
import type * as XlsxType from "xlsx";

export interface LimitesExtraction {
  feuillesMax: number;
  lignesMax: number;
  colonnesMax: number;
  cellulesMax: number;
}

/** Limites PROVISOIRES (à confirmer par le propriétaire d'après des classeurs réels). */
export const LIMITES_EXTRACTION: LimitesExtraction = { feuillesMax: 50, lignesMax: 100_000, colonnesMax: 200, cellulesMax: 2_000_000 };

export type CelluleSimple = string | number | boolean | null | { date: string };
export interface FeuilleSimple {
  nom: string;
  rows: CelluleSimple[][];
  fusions: { ligne1: number; ligne2: number; colonne: number }[];
}
export class DepassementLimite extends Error {}

const pad = (n: number) => String(n).padStart(2, "0");

function simple(v: unknown): CelluleSimple {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : { date: `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}` };
  if (v === undefined || v === null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" || typeof v === "boolean") return v;
  return String(v);
}

export function extraireFeuilles(
  XLSX: typeof XlsxType,
  donnees: ArrayBuffer,
  options: { cellDates?: boolean } = {},
  limites: LimitesExtraction = LIMITES_EXTRACTION,
): FeuilleSimple[] {
  // sheetRows borne l'analyse elle-même : au-delà de lignesMax + 1 lignes la bibliothèque s'arrête (une ligne de plus sert à détecter le dépassement).
  const classeur = XLSX.read(donnees, { type: "array", cellDates: options.cellDates ?? true, sheetRows: limites.lignesMax + 1 });
  if (classeur.SheetNames.length > limites.feuillesMax) throw new DepassementLimite("trop de feuilles");
  let cellules = 0;
  return classeur.SheetNames.map((nom) => {
    const ws = classeur.Sheets[nom];
    const ref = ws?.["!ref"] ? XLSX.utils.decode_range(ws["!ref"]) : null;
    if (ref) {
      if (ref.e.r + 1 > limites.lignesMax) throw new DepassementLimite("trop de lignes");
      if (ref.e.c + 1 > limites.colonnesMax) throw new DepassementLimite("trop de colonnes");
      cellules += (ref.e.r + 1) * (ref.e.c + 1);
      if (cellules > limites.cellulesMax) throw new DepassementLimite("trop de cellules");
    }
    const brut = ref ? XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: null, range: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: ref.e }) }) : [];
    const fusions = (ws?.["!merges"] ?? []).filter((m) => m.s.c === m.e.c && m.e.r > m.s.r).map((m) => ({ ligne1: m.s.r, ligne2: m.e.r, colonne: m.s.c }));
    return { nom, rows: brut.map((l) => l.map(simple)), fusions };
  });
}
