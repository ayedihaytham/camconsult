import type { CollecteFull } from "@/types";
import { printTable } from "@/lib/print";
import { TAB_BY_KEY, cellNumber } from "./tabs";
import { checklistRows } from "./checklist";

type Cell = string | number;

interface Sheet {
  /** nom de la feuille / titre du document */
  title: string;
  header: string[];
  body: Cell[][];
  /** colonnes numériques (alignées à droite, formatées dans le PDF) */
  numeric: boolean[];
}

const deviseLabel = (c: CollecteFull) => (c.devise === "EUR" ? "€" : c.devise);

/** « 2026-09-24 » → « 24/09/2026 », comme à l'écran. */
const frDate = (v: unknown): Cell => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v ?? ""));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : ((v ?? "") as Cell);
};

function checklistSheet(collecte: CollecteFull): Sheet {
  const rows = checklistRows(collecte);
  return {
    title: "Checklist",
    header: [
      "Pièce à transmettre",
      "Onglet correspondant",
      "Période concernée",
      "Statut",
      "Date de réception",
      `Total (${deviseLabel(collecte)})`,
      "Commentaire",
    ],
    body: rows.map((r) => [
      r.pieceLabel,
      r.tabLabel,
      collecte.periode,
      r.statutLabel,
      frDate(r.dateReception),
      r.total ?? "",
      r.commentaire,
    ]),
    numeric: [false, false, false, false, false, true, false],
  };
}

/** Un onglet de saisie : colonnes dérivées calculées, + ligne Total si l'onglet en a une. */
function tabSheet(collecte: CollecteFull, key: string, withTotal: boolean): Sheet | null {
  const def = TAB_BY_KEY[key];
  if (!def) return null;
  const data = collecte.lignes
    .filter((l) => l.onglet === key)
    .sort((a, b) => a.ordre - b.ordre)
    .map((l) => l.data);
  const derived = def.derive ? def.derive(data) : data;
  const body: Cell[][] = derived.map((r) =>
    def.columns.map((c) => {
      const v = r[c.key];
      if (v == null) return "";
      return c.type === "date" ? frDate(v) : (v as Cell);
    }),
  );
  if (withTotal && def.totalKey && body.length > 0) {
    const idx = def.columns.findIndex((c) => c.key === def.totalKey);
    const total = Math.round(derived.reduce((s, r) => s + cellNumber(r[def.totalKey!]), 0) * 100) / 100;
    body.push(def.columns.map((_, i) => (i === 0 ? def.totalLabel ?? "Total" : i === idx ? total : "")));
  }
  return {
    title: def.label,
    header: def.columns.map((c) => c.label),
    body,
    numeric: def.columns.map((c) => c.type === "number"),
  };
}

// Excel mis en forme comme le classeur du cabinet : voir exportStyled.ts
// (chargé à la demande, ExcelJS est lourd).

/** Classeur complet : Checklist + un onglet par tableau demandé. */
export async function exportCollecteXlsx(collecte: CollecteFull, societeNom: string): Promise<void> {
  const { exportCollecteStyled } = await import("./exportStyled");
  return exportCollecteStyled(collecte, societeNom);
}

/** Excel d'une seule section, indépendamment des autres. */
export async function exportCollecteSectionXlsx(
  collecte: CollecteFull,
  section: string,
  societeNom: string,
): Promise<void> {
  const { exportSectionStyled } = await import("./exportStyled");
  return exportSectionStyled(collecte, section, societeNom);
}

/** Une seule section de la collecte : « checklist » ou la clé d'un onglet de saisie. */
function sectionSheet(collecte: CollecteFull, section: string): Sheet | null {
  return section === "checklist" ? checklistSheet(collecte) : tabSheet(collecte, section, true);
}

const fmtNumber = (v: Cell) =>
  typeof v === "number" || (v !== "" && Number.isFinite(Number(String(v).replace(/\s/g, "").replace(",", "."))))
    ? cellNumber(v).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : String(v);

/** PDF (impression navigateur) d'une seule section, indépendamment des autres. */
export function printCollecteSection(collecte: CollecteFull, section: string, societeNom: string): void {
  const sheet = sectionSheet(collecte, section);
  if (!sheet) return;
  printTable<Cell[]>({
    title: `${sheet.title} — ${societeNom}`,
    subtitle: [
      collecte.periode.trim() && `Période : ${collecte.periode}`,
      `Devise : ${deviseLabel(collecte)}`,
    ]
      .filter(Boolean)
      .join(" · "),
    columns: sheet.header.map((h, i) => ({
      header: h,
      align: sheet.numeric[i] ? "right" : "left",
      value: (r) => (sheet.numeric[i] && r[i] !== "" ? fmtNumber(r[i]) : String(r[i] ?? "")),
    })),
    rows: sheet.body,
  });
}
