import type { CollecteFull } from "@/types";
import { TAB_BY_KEY } from "./tabs";
import { checklistRows } from "./checklist";

/** Exporte une collecte remplie en .xlsx : 1 feuille Checklist + 1 par onglet. */
export async function exportCollecteXlsx(
  collecte: CollecteFull,
  societeNom: string,
): Promise<void> {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();

  // ── Feuille Checklist ──────────────────────────
  const rows = checklistRows(collecte);
  const head = [
    "Pièce à transmettre",
    "Onglet correspondant",
    "Période concernée",
    "Statut",
    "Date de réception",
    `Total (${collecte.devise === "EUR" ? "€" : collecte.devise})`,
    "Commentaire",
  ];
  const aoa: (string | number)[][] = [
    [`CHECKLIST — ${societeNom} — ${collecte.periode}`],
    [],
    head,
    ...rows.map((r) => [
      r.pieceLabel,
      r.tabLabel,
      collecte.periode,
      r.statutLabel,
      r.dateReception ?? "",
      r.total ?? "",
      r.commentaire,
    ]),
    [],
    ["Nb de pièces reçues", rows.filter((r) => r.recu).length],
    ["Nb de pièces en attente", rows.filter((r) => !r.recu).length],
  ];
  const wsCheck = XLSX.utils.aoa_to_sheet(aoa);
  wsCheck["!cols"] = [
    { wch: 42 },
    { wch: 26 },
    { wch: 18 },
    { wch: 16 },
    { wch: 16 },
    { wch: 14 },
    { wch: 30 },
  ];
  XLSX.utils.book_append_sheet(wb, wsCheck, "Checklist");

  // ── Une feuille par onglet demandé ─────────────
  for (const key of collecte.onglets) {
    const def = TAB_BY_KEY[key];
    if (!def) continue;
    const data = collecte.lignes
      .filter((l) => l.onglet === key)
      .sort((a, b) => a.ordre - b.ordre)
      .map((l) => l.data);
    const derived = def.derive ? def.derive(data) : data;
    const header = def.columns.map((c) => c.label);
    const body = derived.map((r) =>
      def.columns.map((c) => {
        const v = r[c.key];
        return v == null ? "" : (v as string | number);
      }),
    );
    const ws = XLSX.utils.aoa_to_sheet([header, ...body]);
    ws["!cols"] = def.columns.map((c) => ({
      wch: Math.max(12, Math.round((c.width ?? 140) / 8)),
    }));
    XLSX.utils.book_append_sheet(wb, ws, def.label.slice(0, 31));
  }

  const safe = `${societeNom}-${collecte.periode}`
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .slice(0, 80);
  XLSX.writeFile(wb, `Collecte_${safe}.xlsx`);
}
