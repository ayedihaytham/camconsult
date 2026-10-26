import { buildTablesPdf, type PdfSheet } from "@/lib/pdfTables";
import { classeurExcel } from "@/lib/pdfToTables";
import { classeurExcelModele } from "@/lib/modeleExcelCabinet";
import { texteDepuisFeuilles } from "@/lib/texteBrut";

/** Formats dans lesquels un fichier converti se télécharge, quel que soit le sens de la conversion (Excel vers PDF ou PDF vers Excel). */
export type FormatSortie = "pdf" | "xlsx" | "txt";

export const FORMATS_SORTIE: { valeur: FormatSortie; nom: string; extension: string; mime: string }[] = [
  { valeur: "pdf", nom: "PDF", extension: ".pdf", mime: "application/pdf" },
  { valeur: "xlsx", nom: "Excel", extension: ".xlsx", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  { valeur: "txt", nom: "Texte (.txt)", extension: ".txt", mime: "text/plain;charset=utf-8" },
];

export interface IdentitePdf {
  logo?: string | null;
  cabinet?: Parameters<typeof buildTablesPdf>[0]["cabinet"];
}

/** Nom du fichier téléchargé : le nom d'origine sans son extension, puis l'extension du format choisi. */
export function nomSortie(base: string, format: FormatSortie): string {
  const f = FORMATS_SORTIE.find((x) => x.valeur === format);
  return `${base}${f?.extension ?? ""}`;
}

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;

/**
 * Fichier converti dans le format demandé, à partir des tableaux (ou feuilles) retenus. Même contenu dans les trois formats :
 * un PDF mis en page aux couleurs du cabinet, un classeur Excel (une feuille par tableau), ou un texte à colonnes séparées par une tabulation.
 */
export async function fichierConverti(
  format: FormatSortie,
  feuilles: PdfSheet[],
  base: string,
  options: { identite?: IdentitePdf; unite?: "tableau" | "feuille"; modele?: boolean } = {},
): Promise<{ blob: Blob; nom: string }> {
  const nom = nomSortie(base, format);
  const mime = FORMATS_SORTIE.find((f) => f.valeur === format)!.mime;
  if (feuilles.length === 0) throw new Error("Rien à convertir");
  if (format === "xlsx") {
    // Par défaut : classeur aux couleurs du cabinet (comme les tableaux de Collecte) ; `modele: false` : classeur simple, données dès A1.
    const octets = options.modele === false
      ? await classeurExcel(feuilles)
      : await classeurExcelModele(feuilles, { titre: base, cabinet: options.identite?.cabinet?.nom });
    return { blob: new Blob([octets], { type: mime }), nom };
  }
  if (format === "txt") return { blob: new Blob([texteDepuisFeuilles(feuilles)], { type: mime }), nom };
  const doc = await buildTablesPdf({
    title: base,
    subtitle: `${pluriel(feuilles.length, options.unite ?? "tableau")} · converti le ${new Date().toLocaleDateString("fr-FR")}`,
    enchainer: true,
    sheets: feuilles,
    fileName: nom,
    plain: true,
    mention: "Document converti",
    ...(options.identite ?? {}),
  });
  return { blob: doc.output("blob"), nom };
}
