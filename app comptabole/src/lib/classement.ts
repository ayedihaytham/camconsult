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
type UpdateNoeud = (id: string, patch: Partial<Noeud>) => Promise<void>;

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

/** Même valeur que RACINE_SOCIETE_DESCRIPTION côté serveur
 * (server/migrateStructuration.js) : repère le dossier racine d'une société
 * même si elle est renommée. */
export const RACINE_SOCIETE_DESCRIPTION = "Dossier racine de la société";

export function nomComptabiliteGenerale(annee?: number | string): string {
  return `Comptabilité générale ${annee ?? new Date().getFullYear()}`;
}

/**
 * Dossier racine d'une société (societeId = la société, parentId = null) —
 * le premier niveau de sa Structuration :
 *   <société> › Comptabilité générale [année] › achat, vente, banque…
 * Retrouvé par son repère (description), sinon par le nom de la société,
 * avant d'en créer un : jamais de doublon, même pour un dossier créé à la
 * main au nom de la société (il reçoit alors le repère).
 */
async function trouverOuCreerRacineSociete(
  noeuds: Noeud[],
  addNoeud: AddNoeud,
  updateNoeud: UpdateNoeud,
  params: { societeId: string; societeLibelle: string },
): Promise<Noeud> {
  const candidates = noeuds.filter(
    (n) => n.societeId === params.societeId && n.parentId === null && n.type === "dossier",
  );
  const parRepere = candidates.find((n) => n.description === RACINE_SOCIETE_DESCRIPTION);
  if (parRepere) return parRepere;
  const parNom = candidates.find(
    (n) => n.libelle.trim().toLowerCase() === params.societeLibelle.trim().toLowerCase(),
  );
  if (parNom) {
    await updateNoeud(parNom.id, { description: RACINE_SOCIETE_DESCRIPTION });
    return { ...parNom, description: RACINE_SOCIETE_DESCRIPTION };
  }
  return addNoeud({
    libelle: params.societeLibelle,
    description: RACINE_SOCIETE_DESCRIPTION,
    type: "dossier",
    societeId: params.societeId,
    parentId: null,
  });
}

/** <société> › Comptabilité générale [année] — créés à la volée si besoin. */
async function trouverOuCreerComptaAnnee(
  noeuds: Noeud[],
  addNoeud: AddNoeud,
  updateNoeud: UpdateNoeud,
  params: { societeId: string; societeLibelle: string; annee?: number | string },
): Promise<{ dossier: Noeud; pool: Noeud[]; crees: number }> {
  let pool = noeuds;
  let crees = 0;
  const racine = await trouverOuCreerRacineSociete(pool, addNoeud, updateNoeud, params);
  if (!pool.some((n) => n.id === racine.id)) {
    pool = [...pool, racine];
    crees++;
  } else {
    pool = pool.map((n) => (n.id === racine.id ? racine : n));
  }
  const dossier = await trouverOuCreerDossier(pool, addNoeud, {
    societeId: params.societeId,
    parentId: racine.id,
    libelle: nomComptabiliteGenerale(params.annee),
  });
  if (!pool.some((n) => n.id === dossier.id)) {
    pool = [...pool, dossier];
    crees++;
  }
  return { dossier, pool, crees };
}

/**
 * Classe un document (facture d'achat, de vente ou pièce douanière déjà
 * importée dans un mouvement de stock) dans le module Structuration, sous
 * <société>/Comptabilité générale <année de la pièce>/<achat|vente|douane> —
 * créés à la volée si besoin, jamais de dossier dupliqué à chaque classement.
 * L'année de la pièce vient directement de la chaîne ISO de la date (pas de
 * Date() + getFullYear(), qui peut décaler d'un jour selon le fuseau — voir
 * la même précaution ailleurs dans l'appli pour les dates de balance).
 */
export async function classerDansStructuration({
  noeuds,
  addNoeud,
  updateNoeud,
  societeId,
  societeLibelle,
  categorie,
  date,
  nomBase,
  dataUrl,
}: {
  noeuds: Noeud[];
  addNoeud: AddNoeud;
  updateNoeud: UpdateNoeud;
  societeId: string;
  societeLibelle: string;
  categorie: "achat" | "vente" | "douane";
  date: string | null;
  nomBase: string;
  dataUrl: string;
}): Promise<{ noeud: Noeud; dejaClasse: boolean }> {
  const annee = date && date.length >= 4 ? date.slice(0, 4) : String(new Date().getFullYear());

  const { dossier: comptaAnnee, pool } = await trouverOuCreerComptaAnnee(noeuds, addNoeud, updateNoeud, {
    societeId,
    societeLibelle,
    annee,
  });
  const dossierCategorie = await trouverOuCreerDossier(pool, addNoeud, {
    societeId,
    parentId: comptaAnnee.id,
    libelle: categorie,
  });

  const { format, taille } = infosDataUrl(dataUrl);
  const libelle = format ? `${nomBase}.${format}` : nomBase;

  const dejaExistant = noeuds.find(
    (n) =>
      n.societeId === societeId &&
      n.parentId === dossierCategorie.id &&
      n.type === "fichier" &&
      n.libelle.trim().toLowerCase() === libelle.trim().toLowerCase(),
  );
  if (dejaExistant) return { noeud: dejaExistant, dejaClasse: true };

  const fichier = await addNoeud({
    libelle,
    description: "",
    type: "fichier",
    societeId,
    parentId: dossierCategorie.id,
    format,
    taille,
    dataUrl,
  });
  return { noeud: fichier, dejaClasse: false };
}

/** Dossiers standard du modèle du cabinet (société > Comptabilité générale
 * [année] > ces dossiers). Fixe et non dérivé du "Modèle générique" existant :
 * au-delà de ce socle, tout le reste de l'arborescence reste manuel. */
const DOSSIERS_STANDARD = [
  "achat",
  "vente",
  "banque",
  "caisse",
  "CNSS",
  "Divers",
  "DMI",
  "juridique",
];

/**
 * Provisionne, pour une société : son dossier racine, son dossier
 * « Comptabilité générale [année] » et les dossiers standard du cabinet
 * dedans — idempotent, donc rejouable sans jamais dupliquer ce qui existe
 * déjà. `annee` cible une année différente de l'année en cours (rattrapage
 * d'une année passée ou préparation de la suivante : un dossier par année,
 * côte à côte sous la société). Utilisé pour l'action globale « Instancier
 * pour toutes les sociétés » de Structuration.
 */
export async function provisionnerArborescenceSociete({
  noeuds,
  addNoeud,
  updateNoeud,
  societeId,
  societeLibelle,
  annee,
}: {
  noeuds: Noeud[];
  addNoeud: AddNoeud;
  updateNoeud: UpdateNoeud;
  societeId: string;
  societeLibelle: string;
  annee?: number;
}): Promise<number> {
  const debut = await trouverOuCreerComptaAnnee(noeuds, addNoeud, updateNoeud, {
    societeId,
    societeLibelle,
    annee,
  });
  let pool = debut.pool;
  let crees = debut.crees;

  for (const libelle of DOSSIERS_STANDARD) {
    const dossier = await trouverOuCreerDossier(pool, addNoeud, {
      societeId,
      parentId: debut.dossier.id,
      libelle,
    });
    if (!pool.some((n) => n.id === dossier.id)) {
      pool = [...pool, dossier];
      crees++;
    }
  }

  return crees;
}
