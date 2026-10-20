import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import bcrypt from "bcryptjs";
import { query } from "./db.js";
import { inverserStructuration } from "./migrateStructuration.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Applique le schéma s'il manque et crée le compte administrateur au besoin.
 * Idempotent : sûr à appeler à chaque démarrage.
 */
export async function ensureSchema() {
  const schema = readFileSync(join(__dirname, "schema.sql"), "utf8");
  await query(schema); // toutes les instructions sont `create ... if not exists`
  await query(readFileSync(join(__dirname, "apurement", "schema.sql"), "utf8"));

  // Structuration : <société> › Comptabilité générale [année] (et non plus
  // l'inverse). Transaction : en cas d'erreur rien n'est modifié, et le
  // serveur démarre quand même.
  try {
    const n = await inverserStructuration();
    if (n > 0) console.log(`[db] structuration inversée : ${n} dossier(s) de société déplacé(s)`);
  } catch (err) {
    console.error("[db] inversion de la structuration annulée (rien n'a été modifié)", err.message);
  }

  const { rows } = await query("select id from app_meta where id = 1");
  if (rows.length === 0) {
    const identifiant = process.env.ADMIN_IDENTIFIANT || "mohamed.ayedi";
    if (process.env.NODE_ENV === "production" && !process.env.ADMIN_PASSWORD)
      throw new Error("ADMIN_PASSWORD doit être défini en production pour créer le compte administrateur.");
    const password = process.env.ADMIN_PASSWORD || "Cabinet2026!";
    const nom = process.env.ADMIN_NOM || "Mohamed Ayedi";
    const role =
      process.env.ADMIN_ROLE || "Expert-comptable — Responsable du cabinet";
    const hash = await bcrypt.hash(password, 10);
    await query(
      `insert into app_meta (id, admin_identifiant, admin_password_hash, admin_nom, admin_role)
       values (1, $1, $2, $3, $4)`,
      [identifiant, hash, nom, role],
    );
    console.log(`[db] compte administrateur créé : ${identifiant}`);
  }

  // Plusieurs administrateurs : le compte historique de app_meta devient l'administrateur principal (une seule fois). Ses sessions ouvertes
  // sont rattachées à son nouveau compte « admin:<id> » ; ses anciens jetons (sans adminId) restent valables.
  const { rows: admins } = await query("select 1 from administrateurs limit 1");
  if (admins.length === 0) {
    const { rows: m } = await query("select * from app_meta where id = 1");
    if (m[0]) {
      const { rows: cree } = await query(
        `insert into administrateurs (identifiant, mdp_hash, nom, fonction, principal, session_version, last_login, totp_actif, totp_secret, totp_attente, totp_dernier_pas, codes_secours)
         values ($1,$2,$3,$4,true,$5,$6,$7,$8,$9,$10,$11) returning id`,
        [m[0].admin_identifiant, m[0].admin_password_hash, m[0].admin_nom, m[0].admin_role, m[0].session_version ?? 0, m[0].last_login ?? null, Boolean(m[0].totp_actif), m[0].totp_secret ?? null, m[0].totp_attente ?? null, m[0].totp_dernier_pas ?? null, JSON.stringify(m[0].codes_secours ?? [])],
      );
      await query("update sessions_connexion set compte = $1 where compte = 'admin'", [`admin:${cree[0].id}`]);
      console.log("[db] administrateur principal migré vers la table administrateurs");
    }
  }
  // Messagerie : les messages du cabinet écrits avant les comptes multiples sont ceux du principal ; ce qu'un administrateur avait déjà lu
  // (une seule fois, tant qu'aucune lecture par administrateur n'est enregistrée) reste lu pour le principal.
  await query("update messages set admin_id = (select id from administrateurs where principal) where auteur_id = 'me' and admin_id is null");
  await query(
    `insert into messages_lus_admin (message_id, admin_id)
     select m.id, (select id from administrateurs where principal) from messages m
      where m.auteur_id <> 'me' and m.statut = 'lu' and exists (select 1 from administrateurs where principal)
        and not exists (select 1 from messages_lus_admin)
     on conflict do nothing`,
  );
  // Boîte de notifications : chaque administrateur a la sienne (« admin:<id> »). Les notifications écrites quand il n'y avait qu'un administrateur
  // (clé « admin ») reviennent au principal, qui était alors le seul destinataire.
  await query(
    `update notifications set user_key = 'admin:' || (select id::text from administrateurs where principal)
      where user_key = 'admin' and exists (select 1 from administrateurs where principal)`,
  );
}
