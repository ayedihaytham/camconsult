import { query } from "../db.js";
import { logAction } from "../journal.js";
import { autoriserLocal, lireConnexion } from "./connexion.js";
import { lireRefTtn } from "./refTtn.js";
import { consulterFacture } from "./soap.js";

/**
 * Suivi des factures déposées chez TTN. La vérité vient de consultEfact (le message de saveEfact n'est jamais interprété) :
 *  - référence TTN présente (generatedRef ou bloc RefTtnVal) → « validée », avec référence, date et QR officiel ;
 *  - sinon acquittements négatifs → « rejetée » (la facture peut être rouverte pour correction) ;
 *  - sinon : TTN ne s'est pas encore prononcé, la facture reste « déposée ».
 */

const INTERVALLE_MS = 5 * 60 * 1000;
const MAX_PAR_PASSAGE = 20;

const dateOuNull = (v) => {
  const d = new Date(v);
  return v && !Number.isNaN(d.getTime()) ? d.toISOString() : null;
};

/** Actualise UNE facture « déposée ». Renvoie son statut après vérification. Lève ErreurTtn si le service est injoignable. */
export async function actualiserFacture(factureId, config, options = {}, acteur = "Système") {
  const ligne = (
    await query("select e.statut, f.numero from facture_einvoice e join factures f on f.id = e.facture_id where e.facture_id = $1", [factureId])
  ).rows[0];
  if (!ligne || ligne.statut !== "deposee") return { statut: ligne?.statut ?? null, change: false };

  const resultats = await consulterFacture(config, ligne.numero, { autoriserLocal: autoriserLocal(), ...options });
  const r = resultats.find((x) => x.documentNumber === ligne.numero) ?? resultats.find((x) => !x.documentNumber);
  if (!r) {
    await query("update facture_einvoice set ttn_verifie_le = now(), ttn_derniere_erreur = null where facture_id = $1 and statut = 'deposee'", [factureId]);
    return { statut: "deposee", change: false };
  }

  const ref = lireRefTtn(r.xml);
  const reference = r.generatedRef || ref?.ref || "";
  if (reference) {
    const { rowCount } = await query(
      `update facture_einvoice set statut = 'validee', ttn_ref = $2, ttn_ref_date = $3, ttn_qr_png = $4, ttn_xml = $5,
              ttn_acquittements = $6::jsonb, ttn_derniere_erreur = null, ttn_verifie_le = now(), maj_le = now()
        where facture_id = $1 and statut = 'deposee'`,
      [factureId, reference, ref?.dateIso ?? dateOuNull(r.dateProcess), ref?.qrPng ?? null, r.xml, JSON.stringify(r.acquittements)],
    );
    if (rowCount) logAction(acteur, "modification", "facture", `${ligne.numero} — facture électronique validée par TTN (réf. ${reference.slice(0, 40)})`, factureId);
    return { statut: "validee", change: rowCount > 0 };
  }
  if (r.acquittements.length > 0) {
    const { rowCount } = await query(
      `update facture_einvoice set statut = 'rejetee', ttn_acquittements = $2::jsonb, ttn_derniere_erreur = null, ttn_verifie_le = now(), maj_le = now()
        where facture_id = $1 and statut = 'deposee'`,
      [factureId, JSON.stringify(r.acquittements)],
    );
    if (rowCount) logAction(acteur, "modification", "facture", `${ligne.numero} — facture électronique rejetée par TTN (${r.acquittements.length} acquittement(s))`, factureId);
    return { statut: "rejetee", change: rowCount > 0 };
  }
  await query("update facture_einvoice set ttn_verifie_le = now(), ttn_derniere_erreur = null where facture_id = $1 and statut = 'deposee'", [factureId]);
  return { statut: "deposee", change: false };
}

/** Un passage : actualise les factures déposées (20 au plus). Renvoie { verifiees, changees, erreur }. */
export async function actualiserToutes(options = {}, acteur = "Système") {
  const config = await lireConnexion();
  if (!config) return { verifiees: 0, changees: 0, erreur: null };
  const { rows } = await query("select facture_id from facture_einvoice where statut = 'deposee' order by depose_le nulls first limit $1", [MAX_PAR_PASSAGE]);
  let verifiees = 0;
  let changees = 0;
  let erreur = null;
  for (const { facture_id: id } of rows) {
    try {
      const r = await actualiserFacture(id, config, options, acteur);
      verifiees++;
      if (r.change) changees++;
    } catch (e) {
      erreur = e?.message ?? "Erreur inconnue";
      await query("update facture_einvoice set ttn_derniere_erreur = $2, ttn_verifie_le = now() where facture_id = $1 and statut = 'deposee'", [id, String(erreur).slice(0, 500)]).catch(() => undefined);
      if (e?.code === "RESEAU" || e?.code === "DELAI" || e?.code === "ACCES_REFUSE") break; // inutile d'insister sur les suivantes
    }
  }
  return { verifiees, changees, erreur };
}

let enCours = false;
async function passage() {
  if (enCours) return;
  enCours = true;
  try {
    await actualiserToutes();
  } catch (e) {
    console.error("[ttn] suivi échoué", e?.message);
  } finally {
    enCours = false;
  }
}

/** Démarre le suivi périodique (appelé une fois au démarrage du serveur). Inactif tant que l'accès TTN n'est pas enregistré. */
export function demarrerSuiviTtn(intervalleMs = INTERVALLE_MS) {
  const minuteur = setInterval(passage, intervalleMs);
  minuteur.unref?.();
  return minuteur;
}
