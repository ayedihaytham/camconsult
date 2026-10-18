import { mkdir, copyFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";
const destination = new URL("../../public/apurement-aide/", import.meta.url);
await mkdir(destination, { recursive: true });
const book = XLSX.utils.book_new();
const sheet = XLSX.utils.aoa_to_sheet([
  [
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
  ],
]);
sheet["!cols"] = [24, 20, 16, 24, 16, 20, 35, 20, 20, 35].map((wch) => ({
  wch,
}));
XLSX.utils.book_append_sheet(book, sheet, "Factures");
XLSX.utils.book_append_sheet(
  book,
  XLSX.utils.aoa_to_sheet([
    [
      "Remplir une ligne par facture dans la feuille Factures, sans changer les dix colonnes.",
    ],
    ["Recopier les références comme texte pour conserver les zéros initiaux."],
    [
      "Dates : JJ/MM/AAAA. Montants TND : au plus trois décimales, sans séparateur de milliers.",
    ],
    ["Le taux est confirmé dans l’application lors de l’import."],
    [
      "Si le bon de commande ou l’autorisation est inconnu, utiliser la saisie manuelle pour enregistrer une facture à compléter.",
    ],
  ]),
  "Instructions",
);
await writeFile(
  new URL("modele-achats.xlsx", destination),
  XLSX.write(book, { type: "buffer", bookType: "xlsx" }),
);
await copyFile(
  fileURLToPath(
    new URL("../../docs/apurement/GUIDE_UTILISATION.md", import.meta.url),
  ),
  fileURLToPath(new URL("GUIDE_UTILISATION.md", destination)),
);
console.log(
  "Modele vierge et guide generes, sans donnees fictives ni acces base.",
);
