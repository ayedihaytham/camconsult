import { query } from "./db.js";
import { logAction } from "./journal.js";
import { notifyMany, concernedBySociete } from "./notifications.js";
import { sendCollecteRelanceEmail } from "./mailer.js";

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // vérifie toutes les heures
const COOLDOWN = "3 days"; // ne relance pas plus souvent que ça automatiquement

/** Démarre la vérification périodique des collectes en retard — appelé une
 * fois au démarrage du serveur (voir index.js). Ne bloque jamais le
 * démarrage : la première vérification est asynchrone. */
export function startRelancesScheduler() {
  runCheck();
  setInterval(runCheck, CHECK_INTERVAL_MS);
}

async function runCheck() {
  try {
    const { rows } = await query(
      `select c.id, c.societe_id, c.periode, c.echeance,
              s.raison_sociale, s.email as societe_email
       from collectes c
       join societes s on s.id = c.societe_id
       where c.statut in ('brouillon', 'a_corriger')
         and c.echeance is not null
         and c.echeance < current_date
         and (c.derniere_relance_le is null
              or c.derniere_relance_le < now() - interval '${COOLDOWN}')`,
    );
    for (const row of rows) {
      await sendRelance(row);
    }
  } catch (err) {
    console.error("[relances] vérification échouée", err.message);
  }
}

/** Envoie une relance immédiate pour une collecte (déclenchée par la
 * vérification périodique, ou manuellement via POST /:id/relance). `row`
 * doit porter societe_id, raison_sociale, societe_email, periode, echeance. */
export async function sendRelance(row) {
  const targets = await concernedBySociete(row.societe_id, { includeAdmin: false });
  notifyMany(
    targets,
    "collecte",
    `Rappel — collecte en attente : ${row.raison_sociale}`,
    `Échéance dépassée — ${row.periode}`,
    `/collectes/${row.id}`,
  );
  await sendCollecteRelanceEmail({
    email: row.societe_email,
    raisonSociale: row.raison_sociale,
    periode: row.periode,
    echeance: row.echeance,
  }).catch((err) => console.error("[mailer] relance échouée", err.message));
  await query("update collectes set derniere_relance_le = now() where id = $1", [row.id]);
  logAction(
    "Système",
    "modification",
    "collecte",
    `Relance envoyée — ${row.raison_sociale} ${row.periode}`,
    row.id,
  );
}
