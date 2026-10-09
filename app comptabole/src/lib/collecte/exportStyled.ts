// Export Excel « façon classeur du cabinet » (voir les modèles fournis) :
// titre bleu, bandeau d'en-têtes bleu foncé, cellules jaunes = à saisir par
// le client, blanc = calculé, ligne TOTAL en formule. ExcelJS est chargé à la
// demande (lourd), uniquement au moment de l'export.
import type { Workbook, Worksheet } from "exceljs";
import type { CollecteFull } from "@/types";
import { TAB_BY_KEY, cellNumber, ordonnerTableaux, titreDocument } from "./tabs";
import { checklistRows } from "./checklist";
import { colonnesDocument, lignesDocument } from "./exportXlsx";

const BLEU = "FF1F4E79";
const JAUNE = "FFFFFF00";
const GRIS_BORD = "FFC8C8C8";
/** Lignes en alternance et ligne TOTAL, comme le PDF. */
const GRIS_LIGNE = "FFF7F8FA";
const FOND_TOTAL = "FFE8EEF5";
const MONTANT = "#,##0.000";
/** Lignes de saisie proposées même si le client en a rempli moins (comme le modèle). */
const LIGNES_MIN = 25;
const SOUS_TITRE = "Cellules jaunes = à saisir par le client · le reste se calcule automatiquement";

const fill = (argb: string) => ({ type: "pattern" as const, pattern: "solid" as const, fgColor: { argb } });
const border = {
  top: { style: "thin" as const, color: { argb: GRIS_BORD } },
  left: { style: "thin" as const, color: { argb: GRIS_BORD } },
  bottom: { style: "thin" as const, color: { argb: GRIS_BORD } },
  right: { style: "thin" as const, color: { argb: GRIS_BORD } },
};

const deviseLabel = (c: CollecteFull) => (c.devise === "EUR" ? "€" : c.devise);

/** « 2026-09-24 » ou « 24/09/2026 » → vraie date Excel ; sinon le texte tel quel. */
function toDate(v: unknown): Date | string {
  const s = String(v ?? "");
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return new Date(Date.UTC(+iso[1], +iso[2] - 1, +iso[3]));
  const fr = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (fr) return new Date(Date.UTC(+fr[3], +fr[2] - 1, +fr[1]));
  return s;
}

function colLetter(n: number) {
  let s = "";
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s;
  return s;
}

function enTetes(ws: Worksheet, row: number, labels: string[]) {
  const r = ws.getRow(row);
  labels.forEach((l, i) => {
    const c = r.getCell(i + 1);
    c.value = l;
    c.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    c.fill = fill(BLEU);
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.border = border;
  });
  r.height = 30;
}

function titre(ws: Worksheet, texte: string, sousTitre: string) {
  const t = ws.getCell("A1");
  t.value = texte;
  t.font = { bold: true, size: 16, color: { argb: BLEU } };
  const s = ws.getCell("A2");
  s.value = sousTitre;
  s.font = { italic: true, size: 10, color: { argb: "FF7F7F7F" } };
}

/** Feuille d'un tableau de saisie : même présentation que le PDF du tableau (voir exportPdf) — titre et sous-titre, bandeau
 * d'en-têtes bleu foncé, lignes saisies à fond blanc et gris clair en alternance, ligne TOTAL en gras sur fond bleu pâle.
 * Mêmes colonnes et mêmes lignes que le PDF (voir colonnesDocument / lignesDocument). */
