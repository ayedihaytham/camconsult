// Conversion des mots de passe d'employés encore stockés en clair (comptes qui ne se sont pas reconnectés depuis la mise à jour).
//   node server/scripts/migrate-passwords.js            SIMULATION : compte seulement, ne modifie rien
//   node server/scripts/migrate-passwords.js --apply --confirmer-cible=<hôte:port/base>    remplace chaque valeur en clair par son empreinte (les comptes gardent leur accès)
//   node server/scripts/migrate-passwords.js --apply --forcer-changement   idem, et impose le choix d'un nouveau mot de passe à la prochaine connexion
// Ne touche qu'aux comptes sans empreinte, un par un, dans une transaction. Ne supprime aucun compte, n'affiche aucun mot de passe.
// Limites : l'opération n'est pas réversible (l'ancienne valeur en clair disparaît) ; les anciennes sauvegardes de la base contiennent
// toujours les mots de passe en clair et doivent être traitées comme sensibles (chiffrées, limitées, puis supprimées à terme).
import "dotenv/config";
import { cibleBase } from "./cible.js";

const cible = cibleBase();
console.log(`Base visée : ${cible}`);
const appliquer = process.argv.includes("--apply");
// Protection contre l'erreur de cible : une écriture exige de retaper la cible exacte, affichée ci-dessus.
if (appliquer && !process.argv.includes(`--confirmer-cible=${cible}`)) {
  console.error(`Refusé : pour écrire, relancez avec --confirmer-cible=${cible} (la cible exacte de DATABASE_URL).`);
  process.exit(2);
}
const { pool } = await import("../db.js");
const { hashPassword } = await import("../passwords.js");

const forcer = process.argv.includes("--forcer-changement");

const { rows } = await pool.query("select id, identifiant, mot_de_passe from employes where mot_de_passe <> '' and mdp_hash is null order by identifiant");
console.log(`${rows.length} compte(s) avec un mot de passe en clair.`);
if (!appliquer) {
  console.log("Simulation : rien n'a été modifié. Relancez avec --apply pour convertir.");
  await pool.end();
  process.exit(0);
}

const client = await pool.connect();
try {
  await client.query("BEGIN");
  for (const r of rows) {
    const hash = await hashPassword(r.mot_de_passe);
    await client.query("update employes set mdp_hash = $1, mot_de_passe = ''" + (forcer ? ", doit_changer_mdp = true" : "") + " where id = $2 and mdp_hash is null", [hash, r.id]);
  }
  await client.query("COMMIT");
  console.log(`${rows.length} compte(s) converti(s)${forcer ? ", changement de mot de passe imposé à la prochaine connexion" : ""}.`);
} catch (err) {
  await client.query("ROLLBACK");
  console.error("Échec, aucune modification n'a été enregistrée :", err.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
