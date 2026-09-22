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

function nomRacineCabinet(): string {
  return `Comptabilité générale ${new Date().getFullYear()}`;
}

/**
 * Dossier racine UNIQUE du cabinet (societeId=null, parentId=null), partagé
 * par toutes les sociétés — "Comptabilité générale [année]" au sens propre,
 * pas une racine par société : chaque société a son propre sous-dossier
 * dessous (voir trouverOuCreerDossierSociete).
 */
async function trouverOuCreerRacineCabinet(
  noeuds: Noeud[],
  addNoeud: AddNoeud,
): Promise<Noeud> {
  const nom = nomRacineCabinet();
  const existante = noeuds.find(
    (n) =>
      n.societeId === null &&
      n.parentId === null &&
      n.type === "dossier" &&
      n.libelle.trim().toLowerCase() === nom.trim().toLowerCase(),
  );
  if (existante) return existante;
  return addNoeud({
    libelle: nom,
    description: "",
    type: "dossier",
    societeId: null,
    parentId: null,
  });
}

/**
 * Dossier d'une société sous la racine partagée du cabinet — identifié par
 * societeId + parentId (pas par libellé, une société pouvant être renommée).
 * Migre aussi l'ancien format (racine de société encore au niveau
 * supérieur, parentId=null — utilisé avant que "Comptabilité générale
 * [année]" ne devienne une racine commune) en la déplaçant/renommant plutôt
 * que d'en recréer une : ses sous-dossiers (achat/vente/…) la suivent
 * automatiquement, ils ne référencent que son id, jamais son parentId.
 */
async function trouverOuCreerDossierSociete(
  noeuds: Noeud[],
  addNoeud: AddNoeud,
  updateNoeud: UpdateNoeud,
  params: { societeId: string; societeLibelle: string; racineCabinetId: string },
): Promise<Noeud> {
  const sousRacine = noeuds.find(
    (n) =>
      n.societeId === params.societeId &&
      n.parentId === params.racineCabinetId &&
      n.type === "dossier",
  );
  if (sousRacine) return sousRacine;

  const ancienneRacine = noeuds.find(
    (n) => n.societeId === params.societeId && n.parentId === null && n.type === "dossier",
  );
  if (ancienneRacine) {
    await updateNoeud(ancienneRacine.id, {
      libelle: params.societeLibelle,
      parentId: params.racineCabinetId,
    });
    return {
      ...ancienneRacine,
      libelle: params.societeLibelle,
      parentId: params.racineCabinetId,
    };
  }

  return addNoeud({
    libelle: params.societeLibelle,
    description: "",
    type: "dossier",
    societeId: params.societeId,
    parentId: params.racineCabinetId,
  });
}

/**
 * Classe un document (facture d'achat, de vente ou pièce douanière déjà
 * importée dans un mouvement de stock) dans le module Structuration, sous
 * <Comptabilité générale [année]>/<société>/<achat|vente|douane>/<année de
 * la pièce> — créés à la volée si besoin, jamais de dossier dupliqué à
 * chaque classement (voir trouverOuCreerDossier/trouverOuCreerDossierSociete).
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

  const racineCabinet = await trouverOuCreerRacineCabinet(noeuds, addNoeud);
  const noeudsAvecCabinet = noeuds.some((n) => n.id === racineCabinet.id)
    ? noeuds
    : [...noeuds, racineCabinet];

  const racine = await trouverOuCreerDossierSociete(noeudsAvecCabinet, addNoeud, updateNoeud, {
    societeId,
    societeLibelle,
    racineCabinetId: racineCabinet.id,
  });
  const noeudsAvecRacine = noeudsAvecCabinet.some((n) => n.id === racine.id)
    ? noeudsAvecCabinet
    : [...noeudsAvecCabinet, racine];

  const dossierCategorie = await trouverOuCreerDossier(noeudsAvecRacine, addNoeud, {
    societeId,
    parentId: racine.id,
    libelle: categorie,
  });
  const noeudsAvecCategorie = noeudsAvecRacine.some((n) => n.id === dossierCategorie.id)
    ? noeudsAvecRacine
    : [...noeudsAvecRacine, dossierCategorie];
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

/** Dossiers standard du modèle du cabinet — voir la capture de référence
 * (Comptabilité générale [année] > société > ces dossiers). Fixe et non
 * dérivé du "Modèle générique" existant : au-delà de ce socle, tout le
 * reste de l'arborescence reste manuel. */
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
 * Provisionne, pour une société, son dossier sous la racine partagée
 * "Comptabilité générale [année]" + les dossiers standard du cabinet —
 * idempotent (voir trouverOuCreerRacineCabinet / trouverOuCreerDossierSociete
 * / trouverOuCreerDossier), donc rejouable sans jamais dupliquer ce qui
 * existe déjà, et migre au passage une éventuelle ancienne racine de société
 * au premier niveau vers le nouvel emplacement imbriqué. Utilisé pour
 * l'action globale "Instancier pour toutes les sociétés" de Structuration.
 */
export async function provisionnerArborescenceSociete({
  noeuds,
  addNoeud,
  updateNoeud,
  societeId,
  societeLibelle,
}: {
  noeuds: Noeud[];
  addNoeud: AddNoeud;
  updateNoeud: UpdateNoeud;
  societeId: string;
  societeLibelle: string;
}): Promise<number> {
  let pool = noeuds;
  let crees = 0;

  const racineCabinet = await trouverOuCreerRacineCabinet(pool, addNoeud);
  if (!pool.some((n) => n.id === racineCabinet.id)) {
    pool = [...pool, racineCabinet];
    crees++;
  }

  const racine = await trouverOuCreerDossierSociete(pool, addNoeud, updateNoeud, {
    societeId,
    societeLibelle,
    racineCabinetId: racineCabinet.id,
  });
  if (!pool.some((n) => n.id === racine.id)) {
    pool = [...pool, racine];
    crees++;
  }

  for (const libelle of DOSSIERS_STANDARD) {
    const dossier = await trouverOuCreerDossier(pool, addNoeud, {
      societeId,
      parentId: racine.id,
      libelle,
    });
    if (!pool.some((n) => n.id === dossier.id)) {
      pool = [...pool, dossier];
      crees++;
    }
  }

  return crees;
}
