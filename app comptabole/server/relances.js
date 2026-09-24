import { query } from "./db.js";
import { logAction } from "./journal.js";
import { notifyMany, concernedBySociete } from "./notifications.js";
import {
  frDateEcheance,
  sendCollecteRelanceEmail,
  sendCollecteRappelAvantEmail,
} from "./mailer.js";

/** true si l'échéance (Date pg ou « AAAA-MM-JJ ») est avant aujourd'hui. */
function echeanceDepassee(echeance) {
  const s = echeance instanceof Date
    ? `${echeance.getFullYear()}-${String(echeance.getMonth() + 1).padStart(2, "0")}-${String(echeance.getDate()).padStart(2, "0")}`
    : String(echeance).slice(0, 10);
  const t = new Date();
  const today = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  return s < today;
}

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // vérifie toutes les heures
const RAPPEL_AVANT_JOURS = 3; // rappel envoyé 3 jours avant l'échéance

/** Démarre la vérification périodique des collectes en retard — appelé une
 * fois au démarrage du serveur (voir index.js). Ne bloque jamais le
 * démarrage : la première vérification est asynchrone. */
export function startRelancesScheduler() {
  runCheck();
  setInterval(runCheck, CHECK_INTERVAL_MS);
}

async function runCheck() {
  try {
    await checkRelancesEnRetard();
  } catch (err) {
    console.error("[relances] vérification (en retard) échouée", err.message);
  }
  try {
    await checkRappelsAvant();
  } catch (err) {
    console.error("[relances] vérification (rappel avant échéance) échouée", err.message);
  }
}

/** Relances pour les collectes dont l'échéance est dépassée — rythme
 * configurable par collecte (relance_cadence_jours, défaut 3 jours), filtré
 * côté JS plutôt qu'en interval SQL construit dynamiquement. */
async function checkRelancesEnRetard() {
  const { rows } = await query(
    `select c.id, c.societe_id, c.periode, c.echeance, c.statut,
            c.derniere_relance_le, c.relance_cadence_jours,
            s.raison_sociale, s.email as societe_email
     from collectes c
     join societes s on s.id = c.societe_id
     where c.statut in ('brouillon', 'a_corriger')
       and c.echeance is not null
       and c.echeance < current_date`,
  );
  const now = Date.now();
  for (const row of rows) {
    const cadenceMs = (row.relance_cadence_jours || 3) * 24 * 60 * 60 * 1000;
    const last = row.derniere_relance_le ? new Date(row.derniere_relance_le).getTime() : null;
    if (last !== null && now - last < cadenceMs) continue;
    await sendRelance(row);
  }
}

/** Rappel envoyé une seule fois, RAPPEL_AVANT_JOURS avant l'échéance (donc
 * avant qu'elle soit dépassée) — `rappel_avant_envoye` évite les doublons ;
 * remis à false automatiquement si l'échéance est repoussée (voir PATCH
 * /collectes/:id). */
async function checkRappelsAvant() {
  const { rows } = await query(
    `select c.id, c.societe_id, c.periode, c.echeance,
            s.raison_sociale, s.email as societe_email
     from collectes c
     join societes s on s.id = c.societe_id
     where c.statut in ('brouillon', 'a_corriger')
       and c.echeance is not null
       and c.rappel_avant_envoye = false
       and c.echeance <= current_date + $1::int
       and c.echeance >= current_date`,
    [RAPPEL_AVANT_JOURS],
  );
  for (const row of rows) {
    const targets = await concernedBySociete(row.societe_id, { includeAdmin: false });
    notifyMany(
      targets,
      "collecte",
      `Échéance proche — collecte à transmettre : ${row.raison_sociale}`,
      `Avant le ${frDateEcheance(row.echeance)} — ${(row.periode && row.periode.trim()) || "période non précisée"}`,
      `/collectes/${row.id}`,
    );
    await sendCollecteRappelAvantEmail({
      email: row.societe_email,
      raisonSociale: row.raison_sociale,
      periode: row.periode,
      echeance: row.echeance,
    }).catch((err) => console.error("[mailer] rappel avant échéance échoué", err.message));
    await query("update collectes set rappel_avant_envoye = true where id = $1", [row.id]);
    logAction(
      "Système",
      "modification",
      "collecte",
      `Rappel d'échéance envoyé — ${row.raison_sociale} ${row.periode}`,
      row.id,
    );
  }
}

/** Envoie une relance immédiate pour une collecte en retard (déclenchée par
 * la vérification périodique, ou manuellement via POST /:id/relance). `row`
 * doit porter societe_id, raison_sociale, societe_email, periode, echeance. */
export async function sendRelance(row) {
  const targets = await concernedBySociete(row.societe_id, { includeAdmin: false });
  // Le texte suit la situation réelle : une relance manuelle peut viser une
  // collecte sans échéance, ou dont l'échéance n'est pas encore passée.
  const date = frDateEcheance(row.echeance);
  const depassee = Boolean(row.echeance) && echeanceDepassee(row.echeance);
  const periode = (row.periode && row.periode.trim()) || "période non précisée";
  notifyMany(
    targets,
    "collecte",
    `Rappel — collecte en attente : ${row.raison_sociale}`,
    date
      ? depassee
        ? `Échéance dépassée le ${date} — ${periode}`
        : `À transmettre avant le ${date} — ${periode}`
      : periode,
    `/collectes/${row.id}`,
  );
  await sendCollecteRelanceEmail({
    email: row.societe_email,
    raisonSociale: row.raison_sociale,
    periode: row.periode,
    echeance: row.echeance,
    depassee,
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
