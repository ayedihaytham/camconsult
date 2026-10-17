import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { ErreurSignature } from "./erreur.js";

/**
 * Coffre du certificat de signature : le fichier .p12/.pfx n'est JAMAIS stocké en clair en base.
 * AES-256-GCM (chiffrement authentifié), clé dérivée par HKDF-SHA256 du secret serveur SIGNATURE_CLE_SECRET, IV aléatoire par chiffrement.
 * Enveloppe : [1 octet de version][12 octets IV][16 octets d'authentification][données chiffrées].
 * Le mot de passe du certificat n'entre jamais ici et n'est jamais enregistré.
 */

export const LONGUEUR_MIN_SECRET = 32;
const VERSION = 1;
const IV = 12;
const TAG = 16;
const CONTEXTE = Buffer.from("camconsult:signature:p12:v1");

/** Assez long et pas répétitif (même règle que le contrôle de configuration). */
const secretValide = (s) => typeof s === "string" && s.length >= LONGUEUR_MIN_SECRET && new Set(s).size >= 10;

export function secretConfigure(env = process.env) {
  const s = env.SIGNATURE_CLE_SECRET ?? "";
  return secretValide(s) ? s : null;
}

function cle(secret) {
  if (!secretValide(secret))
    throw new ErreurSignature("NON_CONFIGUREE", `La signature électronique n'est pas activée : SIGNATURE_CLE_SECRET est absent ou trop court (${LONGUEUR_MIN_SECRET} caractères au moins).`);
  return Buffer.from(hkdfSync("sha256", Buffer.from(secret, "utf8"), Buffer.from("camconsult-signature-sel-v1"), Buffer.from("p12-aes-256-gcm"), 32));
}

export function chiffrer(donnees, secret) {
  const iv = randomBytes(IV);
  const c = createCipheriv("aes-256-gcm", cle(secret), iv);
  c.setAAD(CONTEXTE);
  const chiffre = Buffer.concat([c.update(donnees), c.final()]);
  return Buffer.concat([Buffer.from([VERSION]), iv, c.getAuthTag(), chiffre]);
}

export function dechiffrer(enveloppe, secret) {
  const k = cle(secret);
  const e = Buffer.from(enveloppe);
  if (e.length < 1 + IV + TAG || e[0] !== VERSION) throw new ErreurSignature("COFFRE_ILLISIBLE", "Le certificat enregistré est illisible : rechargez-le.");
  try {
    const d = createDecipheriv("aes-256-gcm", k, e.subarray(1, 1 + IV));
    d.setAAD(CONTEXTE);
    d.setAuthTag(e.subarray(1 + IV, 1 + IV + TAG));
    return Buffer.concat([d.update(e.subarray(1 + IV + TAG)), d.final()]);
  } catch {
    throw new ErreurSignature("COFFRE_CLE_CHANGEE", "Impossible de déchiffrer le certificat : la clé du serveur (SIGNATURE_CLE_SECRET) a changé ou les données sont altérées. Rechargez le certificat.");
  }
}
