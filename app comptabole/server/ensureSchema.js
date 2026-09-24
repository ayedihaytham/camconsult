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
}
