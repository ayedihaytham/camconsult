// Réinitialisation de la double authentification de l'ADMINISTRATEUR (téléphone perdu, codes de secours épuisés), depuis le serveur.
//   node server/scripts/reset-2fa-admin.js                                              SIMULATION : indique l'état, ne modifie rien
//   node server/scripts/reset-2fa-admin.js --apply --confirmer-cible=<hôte:port/base>   désactive la 2FA et ferme toutes les sessions de l'administrateur
// Sur le serveur de production (conteneur) :
//   docker exec -it app-comptable node server/scripts/reset-2fa-admin.js
//   docker exec -it app-comptable node server/scripts/reset-2fa-admin.js --apply --confirmer-cible=<cible affichée ci-dessus>
// Ensuite : connexion avec le seul mot de passe, puis réactivation de la 2FA dans Paramètres. Le mot de passe n'est pas modifié ;
// ce script ne s'exécute que sur la machine du serveur (il se connecte directement à la base), jamais par le réseau.
import "dotenv/config";
import { cibleBase } from "./cible.js";

const cible = cibleBase();
console.log(`Base visée : ${cible}`);
const appliquer = process.argv.includes("--apply");
if (appliquer && !process.argv.includes(`--confirmer-cible=${cible}`)) {
  console.error(`Refusé : pour écrire, relancez avec --confirmer-cible=${cible} (la cible exacte de DATABASE_URL).`);
  process.exit(2);
}
const { pool } = await import("../db.js");

const { rows } = await pool.query("select admin_identifiant, totp_actif, jsonb_array_length(codes_secours) as codes from app_meta where id = 1");
const m = rows[0];
if (!m) {
  console.error("Aucune fiche administrateur dans cette base.");
  await pool.end();
  process.exit(1);
}
console.log(`Administrateur « ${m.admin_identifiant} » : double authentification ${m.totp_actif ? "ACTIVE" : "inactive"}${m.totp_actif ? ` (${m.codes} code(s) de secours restant(s))` : ""}.`);
if (!appliquer) {
  console.log("Simulation : rien n'a été modifié. Relancez avec --apply pour désactiver la double authentification.");
  await pool.end();
  process.exit(0);
}
await pool.query(
  "update app_meta set totp_actif = false, totp_secret = null, totp_attente = null, totp_dernier_pas = null, codes_secours = '[]'::jsonb, session_version = session_version + 1 where id = 1",
);
await pool.query("insert into journal (actor, action, entity, label) values ('Système', 'modification', 'compte', 'Double authentification de l''administrateur réinitialisée par le script serveur')").catch(() => {
  // le journal est un confort : la réinitialisation, elle, est faite
});
console.log("Double authentification désactivée ; toutes les sessions de l'administrateur sont fermées. Connectez-vous puis réactivez-la dans Paramètres.");
await pool.end();
