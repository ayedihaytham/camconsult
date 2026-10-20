import { createCipheriv, createDecipheriv, createHash, createHmac, hkdfSync, randomBytes } from "node:crypto";
import { egalConstant } from "./loginGuard.js";

/**
 * Double authentification par application (TOTP, RFC 6238 : HMAC-SHA1, pas de 30 s, 6 chiffres) — compatible Google Authenticator,
 * Microsoft Authenticator, Authy, 1Password… Sans dépendance externe : l'algorithme tient en quelques lignes et se vérifie avec les
 * vecteurs de test de la RFC (voir totp.test.js).
 */

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const PERIODE_S = 30;

export function base32Encode(octets) {
  let bits = 0;
  let valeur = 0;
  let sortie = "";
  for (const o of octets) {
    valeur = (valeur << 8) | o;
    bits += 8;
    while (bits >= 5) {
      sortie += ALPHABET[(valeur >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) sortie += ALPHABET[(valeur << (5 - bits)) & 31];
  return sortie;
}

export function base32Decode(texte) {
  const propre = String(texte).toUpperCase().replace(/\s/g, "").replace(/=+$/, "");
  let bits = 0;
  let valeur = 0;
  const sortie = [];
  for (const c of propre) {
    const i = ALPHABET.indexOf(c);
    if (i < 0) throw new Error("Secret TOTP invalide");
    valeur = (valeur << 5) | i;
    bits += 5;
    if (bits >= 8) {
      sortie.push((valeur >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(sortie);
}

/** Nouveau secret : 160 bits aléatoires, en base32 (ce que saisit ou scanne l'application). */
export const genererSecret = () => base32Encode(randomBytes(20));

/** Code à 6 chiffres du pas donné. */
export function codeDuPas(secretBase32, pas, chiffres = 6) {
  const compteur = Buffer.alloc(8);
  compteur.writeBigUInt64BE(BigInt(pas));
  const h = createHmac("sha1", base32Decode(secretBase32)).update(compteur).digest();
  const o = h[h.length - 1] & 0x0f;
  const v = (((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 10 ** chiffres;
  return String(v).padStart(chiffres, "0");
}

export const pasCourant = (maintenantMs = Date.now()) => Math.floor(maintenantMs / 1000 / PERIODE_S);

/**
 * Vérifie un code saisi : le pas courant et ses deux voisins sont acceptés (décalage d'horloge d'un téléphone). Renvoie le pas trouvé,
 * ou null. `dernierPas` est le dernier pas déjà utilisé : un code ne sert jamais deux fois (un pas égal ou antérieur est refusé).
 */
export function verifierCode(secretBase32, saisi, { maintenant = Date.now(), dernierPas = null } = {}) {
  const texte = String(saisi ?? "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(texte)) return null;
  const courant = pasCourant(maintenant);
  let trouve = null;
  for (const decalage of [0, -1, 1]) {
    const pas = courant + decalage;
    // tous les candidats sont comparés (temps constant), le premier valide l'emporte
    const bon = egalConstant(codeDuPas(secretBase32, pas), texte);
    if (bon && trouve === null && (dernierPas === null || pas > Number(dernierPas))) trouve = pas;
  }
  return trouve;
}

/** Adresse « otpauth » que l'application lit dans le QR code. */
export function uriOtpauth({ secret, compte, emetteur = "Cabinet" }) {
  const etiquette = encodeURIComponent(`${emetteur}:${compte}`);
  return `otpauth://totp/${etiquette}?secret=${secret}&issuer=${encodeURIComponent(emetteur)}&algorithm=SHA1&digits=6&period=${PERIODE_S}`;
}

// ── Secret stocké chiffré (AES-256-GCM) ────────────────────────────────────────────────────────────

/** Clé dérivée de AUTH_2FA_SECRET, à défaut de JWT_SECRET (toujours défini en production). Changer ce secret rend les secrets TOTP
 * illisibles : l'administrateur doit alors réinitialiser sa 2FA par le script (server/scripts/reset-2fa-admin.js). */
function cle() {
  const maitre = process.env.AUTH_2FA_SECRET || process.env.JWT_SECRET || "dev-secret-change-me";
  return Buffer.from(hkdfSync("sha256", maitre, "camconsult-auth", "totp-secret", 32));
}

export function chiffrerSecret(texte) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", cle(), iv);
  const chiffre = Buffer.concat([c.update(String(texte), "utf8"), c.final()]);
  return `v1:${iv.toString("base64")}:${c.getAuthTag().toString("base64")}:${chiffre.toString("base64")}`;
}

export function dechiffrerSecret(valeur) {
  const [version, iv, tag, chiffre] = String(valeur ?? "").split(":");
  if (version !== "v1" || !iv || !tag || !chiffre) throw new Error("Secret TOTP illisible");
  const d = createDecipheriv("aes-256-gcm", cle(), Buffer.from(iv, "base64"));
  d.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(chiffre, "base64")), d.final()]).toString("utf8");
}

// ── Codes de secours (à usage unique) ──────────────────────────────────────────────────────────────

const normaliserSecours = (code) => String(code ?? "").toUpperCase().replace(/[^A-Z2-7]/g, "");
export const empreinteSecours = (code) => createHash("sha256").update(normaliserSecours(code)).digest("hex");

/** Dix codes de secours « XXXXX-XXXXX » (50 bits chacun) : en clair une seule fois, seule leur empreinte est conservée. */
export function genererCodesSecours(nombre = 10) {
  return Array.from({ length: nombre }, () => {
    const brut = base32Encode(randomBytes(7)).slice(0, 10);
    return `${brut.slice(0, 5)}-${brut.slice(5)}`;
  });
}

/** Ce qui ressemble à un code de secours (10 caractères base32, tiret facultatif) et non à un code à 6 chiffres. */
export const ressembleAUnCodeDeSecours = (saisi) => normaliserSecours(saisi).length === 10;
