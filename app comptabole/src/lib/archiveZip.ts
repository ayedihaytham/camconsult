import JSZip from "jszip";

/** Un fichier trouvé dans une archive .zip : son dossier (liste de noms, de la racine de l'archive vers le fichier), son nom et son contenu. */
export interface EntreeZip {
  dossiers: string[];
  nom: string;
  taille: number;
  blob: Blob;
}

/** Garde-fous contre les archives démesurées (ou piégées) : au-delà, la lecture est refusée. */
export const MAX_FICHIERS_ZIP = 500;
export const MAX_OCTETS_ZIP = 200 * 1024 * 1024;

export const estZip = (nom: string) => /\.zip$/i.test(nom);

/** Nom du dossier créé pour une archive : son nom sans « .zip ». */
export const nomDossierZip = (nom: string) => nom.replace(/\.zip$/i, "").trim() || "Archive";

const IGNORES = new Set([".ds_store", "thumbs.db", "desktop.ini"]);

/**
 * Lit les fichiers d'une archive .zip sans rien envoyer. Les noms de dossiers sont gardés, les chemins qui sortent de l'archive (« .. ») sont écartés,
 * ainsi que les fichiers système (__MACOSX, .DS_Store, Thumbs.db). Lève une erreur claire si l'archive est illisible, protégée ou trop grosse.
 */
export async function lireZip(fichier: Blob): Promise<EntreeZip[]> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(fichier);
  } catch {
    throw new Error("Archive .zip illisible ou protégée par un mot de passe.");
  }
  const retenus: { chemin: string[]; objet: JSZip.JSZipObject }[] = [];
  zip.forEach((chemin, objet) => {
    if (objet.dir) return;
    const parties = chemin.split(/[\\/]+/).filter(Boolean);
    if (parties.length === 0 || parties.some((p) => p === ".." || p === ".")) return;
    if (parties[0] === "__MACOSX" || IGNORES.has(parties[parties.length - 1].toLowerCase())) return;
    retenus.push({ chemin: parties, objet });
  });
  if (retenus.length > MAX_FICHIERS_ZIP) throw new Error(`Archive trop volumineuse : plus de ${MAX_FICHIERS_ZIP} fichiers.`);
  const entrees: EntreeZip[] = [];
  let total = 0;
  for (const { chemin, objet } of retenus) {
    const blob = await objet.async("blob");
    total += blob.size;
    if (total > MAX_OCTETS_ZIP) throw new Error("Archive trop volumineuse : plus de 200 Mo une fois décompressée.");
    entrees.push({ dossiers: chemin.slice(0, -1), nom: chemin[chemin.length - 1], taille: blob.size, blob });
  }
  return entrees;
}
