// Reproducible public fixtures: synthetic identities only, no database access.
import { mkdir, writeFile, copyFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import XLSX from "xlsx";
import { jsPDF } from "jspdf";
import { exportBcdTest } from "../apurement/bcd.js";

const root = fileURLToPath(new URL("../../", import.meta.url));
const target = join(root, "public/apurement-demo");
await mkdir(target, { recursive: true });
const headers = [
  "Autorisation",
  "Numero BC",
  "Date BC",
  "Numero Facture",
  "Date facture",
  "MF",
  "Raison sociale",
  "Prix HT",
  "TVA",
  "Objet",
];
const rows = [
  [
    "DEMO-IMP-AUT-2026",
    "000001",
    "01/07/2026",
    "DEMO-IMP-001",
    "15/07/2026",
    "2222222ABC000",
    "FOURNISSEUR ALPHA DEMO",
    "1000.000",
    "190.000",
    "ACHAT FICTIF A",
  ],
  [
    "DEMO-IMP-AUT-2026",
    "000001",
    "01/07/2026",
    "DEMO-IMP-002",
    "16/07/2026",
    "2222222ABC000",
    "FOURNISSEUR ALPHA DEMO",
    "1234.567",
    "234.568",
    "ACHAT FICTIF B",
  ],
  [
    "DEMO-IMP-AUT-2026",
    "000002",
    "01/07/2026",
    "DEMO-IMP-003",
    "17/07/2026",
    "3333333ABC000",
    "FOURNISSEUR BETA DEMO",
    "500.000",
    "95.000",
    "ACHAT FICTIF C",
  ],
];
async function workbook(name, data, type = "xlsx") {
  const w = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    w,
    XLSX.utils.aoa_to_sheet([headers, ...data]),
    "Factures",
  );
  XLSX.utils.book_append_sheet(
    w,
    XLSX.utils.aoa_to_sheet([
      ["Raison sociale", "SOCIETE DEMO APUREMENT"],
      ["MF", "1111111AB000"],
      ["Activité", "RECETTE FICTIVE"],
      ["Ville", "TUNIS"],
      ["Rue", "RUE DE LA RECETTE"],
    ]),
    "Société",
  );
  await writeFile(
    join(target, name),
    XLSX.write(w, { type: "buffer", bookType: type }),
  );
}
await workbook("achats-valides.xlsx", rows);
await workbook("achats-valides.xls", rows, "biff8");
await workbook("achats-mise-a-jour.xlsx", [
  [...rows[0].slice(0, 7), "1100.000", "209.000", "CORRECTION FICTIVE"],
]);
await workbook("achats-exceptions.xlsx", [
  [
    "DEMO-EX-AUT",
    "000003",
    "01/07/2026",
    "DEMO-MOIS-001",
    "07/2026",
    "2222222ABC000",
    "FOURNISSEUR ALPHA DEMO",
    "50.000",
    "9.500",
    "DATE PARTIELLE",
  ],
  [
    "DEMO-EX-AUT",
    "000003",
    "01/07/2026",
    "DEMO-TVA-001",
    "18/07/2026",
    "2222222ABC000",
    "FOURNISSEUR ALPHA DEMO",
    "1000.000",
    "190.001",
    "TVA MANUELLE FICTIVE",
  ],
  [
    "DEMO-EX-AUT",
    "000003",
    "01/07/2026",
    "DEMO-INVALIDE-001",
    "19/07/2026",
    "2222222ABC000",
    "FOURNISSEUR ALPHA DEMO",
    "1000.0001",
    "190.000",
    "PRECISION INVALIDE",
  ],
]);
const lignes = rows.map((r) => ({
  autorisation_numero: r[0],
  bc_numero: r[1],
  date_bc: "2026-07-01",
  numero_facture: r[3],
  date_facture: `2026-07-${r[4].slice(0, 2)}`,
  date_precision: "day",
  matricule_fiscal_normalise: r[5],
  raison_sociale: r[6],
  montant_ht_millimes: r[7].replace(".", ""),
  tva_suspendue_millimes: r[8].replace(".", ""),
  taux_tva_bps: 1900,
  objet: r[9],
}));
const snapshot = {
  annee: 2026,
  trimestre: "T3",
  profil: {
    matriculeFiscal: "1111111AB000",
    raisonSociale: "SOCIETE DEMO APUREMENT",
    activite: "RECETTE FICTIVE",
    ville: "TUNIS",
    rue: "RUE DE LA RECETTE",
    numero: "1",
    codePostal: "1000",
  },
  lignes,
};
const bcd = exportBcdTest(snapshot);
await writeFile(join(target, "BCD_TEST_NON_OFFICIEL_T3_2026.txt"), bcd);
const lines = bcd.toString("ascii").trimEnd().split("\r\n");
const footer = lines.at(-1);
lines[lines.length - 1] =
  footer.slice(0, 183) +
  (BigInt(footer.slice(183)) + 13n).toString().padStart(15, "0");
await writeFile(
  join(target, "BCD_TEST_ECART_013.txt"),
  lines.join("\r\n") + "\r\n",
  "ascii",
);
for (const [name, label] of Object.entries({
  "preuve-autorisation.pdf": "Autorisation DEMO-AUT-2026",
  "preuve-bc.pdf": "Bon de commande 000101",
  "preuve-facture.pdf": "Facture DEMO-FAC-001 / DEMO-FAC-002",
  "decision-arrondi-TEST.pdf":
    "Decision SIMULEE de recette : demi superieur par facture au millime",
  "preuve-depot-TEST.pdf": "Depot SIMULE / DEMO-DEPOT-001",
  "preuve-acceptation-TEST.pdf": "Acceptation SIMULEE",
  "preuve-rejet-TEST.pdf": "Rejet SIMULE - exercice de rectification",
})) {
  const pdf = new jsPDF();
  pdf.setFontSize(16);
  pdf.text("RECETTE FICTIVE - SANS VALEUR FISCALE", 15, 25);
  pdf.setFontSize(11);
  pdf.text(pdf.splitTextToSize(label, 175), 15, 45);
  pdf.text(
    "Donnees synthetiques. Ne jamais utiliser comme preuve reelle.",
    15,
    70,
  );
  await writeFile(join(target, name), Buffer.from(pdf.output("arraybuffer")));
}
await copyFile(
  join(root, "docs/apurement/MANUEL_RECETTE.md"),
  join(target, "MANUEL_RECETTE.md"),
);
console.log(
  "Kit de recette Apurement genere dans public/apurement-demo (sans acces base).",
);
