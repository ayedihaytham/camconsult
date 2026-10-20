import bcrypt from "bcryptjs";
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { query } from "./db.js";

const scrypt = promisify(scryptCb);

/**
 * Mots de passe des employés : scrypt (fonction de dérivation lente, à mémoire dure, fournie par Node : aucune dépendance native).
 * Format : scrypt$N$r$p$sel$hash (sel et hash en base64). Les paramètres sont dans la valeur stockée : on peut les relever plus tard
 * (`besoinDeRehash`) sans casser les comptes existants.
 */
export const PARAMS = { N: 2 ** 16, r: 8, p: 2, longueur: 64 };
const MAXMEM = 256 * 1024 * 1024;

export async function hashPassword(motDePasse, params = PARAMS) {
  const sel = randomBytes(16);
  const hash = await scrypt(String(motDePasse), sel, params.longueur, { N: params.N, r: params.r, p: params.p, maxmem: MAXMEM });
  return `scrypt$${params.N}$${params.r}$${params.p}$${sel.toString("base64")}$${hash.toString("base64")}`;
}

export const estHash = (valeur) => typeof valeur === "string" && valeur.startsWith("scrypt$");

function lire(stocke) {
  const [, N, r, p, sel, hash] = String(stocke).split("$");
  const params = { N: Number(N), r: Number(r), p: Number(p) };
  if (!params.N || !params.r || !params.p || !sel || !hash) return null;
  return { params, sel: Buffer.from(sel, "base64"), hash: Buffer.from(hash, "base64") };
}

export async function verifyPassword(motDePasse, stocke) {
  const lu = estHash(stocke) ? lire(stocke) : null;
  if (!lu) return false;
  const calcule = await scrypt(String(motDePasse), lu.sel, lu.hash.length, { ...lu.params, maxmem: MAXMEM });
  return calcule.length === lu.hash.length && timingSafeEqual(calcule, lu.hash);
}

/** Vrai si le hash stocké utilise des paramètres plus faibles que les paramètres actuels. */
export function besoinDeRehash(stocke) {
  const lu = estHash(stocke) ? lire(stocke) : null;
  return !lu || lu.params.N < PARAMS.N || lu.params.r < PARAMS.r || lu.params.p < PARAMS.p;
}

let fauxHash = null;
/** Travail équivalent à une vérification réelle pour un compte inconnu ou inactif : la durée de réponse ne révèle pas si l'identifiant existe. */
export async function verificationFactice(motDePasse) {
  fauxHash ??= await hashPassword("mot-de-passe-factice");
  await verifyPassword(motDePasse, fauxHash);
}

// ── Jetons d'activation et de réinitialisation ──────────────────────────────
// Le lien contient un jeton aléatoire de 256 bits ; seule son empreinte SHA-256 est conservée en base. Un jeton ne sert qu'une fois
// et expire. Émettre un nouveau jeton invalide les précédents du même compte.

export const DUREES_JETON = { activation: 72 * 3600_000, reset: 24 * 3600_000 };

const empreinte = (jeton) => createHash("sha256").update(String(jeton)).digest("hex");

export async function creerJeton(employeId, but, par = "") {
  const duree = DUREES_JETON[but];
  if (!duree) throw new Error("But de jeton inconnu");
  const jeton = randomBytes(32).toString("base64url");
  await query("update password_tokens set used_at = now() where employe_id = $1 and used_at is null", [employeId]);
  await query(
    "insert into password_tokens (employe_id, token_hash, but, expires_at, cree_par) values ($1,$2,$3, now() + ($4 || ' milliseconds')::interval, $5)",
    [employeId, empreinte(jeton), but, String(duree), par],
  );
  return jeton;
}

/** Employé auquel appartient un jeton encore valable, sans le consommer. */
export async function lireJeton(jeton) {
  if (!jeton || typeof jeton !== "string" || jeton.length < 20 || jeton.length > 200) return null;
  const { rows } = await query("select employe_id from password_tokens where token_hash = $1 and used_at is null and expires_at > now()", [empreinte(jeton)]);
  return rows[0]?.employe_id ?? null;
}

/** Consomme un jeton (atomique : deux requêtes simultanées ne peuvent pas l'utiliser deux fois). Renvoie l'id de l'employé, ou null. */
export async function consommerJeton(jeton, executer = query) {
  if (!jeton || typeof jeton !== "string" || jeton.length < 20 || jeton.length > 200) return null;
  const { rows } = await executer(
    "update password_tokens set used_at = now() where token_hash = $1 and used_at is null and expires_at > now() returning employe_id",
    [empreinte(jeton)],
  );
  return rows[0]?.employe_id ?? null;
}

/** Adresse publique de l'application, utilisée dans les liens envoyés (APP_URL en production). */
export function lienAcces(jeton) {
  const base = (process.env.APP_URL || "https://cabinet.camconsult.com.tn").replace(/\/+$/, "");
  return `${base}/activation?token=${encodeURIComponent(jeton)}`;
}

/** Règle de choix d'un mot de passe : longueur minimale, pas l'identifiant. */
export function motDePasseAcceptable(motDePasse, identifiant = "") {
  const mdp = String(motDePasse ?? "");
  if (mdp.length < 8) return "Mot de passe : 8 caractères minimum.";
  if (mdp.length > 200) return "Mot de passe trop long.";
  if (identifiant && mdp.toLowerCase().includes(String(identifiant).toLowerCase())) return "Le mot de passe ne doit pas contenir l'identifiant.";
  return null;
}

/** Vérifie le mot de passe d'un administrateur : le compte historique garde son empreinte bcrypt, les comptes créés ensuite utilisent scrypt. */
export async function verifierMdpAdmin(stocke, saisi) {
  const mdp = String(saisi ?? "");
  if (typeof stocke === "string" && stocke.startsWith("$2")) return bcrypt.compare(mdp, stocke);
  return verifyPassword(mdp, stocke);
}

/** Vrai si l'identifiant de connexion est déjà pris par un employé OU un administrateur (sans tenir compte de la casse) : la connexion les confondrait. */
export async function identifiantPris(identifiant, { sauf = null } = {}) {
  const id = String(identifiant ?? "").trim().toLowerCase();
  const a = await query("select 1 from administrateurs where lower(identifiant) = $1 and ($2::uuid is null or id <> $2)", [id, sauf]);
  const e = await query("select 1 from employes where lower(identifiant) = $1", [id]);
  return a.rows.length > 0 || e.rows.length > 0;
}
