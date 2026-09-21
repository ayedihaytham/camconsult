import { formatFileSize } from "./file";
import type { Noeud } from "@/types";

/** Extension déduite du type MIME d'une data URL — un document importé
 * (facture achat/vente) n'a jamais de nom de fichier d'origine à extraire
 * l'extension dessus, contrairement à un import manuel (voir file.ts). */
const EXT_BY_MIME: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
};

function infosDataUrl(dataUrl: string): { format: string; taille: string } {
  const m = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl);
  const mime = m?.[1] ?? "";
  const base64 = m?.[2] ?? "";
  const bytes = Math.round((base64.length * 3) / 4);
  return { format: EXT_BY_MIME[mime] ?? "", taille: formatFileSize(bytes) };
}

type AddNoeud = (data: Omit<Noeud, "id" | "majLe" | "creeLe">) => Promise<Noeud>;

/** Cherche un dossier existant (même société, même parent, même libellé —
 * insensible à la casse) avant d'en créer un nouveau : jamais de dossier
 * "achat" en double si un import précédent l'a déjà créé. */
async function trouverOuCreerDossier(
  noeuds: Noeud[],
  addNoeud: AddNoeud,
  params: { societeId: string; parentId: string | null; libelle: string },
): Promise<Noeud> {
  const existant = noeuds.find(
    (n) =>
      n.societeId === params.societeId &&
      n.parentId === params.parentId &&
      n.type === "dossier" &&
      n.libelle.trim().toLowerCase() === params.libelle.trim().toLowerCase(),
  );
  if (existant) return existant;
  return addNoeud({
    libelle: params.libelle,
    description: "",
    type: "dossier",
    societeId: params.societeId,
    parentId: params.parentId,
  });
}

/**
 * Classe un document (facture d'achat ou de vente déjà importée dans un
 * mouvement de stock) dans le module Structuration de la société, sous
 * <achat|vente>/<année de la pièce> — créés à la volée si besoin, jamais de
 * dossier dupliqué à chaque classement (voir `trouverOuCreerDossier`).
 * L'année vient directement de la chaîne ISO de la date (pas de Date() +
 * getFullYear(), qui peut décaler d'un jour selon le fuseau — voir la même
 * précaution ailleurs dans l'appli pour les dates de balance).
 */
export async function classerDansStructuration({
  noeuds,
  addNoeud,
  societeId,
  categorie,
  date,
  nomBase,
  dataUrl,
}: {
  noeuds: Noeud[];
  addNoeud: AddNoeud;
  societeId: string;
  categorie: "achat" | "vente";
  date: string | null;
  nomBase: string;
  dataUrl: string;
}): Promise<{ noeud: Noeud; dejaClasse: boolean }> {
  const annee = date && date.length >= 4 ? date.slice(0, 4) : String(new Date().getFullYear());

  const dossierCategorie = await trouverOuCreerDossier(noeuds, addNoeud, {
    societeId,
    parentId: null,
    libelle: categorie,
  });
  const noeudsAvecCategorie = noeuds.some((n) => n.id === dossierCategorie.id)
    ? noeuds
    : [...noeuds, dossierCategorie];
  const dossierAnnee = await trouverOuCreerDossier(noeudsAvecCategorie, addNoeud, {
    societeId,
    parentId: dossierCategorie.id,
    libelle: annee,
  });

  const { format, taille } = infosDataUrl(dataUrl);
  const libelle = format ? `${nomBase}.${format}` : nomBase;

  const dejaExistant = noeuds.find(
    (n) =>
      n.societeId === societeId &&
      n.parentId === dossierAnnee.id &&
      n.type === "fichier" &&
      n.libelle.trim().toLowerCase() === libelle.trim().toLowerCase(),
  );
  if (dejaExistant) return { noeud: dejaExistant, dejaClasse: true };

  const fichier = await addNoeud({
    libelle,
    description: "",
    type: "fichier",
    societeId,
    parentId: dossierAnnee.id,
    format,
    taille,
    dataUrl,
  });
  return { noeud: fichier, dejaClasse: false };
}
