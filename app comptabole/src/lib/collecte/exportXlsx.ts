import type { CollecteFull } from "@/types";
import { printTable } from "@/lib/print";
import { TAB_BY_KEY, cellNumber, titreDocument, type TabColumn } from "./tabs";
import { checklistRows } from "./checklist";

const deviseLabel = (c: CollecteFull) => (c.devise === "EUR" ? "€" : c.devise);

/** « 2026-09-24 » → « 24/09/2026 », comme à l'écran. */
const frDate = (v: unknown): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v ?? ""));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(v ?? "");
};

/** « 1 200,50 » — espaces normales (les polices PDF standard n'ont pas l'espace fine insécable). */
const fmtMontant = (n: number) =>
  n
    .toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .replace(/[  ]/g, " ");

const isPct = (c: Pick<TabColumn, "label">) => c.label.includes("%");
const enTete = (c: TabColumn, devise: string) =>
  c.type === "number" && !isPct(c) && !/\(.+\)$/.test(c.label) ? `${c.label} (${devise})` : c.label;

function cellule(c: TabColumn, v: unknown): string {
  if (v == null || v === "") return "";
  if (c.type === "date") return frDate(v);
  if (c.type !== "number") return String(v);
  const n = cellNumber(v);
  return isPct(c) || c.excelNumFmt === "0" ? String(n).replace(".", ",") : fmtMontant(n);
}

/** Section prête à imprimer ou à mettre en PDF (textes déjà formatés). */
export interface SectionReport {
  title: string;
  subtitle: string;
  header: string[];
  rows: string[][];
  align: ("left" | "right")[];
  /** la dernière ligne est une ligne de total (en gras) */
  totalRow: boolean;
  fileBase: string;
}

const safe = (s: string) => s.replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_+|_+$/g, "").slice(0, 80);

/** « checklist » ou la clé d'un onglet de saisie — indépendamment des autres. */
export function sectionReport(
  collecte: CollecteFull,
  section: string,
  societeNom: string,
): SectionReport | null {
  const devise = deviseLabel(collecte);
  const subtitle = [societeNom, collecte.periode.trim() && `Période : ${collecte.periode}`, `Devise : ${devise}`]
    .filter(Boolean)
    .join(" · ");
  const fileSuffix = safe(`${societeNom}-${collecte.periode}`);

  if (section === "checklist") {
    const rows = checklistRows(collecte);
    return {
      title: "CHECKLIST DES PIÈCES À TRANSMETTRE",
      subtitle,
      header: [
        "Pièce à transmettre",
        "Onglet correspondant",
        "Période concernée",
        "Statut",
        "Date de réception",
        `Total (${devise})`,
        "Commentaire",
      ],
      rows: rows.map((r) => [
        r.pieceLabel,
        r.tabLabel,
        collecte.periode,
        r.statutLabel,
        frDate(r.dateReception),
        r.total == null ? "" : fmtMontant(r.total),
        r.commentaire,
      ]),
      align: ["left", "left", "left", "left", "left", "right", "left"],
      totalRow: false,
      fileBase: `Checklist_${fileSuffix}`,
    };
  }

  const def = TAB_BY_KEY[section];
  if (!def) return null;
  const data = collecte.lignes
    .filter((l) => l.onglet === section)
    .sort((a, b) => a.ordre - b.ordre)
    .map((l) => l.data);
  const derived = def.derive ? def.derive(data) : data;
  const rows = derived.map((r) => def.columns.map((c) => cellule(c, r[c.key])));

  // Même ligne de total que l'export Excel (ex. HT et TTC pour les achats).
  const keys = def.excelTotalKeys ?? (def.totalKey ? [def.totalKey] : []);
  const totalRow = keys.length > 0 && rows.length > 0;
  if (totalRow) {
    rows.push(
      def.columns.map((c, i) =>
        keys.includes(c.key)
          ? fmtMontant(Math.round(derived.reduce((s, r) => s + cellNumber(r[c.key]), 0) * 100) / 100)
          : i === 0
            ? def.excelTotalLabel ?? (def.totalLabel ?? "Total").toUpperCase()
            : "",
      ),
    );
  }
  return {
    title: titreDocument(def),
    subtitle,
    header: def.columns.map((c) => enTete(c, devise)),
    rows,
    align: def.columns.map((c) => (c.type === "number" ? "right" : "left")),
    totalRow,
    fileBase: `${safe(def.label)}_${fileSuffix}`,
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

/** Impression navigateur d'une seule section. */
export function printCollecteSection(collecte: CollecteFull, section: string, societeNom: string): void {
  const rep = sectionReport(collecte, section, societeNom);
  if (!rep) return;
  printTable<string[]>({
    title: rep.title,
    subtitle: rep.subtitle,
    columns: rep.header.map((h, i) => ({ header: h, align: rep.align[i], value: (r) => r[i] })),
    rows: rep.rows,
  });
}

/** Vrai fichier PDF d'une seule section, téléchargé directement (jsPDF, chargé à la demande). */
export async function downloadCollecteSectionPdf(
  collecte: CollecteFull,
  section: string,
  societeNom: string,
): Promise<void> {
  const rep = sectionReport(collecte, section, societeNom);
  if (!rep) return;
  const { downloadReportPdf } = await import("./exportPdf");
  await downloadReportPdf(rep);
}
