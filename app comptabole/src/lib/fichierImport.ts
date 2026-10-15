/**
 * Contrôle commun des classeurs importés (balances, biens, honoraires, souche de chèques, suivi devise, conversions, relevés
 * bancaires, états fournisseurs). Il s'applique AVANT toute lecture par la bibliothèque `xlsx`.
 *
 * Portée honnête : ce contrôle réduit la consommation accidentelle de ressources et refuse les fichiers manifestement faux
 * (extension qui ne correspond pas au contenu, fichier vide ou énorme). Il ne rend PAS sûre la lecture d'un classeur piégé de taille
 * raisonnable : les avis de `xlsx` 0.18.5 (pollution de prototype, ReDoS) restent ouverts tant que la bibliothèque n'est pas remplacée.
 * Il s'exécute dans le navigateur et ne constitue donc une frontière de sécurité pour aucun serveur.
 */

import { verifierZip } from "./zipLimites";

/** Taille maximale PROVISOIRE d'un classeur, en octets. Valeur conservatrice à confirmer par le propriétaire : un classeur de balance
 * ou de grand livre réel pèse en général bien moins ; la limite reste facile à modifier ici. */
export const TAILLE_MAX_CLASSEUR_OCTETS = 10 * 1024 * 1024;

export type FormatClasseur = "xlsx" | "xls" | "csv";
export const FORMATS_PAR_DEFAUT: readonly FormatClasseur[] = ["xlsx", "xls", "csv"];

/** Types MIME fournis par les navigateurs pour ces formats. Un type absent (chaîne vide) ou générique est toléré : le navigateur ne le
 * renseigne pas de façon fiable, d'où le contrôle du contenu en plus. */
const MIME_ACCEPTES = new Set([
  "",
  "application/octet-stream",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/excel",
  "application/x-excel",
  "application/x-msexcel",
  "application/zip",
  "application/x-zip-compressed",
  "text/csv",
  "application/csv",
  "text/plain",
]);

const TAILLE_ECHANTILLON = 4096;

/** Erreur dont le message, en français, peut être affiché tel quel à l'utilisateur. */
export class ClasseurRefuse extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClasseurRefuse";
  }
}

/** Message à afficher : celui du refus s'il s'agit d'un refus, sinon le message par défaut de l'écran. */
export function messageImport(err: unknown, parDefaut: string): string {
  return err instanceof ClasseurRefuse ? err.message : parDefaut;
}

const mo = (octets: number) => `${Math.round((octets / (1024 * 1024)) * 10) / 10}`.replace(".", ",");

async function lireDebut(file: Blob): Promise<Uint8Array> {
  const morceau = file.slice(0, TAILLE_ECHANTILLON);
  if (typeof morceau.arrayBuffer === "function") return new Uint8Array(await morceau.arrayBuffer());
  return new Promise((resolve, reject) => {
    const lecteur = new FileReader();
    lecteur.onload = () => resolve(new Uint8Array(lecteur.result as ArrayBuffer));
    lecteur.onerror = () => reject(lecteur.error);
    lecteur.readAsArrayBuffer(morceau);
  });
}

const commencePar = (octets: Uint8Array, signature: number[]) => signature.every((v, i) => octets[i] === v);
const estZip = (o: Uint8Array) => commencePar(o, [0x50, 0x4b, 0x03, 0x04]);
const estOle = (o: Uint8Array) => commencePar(o, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
const estUtf16 = (o: Uint8Array) => commencePar(o, [0xff, 0xfe]) || commencePar(o, [0xfe, 0xff]);
const contientNul = (o: Uint8Array) => o.includes(0);

function extensionDe(nom: string): string {
  const point = nom.lastIndexOf(".");
  return point < 0 ? "" : nom.slice(point + 1).toLowerCase();
}

/** Refuse (en levant `ClasseurRefuse`) tout fichier qui ne ressemble pas à un classeur des formats demandés. N'analyse pas le classeur. */
export async function verifierClasseur(
  file: File,
  options: { formats?: readonly FormatClasseur[]; tailleMax?: number } = {},
): Promise<void> {
  const formats = options.formats ?? FORMATS_PAR_DEFAUT;
  const tailleMax = options.tailleMax ?? TAILLE_MAX_CLASSEUR_OCTETS;
  const libelle = formats.map((f) => `.${f}`).join(", ");

  const ext = extensionDe(file.name);
  if (!(formats as readonly string[]).includes(ext)) throw new ClasseurRefuse(`Format non pris en charge — fichiers acceptés : ${libelle}.`);
  if (file.size === 0) throw new ClasseurRefuse("Le fichier est vide.");
  if (file.size > tailleMax) throw new ClasseurRefuse(`Fichier trop volumineux (${mo(file.size)} Mo) — limite : ${mo(tailleMax)} Mo.`);
  if (!MIME_ACCEPTES.has((file.type ?? "").toLowerCase())) throw new ClasseurRefuse(`Type de fichier non pris en charge — fichiers acceptés : ${libelle}.`);

  const debut = await lireDebut(file);
  const incoherent = new ClasseurRefuse(`Le contenu du fichier ne correspond pas à son extension (.${ext}).`);
  if (ext === "xlsx") {
    if (!estZip(debut)) throw incoherent;
  } else if (ext === "xls") {
    // Ancien format binaire, ou export texte/XML/HTML nommé .xls (fréquent) : tout sauf un fichier binaire inconnu ou un classeur zip.
    if (!estOle(debut) && !estUtf16(debut) && (contientNul(debut) || estZip(debut))) throw incoherent;
  } else if (ext === "csv") {
    // Un « .csv » qui est en réalité un classeur binaire serait lu comme tel par la bibliothèque : refusé.
    if (estZip(debut) || estOle(debut) || (!estUtf16(debut) && contientNul(debut))) throw incoherent;
  }
}

/** Vérifie le fichier puis renvoie son contenu : point d'entrée unique avant `XLSX.read`. */
export async function lireTamponClasseur(file: File, options?: { formats?: readonly FormatClasseur[]; tailleMax?: number }): Promise<ArrayBuffer> {
  await verifierClasseur(file, options);
  const tampon = await file.arrayBuffer();
  // Un .xlsx est un zip : on refuse un contenu décompressé excessif avant que la bibliothèque ne l'analyse (bombe de décompression).
  if (file.name.toLowerCase().endsWith(".xlsx")) verifierZip(tampon);
  return tampon;
}