export function feuilleOnglet(wb: Workbook, collecte: CollecteFull, key: string, societeNom = "") {
  const def = TAB_BY_KEY[key];
  if (!def) return;
  if (key === "etat_caisse") return feuilleCaisse(wb, collecte);
  const ws = wb.addWorksheet(def.label.slice(0, 31), { views: [{ state: "frozen", ySplit: 4 }] });
  const devise = deviseLabel(collecte);
  const sousTitre = [societeNom, collecte.periode.trim() && `Période : ${collecte.periode}`, `Devise : ${devise}`].filter(Boolean).join(" · ");
  titre(ws, titreDocument(def), sousTitre);
  const colonnes = colonnesDocument(def);
  // Montants : « Montant HT (€) » ; jamais pour un pourcentage (« TVA % »).
  const isPct = (c: { label: string }) => c.label.includes("%");
  enTetes(
    ws,
    4,
    colonnes.map((c) =>
      c.type === "number" && !isPct(c) && !/\(.+\)$/.test(c.label) ? `${c.label} (${devise})` : c.label,
    ),
  );
  const lettreDe = (k: string) => colLetter(colonnes.findIndex((c) => c.key === k) + 1);
  ws.columns = colonnes.map((c) => ({ width: Math.max(12, Math.round((c.width ?? 140) / 7)) }));

  const data = lignesDocument(
    def,
    collecte.lignes
      .filter((l) => l.onglet === key)
      .sort((a, b) => a.ordre - b.ordre)
      .map((l) => l.data),
  );
  const derived = def.derive ? def.derive(data) : data;
  const first = 5;
  const last = first + derived.length - 1;

  if (derived.length === 0) {
    ws.mergeCells(first, 1, first, colonnes.length);
    const vide = ws.getCell(first, 1);
    vide.value = "Aucune ligne saisie.";
    vide.font = { italic: true, color: { argb: "FF6E6E6E" } };
    vide.alignment = { horizontal: "center" };
    vide.border = border;
  }

  derived.forEach((src, i) => {
    const r = ws.getRow(first + i);
    colonnes.forEach((col, j) => {
      const c = r.getCell(j + 1);
      const v = src[col.key];
      if (col.excelFormula) {
        // Colonne calculée : vraie formule, pour qu'elle suive ce qu'on modifie dans Excel.
        c.value = { formula: col.excelFormula(first + i, lettreDe), result: v != null && v !== "" ? cellNumber(v) : "" };
      } else if (v != null && v !== "") {
        c.value = col.type === "number" ? cellNumber(v) : col.type === "date" ? toDate(v) : String(v);
      }
      if (col.excelNumFmt) c.numFmt = col.excelNumFmt;
      else if (col.type === "number" && !isPct(col)) c.numFmt = MONTANT;
      if (col.type === "date") c.numFmt = "dd/mm/yyyy";
      c.alignment = { horizontal: col.type === "number" ? "right" : "left", vertical: "middle" };
      c.border = border;
      c.fill = fill(i % 2 === 1 ? GRIS_LIGNE : "FFFFFFFF");
      if (col.type === "select" && col.options?.length) {
        const liste = col.options.join(",");
        if (!col.options.some((o) => o.includes(",")) && liste.length < 250)
          c.dataValidation = { type: "list", allowBlank: true, formulae: [`"${liste}"`] };
      }
    });
  });

  // Ligne TOTAL juste sous les lignes (formules : suivent les modifications faites dans Excel), comme le PDF.
  const totaux = (def.excelTotalKeys ?? (def.totalKey ? [def.totalKey] : []))
    .map((k) => ({ key: k, idx: colonnes.findIndex((c) => c.key === k) }))
    .filter((t) => t.idx >= 0);
  if (totaux.length > 0 && derived.length > 0) {
    const r = ws.getRow(last + 1);
    colonnes.forEach((_, j) => {
      const c = r.getCell(j + 1);
      c.fill = fill(FOND_TOTAL);
      c.border = border;
      c.font = { bold: true };
    });
    r.getCell(1).value = def.excelTotalLabel ?? (def.totalLabel ?? "Total").toUpperCase();
    for (const { key: k, idx } of totaux) {
      const lettre = colLetter(idx + 1);
      const tot = r.getCell(idx + 1);
      tot.value = {
        formula: `SUM(${lettre}${first}:${lettre}${last})`,
        result: Math.round(derived.reduce((sum, x) => sum + cellNumber(x[k]), 0) * 1000) / 1000,
      };
      tot.numFmt = MONTANT;
      tot.alignment = { horizontal: "right" };
    }
  }
}

/**
 * État de caisse — mise en page propre (voir le modèle) : ligne 5 « Solde
 * initial » (solde en jaune), 25 lignes d'opérations, Solde en solde courant
 * calculé par Excel, ligne « TOTAUX / SOLDE FINAL ».
 */
