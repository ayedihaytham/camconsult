import { toNumber } from "@/lib/amount";
import { suggestLibelle } from "@/lib/honoraires/labels";
import type { HonoraireLigneInput } from "@/store/honoraires";
import type { HonoraireType } from "@/types";

export type HonoraireImportLigne = Omit<HonoraireLigneInput, "societeId">;
type Champ =
  | "type"
  | "nature"
  | "periode"
  | "libelle"
  | "cnss"
  | "numQuittance"
  | "montantDeclaration"
  | "honoraire"
  | "reglement"
  | "note";

const HEADER_KEYS: Record<string, Champ> = {
  type: "type",
  typededeclaration: "type",
  nature: "nature",
  periode: "periode",
  libelle: "libelle",
  designation: "libelle",
  cnss: "cnss",
  refcnss: "cnss",
  referencecnss: "cnss",
  nquittance: "numQuittance",
  numquittance: "numQuittance",
  numeroquittance: "numQuittance",
  quittance: "numQuittance",
  montantdeclaration: "montantDeclaration",
  mtdeclaration: "montantDeclaration",
  declaration: "montantDeclaration",
  honoraire: "honoraire",
  honoraires: "honoraire",
  reglement: "reglement",
  reglementrecu: "reglement",
  reglements: "reglement",
  note: "note",
  observation: "note",
  commentaire: "note",
};

function normalize(s: string) {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/** Texte libre du fichier (« Mensuelle », « AP 01 », « 2e acompte »…) → type
 * du cabinet ; « autre » quand rien ne correspond. */
export function toType(cell: unknown): HonoraireType {
  const t = normalize(String(cell ?? ""));
  if (!t) return "autre";
  if (/(acompte|ap)0?1|1e?r?acompte|premieracompte/.test(t)) return "acompte1";
  if (/(acompte|ap)0?2|2e?acompte|deuxiemeacompte/.test(t)) return "acompte2";
  if (/(acompte|ap)0?3|3e?acompte|troisiemeacompte/.test(t)) return "acompte3";
  if (t.startsWith("mens")) return "mensuelle";
  if (t.startsWith("trim")) return "trimestrielle";
  if (t.startsWith("ann")) return "annuelle";
  return "autre";
}

/** Cherche la ligne d'en-tête dans les 10 premières lignes (au moins une
 * colonne de montant reconnue), puis lit les lignes qui suivent. */
export function parseRows(raw: unknown[][]): HonoraireImportLigne[] {
  let headerIdx = -1;
  let colMap: Partial<Record<Champ, number>> = {};
  for (let i = 0; i < Math.min(raw.length, 10); i++) {
    const map: Partial<Record<Champ, number>> = {};
    (raw[i] ?? []).forEach((cell, j) => {
      const key = HEADER_KEYS[normalize(String(cell ?? ""))];
      if (key && map[key] === undefined) map[key] = j;
    });
    if (
      map.montantDeclaration !== undefined ||
      map.honoraire !== undefined ||
      map.reglement !== undefined
    ) {
      headerIdx = i;
      colMap = map;
      break;
    }
  }
  if (headerIdx === -1) return [];

  const at = (row: unknown[], k: Champ) =>
    colMap[k] !== undefined ? row[colMap[k] as number] : undefined;
  const text = (row: unknown[], k: Champ) => String(at(row, k) ?? "").trim();

  const out: HonoraireImportLigne[] = [];
  for (let i = headerIdx + 1; i < raw.length; i++) {
    const row = raw[i] ?? [];
    const type = colMap.type !== undefined ? toType(at(row, "type")) : "autre";
    const nature = text(row, "nature");
    const periode = text(row, "periode");
    const montantDeclaration = toNumber(at(row, "montantDeclaration"));
    const honoraire = toNumber(at(row, "honoraire"));
    const reglement = toNumber(at(row, "reglement"));
    const libelleLu = text(row, "libelle");
    // Le mot « Total » / « Solde » peut être dans n'importe quelle colonne de
    // texte (souvent la première) : on regarde la première cellule remplie.
    const firstCell = String(row.find((v) => String(v ?? "").trim() !== "") ?? "")
      .trim()
      .toLowerCase();
    // Ignore les lignes vides et les lignes « Total » / « Solde » de bas de tableau.
    if (!montantDeclaration && !honoraire && !reglement && !libelleLu && !periode) continue;
    if (/^(total|solde)\b/.test(firstCell)) continue;
    out.push({
      type,
      nature,
      periode,
      libelle: libelleLu || suggestLibelle(type, nature, periode),
      cnss: text(row, "cnss"),
      numQuittance: text(row, "numQuittance"),
      montantDeclaration,
      honoraire,
      reglement,
      dateReglement: null,
      note: text(row, "note"),
    });
  }
  return out;
}

