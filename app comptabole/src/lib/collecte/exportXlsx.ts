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

function toWorksheet(XLSX: typeof import("xlsx"), sheet: Sheet, titleRow?: string) {
  const aoa: Cell[][] = titleRow ? [[titleRow], [], sheet.header, ...sheet.body] : [sheet.header, ...sheet.body];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = sheet.header.map((h, i) => ({
    wch: Math.min(
      48,
      Math.max(12, h.length + 2, ...sheet.body.map((r) => String(r[i] ?? "").length + 2)),
    ),
  }));
  return ws;
}

const safeName = (s: string) => s.replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_+|_+$/g, "").slice(0, 80);
const docTitle = (collecte: CollecteFull, societeNom: string) =>
  [societeNom, collecte.periode.trim()].filter(Boolean).join(" — ");

/** Exporte une collecte remplie en .xlsx : 1 feuille Checklist + 1 par onglet. */
export async function exportCollecteXlsx(collecte: CollecteFull, societeNom: string): Promise<void> {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const check = checklistSheet(collecte);
  const rows = checklistRows(collecte);
  const wsCheck = toWorksheet(XLSX, {
    ...check,
    body: [
      ...check.body,
      [],
      ["Nb de pièces reçues", rows.filter((r) => r.recu).length],
      ["Nb de pièces en attente", rows.filter((r) => !r.recu).length],
    ],
  }, `CHECKLIST — ${docTitle(collecte, societeNom)}`);
  XLSX.utils.book_append_sheet(wb, wsCheck, "Checklist");
  for (const key of collecte.onglets) {
    const sheet = tabSheet(collecte, key, false);
    if (sheet) XLSX.utils.book_append_sheet(wb, toWorksheet(XLSX, sheet), sheet.title.slice(0, 31));
  }
  XLSX.writeFile(wb, `Collecte_${safeName(`${societeNom}-${collecte.periode}`)}.xlsx`);
}

/** Une seule section de la collecte : « checklist » ou la clé d'un onglet de saisie. */
function sectionSheet(collecte: CollecteFull, section: string): Sheet | null {
  return section === "checklist" ? checklistSheet(collecte) : tabSheet(collecte, section, true);
}

/** Excel d'une seule section, indépendamment des autres. */
export async function exportCollecteSectionXlsx(
  collecte: CollecteFull,
  section: string,
  societeNom: string,
): Promise<void> {
  const sheet = sectionSheet(collecte, section);
  if (!sheet) return;
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    toWorksheet(XLSX, sheet, `${sheet.title.toUpperCase()} — ${docTitle(collecte, societeNom)}`),
    sheet.title.slice(0, 31),
  );
  XLSX.writeFile(wb, `${safeName(sheet.title)}_${safeName(`${societeNom}-${collecte.periode}`)}.xlsx`);
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
