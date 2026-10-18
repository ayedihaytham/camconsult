import { lireFichierPdf, nombreDeCaracteres, reconstruireTableau } from "@/lib/pdfToTables";
import { lireGrandLivre, type GrandLivre } from "./grandLivre";

/** Lit un grand-livre (PDF Sage 100) dans le navigateur ; le fichier n'est jamais envoyé au serveur. Lève une erreur au message lisible. */
export async function lireGrandLivrePdf(file: File): Promise<GrandLivre> {
  if (!/\.pdf$/i.test(file.name)) throw new Error("Choisissez un PDF : le grand-livre (Sage 100) exporté en PDF.");
  const pages = await lireFichierPdf(file);
  if (nombreDeCaracteres(pages) === 0) throw new Error("PDF scanné (image) : il ne contient pas de texte à lire.");
  const lu = lireGrandLivre(pages.map((p) => reconstruireTableau(p, { nombres: false }) as string[][]));
  if (!lu) throw new Error("Document non reconnu. Seul le grand-livre au format PDF de Sage 100 est lu (colonnes Date, Journal, N° pièce, Libellé, Débit, Crédit).");
  return lu;
}