function feuilleCaisse(wb: Workbook, collecte: CollecteFull) {
  const def = TAB_BY_KEY.etat_caisse;
  const ws = wb.addWorksheet(def.label.slice(0, 31), { views: [{ state: "frozen", ySplit: 5 }] });
  titre(ws, titreDocument(def), SOUS_TITRE);
  const devise = deviseLabel(collecte);
  enTetes(
    ws,
    4,
    def.columns.map((c) => (c.type === "number" ? `${c.label} (${devise})` : c.label)),
  );
  ws.columns = def.columns.map((c) => ({ width: Math.max(12, Math.round((c.width ?? 140) / 7)) }));

  const data = collecte.lignes
    .filter((l) => l.onglet === "etat_caisse")
    .sort((a, b) => a.ordre - b.ordre)
    .map((l) => l.data);
  const derived = def.derive ? def.derive(data) : data;
  // Même règle que l'app : la 1re ligne sans entrée ni sortie = solde initial.
  const aInitial =
    derived.length > 0 && cellNumber(derived[0].entree) === 0 && cellNumber(derived[0].sortie) === 0;
  const soldeInitial = aInitial ? cellNumber(derived[0].solde) : null;
  const ops = aInitial ? derived.slice(1) : derived;

  // Ligne 5 : solde initial
  const r5 = ws.getRow(5);
  for (let j = 1; j <= 6; j++) r5.getCell(j).border = border;
  r5.getCell(2).value = "Solde initial";
  r5.getCell(2).font = { bold: true };
  const si = r5.getCell(5);
  if (soldeInitial !== null) si.value = soldeInitial;
  si.numFmt = MONTANT;
  si.fill = fill(JAUNE);

  const first = 6;
  const nb = Math.max(LIGNES_MIN, ops.length);
  const last = first + nb - 1;
  for (let i = 0; i < nb; i++) {
    const rowNum = first + i;
    const r = ws.getRow(rowNum);
    const src = ops[i];
    const saisie: [number, unknown, "date" | "text" | "number"][] = [
      [1, src?.date, "date"],
      [2, src?.libelle, "text"],
      [3, src?.entree, "number"],
      [4, src?.sortie, "number"],
      [6, src?.observations, "text"],
    ];
    for (const [j, v, type] of saisie) {
      const c = r.getCell(j);
      if (v != null && v !== "")
        c.value = type === "number" ? cellNumber(v) : type === "date" ? toDate(v) : String(v);
      if (type === "number") c.numFmt = MONTANT;
      if (type === "date") c.numFmt = "dd/mm/yyyy";
      c.fill = fill(JAUNE);
      c.border = border;
    }
    const solde = r.getCell(5);
    solde.value = {
      formula: `IF(AND(C${rowNum}="",D${rowNum}=""),"",ROUND(N($E$5)+SUM($C$${first}:C${rowNum})-SUM($D$${first}:D${rowNum}),2))`,
      result: src ? cellNumber(src.solde) : "",
    };
    solde.numFmt = MONTANT;
    solde.border = border;
  }

  const rt = ws.getRow(last + 2);
  rt.getCell(2).value = "TOTAUX / SOLDE FINAL";
  rt.getCell(2).font = { bold: true };
  const sum = (key: "entree" | "sortie") =>
    Math.round(ops.reduce((s, x) => s + cellNumber(x[key]), 0) * 1000) / 1000;
  const cells: [number, string, number][] = [
    [3, `SUM(C${first}:C${last})`, sum("entree")],
    [4, `SUM(D${first}:D${last})`, sum("sortie")],
    [5, `ROUND(N(E5)+C${last + 2}-D${last + 2},2)`, (soldeInitial ?? 0) + sum("entree") - sum("sortie")],
  ];
  for (const [j, formula, result] of cells) {
    const c = rt.getCell(j);
    c.value = { formula, result: Math.round(result * 1000) / 1000 };
    c.numFmt = MONTANT;
    c.font = { bold: true };
  }
}

/** Feuille Checklist (pièces à transmettre, statut, total par tableau) : même présentation que les tableaux et le PDF — en-têtes
 * et valeurs dans les mêmes colonnes, lignes blanches et grises en alternance, statut en couleur, résumé en bas. */
