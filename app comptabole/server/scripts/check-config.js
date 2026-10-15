// Contrôle de configuration avant mise en production (lecture seule).
//   node server/scripts/check-config.js        variables d'environnement seulement : AUCUNE connexion à une base (défaut)
//   node server/scripts/check-config.js --db   + contrôles en lecture seule de la base désignée par DATABASE_URL (la cible « hôte:port/base » est
//                                              affichée avant toute connexion ; aucun repli sur une base par défaut)
// Dans le conteneur de production (à l'initiative d'un opérateur autorisé) : docker exec <conteneur> node server/scripts/check-config.js --db
// Ne modifie rien et n'affiche jamais la valeur d'un secret. Code de sortie 1 si un contrôle bloquant échoue.
import "dotenv/config";
import { aEchec, evaluerConfiguration } from "../configCheck.js";
import { cibleBase } from "./cible.js";

const ICONES = { ok: "[OK]    ", info: "[INFO]  ", alerte: "[ALERTE]", echec: "[ECHEC] " };
const resultats = evaluerConfiguration(process.env);
const ajouter = (niveau, code, message) => resultats.push({ niveau, code, message });

if (process.argv.includes("--db")) {
  let cible = null;
  try {
    cible = cibleBase();
    console.log(`Base visée (lecture seule) : ${cible}\n`);
  } catch (err) {
    ajouter("echec", "BASE", err.message);
  }
  if (cible) {
  const { pool } = await import("../db.js");
  try {
    await pool.query("select 1");
    ajouter("ok", "BASE", "Connexion à la base réussie.");
    const tables = (
      await pool.query(
        "select table_name from information_schema.tables where table_schema = 'public' and table_name = any($1)",
        [["app_meta", "employes", "password_tokens", "journal", "swift_virements"]],
      )
    ).rows.map((r) => r.table_name);
    for (const t of ["app_meta", "employes", "password_tokens", "journal", "swift_virements"])
      ajouter(tables.includes(t) ? "ok" : "echec", `SCHEMA:${t}`, tables.includes(t) ? `Table ${t} présente.` : `Table ${t} absente : le schéma n'est pas à jour (il se met à jour au démarrage du serveur).`);
    const admin = (await pool.query("select count(*)::int n from app_meta where id = 1")).rows[0].n;
    ajouter(admin === 1 ? "ok" : "echec", "ADMIN", admin === 1 ? "Compte administrateur présent." : "Aucun compte administrateur : ADMIN_PASSWORD est requis au premier démarrage.");
    if (tables.includes("employes")) {
      const col = (await pool.query("select 1 from information_schema.columns where table_name = 'employes' and column_name = 'mdp_hash'")).rowCount;
      if (col) {
        const herites = (await pool.query("select count(*)::int n from employes where mot_de_passe <> '' and mdp_hash is null")).rows[0].n;
        ajouter(herites === 0 ? "ok" : "alerte", "MOTS_DE_PASSE", herites === 0 ? "Aucun mot de passe en clair en base." : `${herites} compte(s) ont encore un mot de passe en clair (convertis à leur prochaine connexion, ou avec server/scripts/migrate-passwords.js --apply).`);
      } else ajouter("alerte", "MOTS_DE_PASSE", "Colonne mdp_hash absente : démarrez la nouvelle version du serveur pour appliquer le schéma.");
    }
    if (tables.includes("journal")) {
      const trg = (await pool.query("select 1 from pg_trigger where tgname = 'journal_ajout_seul_trg'")).rowCount;
      ajouter(trg ? "ok" : "alerte", "JOURNAL", trg ? "Le journal est protégé en ajout seul." : "Déclencheur d'ajout seul absent du journal.");
    }
  } catch (err) {
    ajouter("echec", "BASE", `Base injoignable ou non conforme : ${err.code ?? err.message}`);
  } finally {
    await pool.end();
  }
  }
}

for (const r of resultats) console.log(`${ICONES[r.niveau]} ${r.code} : ${r.message}`);
const echec = aEchec(resultats);
console.log(echec ? "\nRésultat : NON CONFORME — corrigez les contrôles [ECHEC] avant la mise en ligne." : "\nRésultat : aucun contrôle bloquant en échec (examinez les [ALERTE]).");
process.exit(echec ? 1 : 0);
