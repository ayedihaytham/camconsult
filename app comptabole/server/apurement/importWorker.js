import { parentPort, workerData } from "node:worker_threads";
import XLSX from "xlsx";
import { parseTnd } from "./amounts.js";
const data = Buffer.from(workerData);
try {
  const w = XLSX.read(data, {
    type: "buffer",
    cellDates: false,
    bookVBA: false,
    sheetRows: 2004,
    cellText: true,
  });
  const sheet = w.Sheets.Factures;
  if (!sheet) throw new Error("Feuille Factures introuvable.");
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
  if (range.e.r > 2002 || range.e.c > 100)
    throw new Error(
      "Classeur trop grand : 2000 lignes et 100 colonnes maximum.",
    );
  const cell = (r, c) => sheet[XLSX.utils.encode_cell({ r, c })];
  const display = (r, c) => String(cell(r, c)?.w ?? cell(r, c)?.v ?? "").trim();
  const val = (r, c) => String(cell(r, c)?.v ?? "").trim();
  const header = Array.from(
    { length: Math.min(range.e.r + 1, 20) },
    (_, r) => r,
  ).find(
    (r) =>
      /autorisation/i.test(display(r, 0)) && /facture/i.test(display(r, 3)),
  );
  if (header === undefined)
    throw new Error("Modèle Factures non reconnu : vérifier les dix colonnes.");
  function dateValue(r, c) {
    const raw = display(r, c);
    if (/^(0?[1-9]|1[0-2])\/\d{4}$/.test(raw))
      return { date: null, precision: "month", raw: raw.padStart(7, "0") };
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw);
    if (m)
      return {
        date: `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`,
        precision: "day",
        raw,
      };
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw))
      return { date: raw, precision: "day", raw };
    return { date: null, precision: "unknown", raw };
  }
  const rows = [];
  for (let r = header + 1; r <= range.e.r; r++) {
    if (!Array.from({ length: 10 }, (_, c) => val(r, c)).some(Boolean))
      continue;
    const raw = Array.from({ length: 10 }, (_, c) => ({
      value: val(r, c),
      display: display(r, c),
    }));
    const invoiceDate = dateValue(r, 4),
      bcDate = dateValue(r, 2);
    const errors = [];
    let ht, vat;
    try {
      ht = parseTnd(val(r, 7));
      vat = parseTnd(val(r, 8));
      if (
        (typeof cell(r, 7)?.v === "number" && BigInt(ht) > 9007199254740991n) ||
        (typeof cell(r, 8)?.v === "number" && BigInt(vat) > 9007199254740991n)
      )
        errors.push(
          "Montant numérique Excel trop grand pour garantir les millimes : utiliser une cellule texte vérifiée.",
        );
    } catch (e) {
      errors.push(e.message);
    }
    if (!val(r, 0) || !val(r, 1) || !val(r, 3) || !val(r, 6))
      errors.push("Autorisation, BC, numéro et fournisseur requis.");
    if (
      [0, 1, 3, 5].some(
        (c) =>
          typeof cell(r, c)?.v === "number" &&
          !Number.isSafeInteger(cell(r, c).v),
      )
    )
      errors.push(
        "Identifiant numérique imprécis : fournir une cellule texte.",
      );
    rows.push({
      row: r + 1,
      autorisation: display(r, 0),
      bcNumero: display(r, 1),
      dateBc: bcDate.date,
      fournisseurMf: display(r, 5),
      fournisseur: display(r, 6),
      numeroFacture: display(r, 3),
      dateFacture: invoiceDate.date,
      datePrecision: invoiceDate.precision,
      dateBrute: invoiceDate.raw,
      montantHtMillimes: ht,
      tvaSuspendueMillimes: vat,
      objet: display(r, 9),
      raw,
      errors,
    });
  }
  const source = w.Sheets["Société"];
  const profil = {};
  if (source) {
    for (let r = 0; r < 20; r++) {
      const label = String(source[XLSX.utils.encode_cell({ r, c: 0 })]?.v || "")
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase()
        .replace(/[^a-z]/g, "");
      const value = String(
        source[XLSX.utils.encode_cell({ r, c: 1 })]?.v || "",
      ).trim();
      if (label.includes("raisonsociale")) profil.raisonSociale = value;
      else if (label === "mf") profil.matriculeFiscal = value;
      else if (label.startsWith("activite")) profil.activite = value;
      else if (label.startsWith("ville")) profil.ville = value;
      else if (label.startsWith("rue")) profil.rue = value;
    }
  }
  parentPort.postMessage({
    profile: "excel-factures-v0",
    rows,
    warnings: [],
    societeSheetPresent: !!w.Sheets["Société"],
    profil,
  });
} catch (e) {
  parentPort.postMessage({ error: e.message });
}