export function feuilleChecklist(wb: Workbook, collecte: CollecteFull, societeNom: string) {
  const ws = wb.addWorksheet("Checklist", { views: [{ state: "frozen", ySplit: 4 }] });
  const devise = deviseLabel(collecte);
  titre(
    ws,
    "CHECKLIST DES PIÈCES À TRANSMETTRE",
    [societeNom, collecte.periode.trim() && `Période : ${collecte.periode}`, `Devise : ${devise}`].filter(Boolean).join(" · "),
  );
  const entetes = ["Pièce à transmettre", "Onglet correspondant", "Période concernée", "Statut", "Date de réception", `Total (${devise})`, "Commentaire"];
  enTetes(ws, 4, entetes);
  ws.columns = [{ width: 48 }, { width: 32 }, { width: 20 }, { width: 16 }, { width: 18 }, { width: 18 }, { width: 40 }];

  const rows = checklistRows(collecte);
  rows.forEach((row, i) => {
    const r = ws.getRow(5 + i);
    const periode = collecte.periode.trim();
    const cells: (string | number | Date | null)[] = [
      row.pieceLabel,
      row.etat ? `${row.etat} · ${row.tabLabel}` : row.tabLabel,
      periode || null,
      row.statutLabel,
      row.dateReception ? (toDate(row.dateReception) as Date | string) : null,
      row.total,
      row.commentaire || null,
    ];
    cells.forEach((v, j) => {
      const c = r.getCell(j + 1);
      if (v !== null && v !== undefined && v !== "") c.value = v;
      c.border = border;
      c.fill = fill(i % 2 === 1 ? GRIS_LIGNE : "FFFFFFFF");
      c.alignment = { vertical: "middle", horizontal: j === 5 ? "right" : j === 3 || j === 4 ? "center" : "left", wrapText: j === 0 || j === 6 };
    });
    // Statut en couleur : vert si reçu, orange tant que la pièce est attendue.
    r.getCell(4).font = { bold: true, color: { argb: row.recu ? "FF1E7B4D" : "FFB45F06" } };
    r.getCell(5).numFmt = "dd/mm/yyyy";
    r.getCell(6).numFmt = MONTANT;
    r.getCell(6).font = { bold: true };
  });

  // Résumé : mêmes colonnes que le tableau, sur fond bleu pâle comme la ligne TOTAL des autres feuilles.
  const recus = rows.filter((r) => r.recu).length;
  [
    ["Nb de pièces reçues", recus],
    ["Nb de pièces en attente", rows.length - recus],
  ].forEach(([label, n], k) => {
    const r = ws.getRow(5 + rows.length + k);
    for (let j = 1; j <= entetes.length; j++) {
      const c = r.getCell(j);
      c.fill = fill(FOND_TOTAL);
      c.border = border;
      c.font = { bold: true };
    }
    r.getCell(1).value = label as string;
    r.getCell(2).value = n as number;
    r.getCell(2).alignment = { horizontal: "left" };
  });
}

async function telecharger(wb: Workbook, nomFichier: string) {
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomFichier;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

const safe = (s: string) => s.replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_+|_+$/g, "").slice(0, 80);

async function nouveauClasseur() {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "CAMCONSULT";
  // Excel recalcule toutes les formules à l'ouverture (ancienneté du jour, soldes…).
  wb.calcProperties.fullCalcOnLoad = true;
  return wb;
}

/** Classeur complet : Checklist + un onglet par tableau demandé. */
export async function exportCollecteStyled(collecte: CollecteFull, societeNom: string) {
  const wb = await nouveauClasseur();
  feuilleChecklist(wb, collecte, societeNom);
  for (const key of ordonnerTableaux(collecte.onglets)) feuilleOnglet(wb, collecte, key, societeNom);
  await telecharger(wb, `Collecte_${safe(`${societeNom}-${collecte.periode}`)}.xlsx`);
}

/** Une seule section (« checklist » ou clé d'onglet), indépendamment des autres. */
export async function exportSectionStyled(collecte: CollecteFull, section: string, societeNom: string) {
  const wb = await nouveauClasseur();
  const nom =
    section === "checklist" ? "Checklist" : (TAB_BY_KEY[section]?.label ?? section);
  if (section === "checklist") feuilleChecklist(wb, collecte, societeNom);
  else feuilleOnglet(wb, collecte, section, societeNom);
  await telecharger(wb, `${safe(nom)}_${safe(`${societeNom}-${collecte.periode}`)}.xlsx`);
}
