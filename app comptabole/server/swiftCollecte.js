import { query } from "./db.js";
import { arrondi3 as r3 } from "../shared/arrondi.js";

/**
 * Les virements du module « État SWIFT » alimentent automatiquement le tableau « État SWIFT » des collectes de pièces d'une société.
 *
 *  - Un virement envoyé à la société (le cabinet l'a posé, daté, et envoyé) donne UNE ligne : date, libellé, banque, montant en dinars ;
 *    ses factures (n°, devise, montant en devise) y sont résumées. Un virement non encore envoyé n'est pas visible de la société : il n'est pas repris.
 *  - Une collecte ne reprend que les virements de sa période quand elle se lit (« Octobre 2026 », « T3 2026 », « S1 2026 », « 2026 » ou « Exercice 2025 »).
 *  - Un virement n'est repris qu'une fois pour l'ensemble des collectes de la société (repère `_swift` dans la ligne) : pas de doublon d'une période à l'autre.
 *  - Seul un tableau encore ouvert reçoit des lignes : un tableau transmis, validé ou archivé n'est jamais modifié.
 *  - Une ligne reprise dont la facture n'était pas encore renseignée se complète quand la société justifie le virement dans le module.
 */

const MOIS = ["janvier", "fevrier", "mars", "avril", "mai", "juin", "juillet", "aout", "septembre", "octobre", "novembre", "decembre"];
const normaliser = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim().replace(/\s+/g, " ");
const iso = (annee, mois, jour) => `${annee}-${String(mois).padStart(2, "0")}-${String(jour).padStart(2, "0")}`;
const finDeMois = (annee, mois) => new Date(Date.UTC(annee, mois, 0)).getUTCDate();

/** Plage de dates d'une période de collecte, ou null quand son texte n'est pas reconnu (aucun filtre de date alors). */
export function plagePeriode(periode) {
  const p = normaliser(periode);
  let m = /^([a-z]+) (\d{4})$/.exec(p);
  if (m) {
    const mois = MOIS.indexOf(m[1]) + 1;
    if (mois > 0) return { du: iso(m[2], mois, 1), au: iso(m[2], mois, finDeMois(Number(m[2]), mois)) };
  }
  m = /^t([1-4]) (\d{4})$/.exec(p);
  if (m) {
    const debut = (Number(m[1]) - 1) * 3 + 1;
    return { du: iso(m[2], debut, 1), au: iso(m[2], debut + 2, finDeMois(Number(m[2]), debut + 2)) };
  }
  m = /^s([12]) (\d{4})$/.exec(p);
  if (m) return m[1] === "1" ? { du: iso(m[2], 1, 1), au: iso(m[2], 6, 30) } : { du: iso(m[2], 7, 1), au: iso(m[2], 12, 31) };
  m = /^(?:exercice )?(\d{4})$/.exec(p);
  if (m) return { du: iso(m[1], 1, 1), au: iso(m[1], 12, 31) };
  return null;
}

const jour = (d) => {
  if (!d) return "";
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};

/** Ligne du tableau « État SWIFT » d'une collecte pour un virement du module et ses factures. */
export function ligneSwift(virement, factures = []) {
  const devises = [...new Set(factures.map((f) => String(f.devise ?? "").toUpperCase()).filter(Boolean))];
  return {
    date: jour(virement.date_operation),
    libelle: virement.libelle ?? "",
    banque: virement.banque ?? "",
    montant: Number(virement.montant) || 0,
    num_facture: factures.map((f) => f.num_facture).filter(Boolean).join(", "),
    devise: devises.length === 1 ? devises[0] : "",
    montant_devise: factures.length > 0 && devises.length <= 1 ? r3(factures.reduce((s, f) => s + Number(f.montant_devise || 0), 0)) : "",
    observations: "",
    _swift: virement.id,
  };
}

const vide = (v) => v === undefined || v === null || String(v).trim() === "";

/** Reprend dans une collecte les virements SWIFT envoyés à la société qui n'y sont pas encore. Renvoie le nombre de lignes ajoutées ou complétées. */
export async function synchroniserSwift(collecteId) {
  const c = (await query("select id, societe_id, periode, onglets, statut from collectes where id = $1", [collecteId])).rows[0];
  if (!c || c.statut === "archive" || !Array.isArray(c.onglets) || !c.onglets.includes("etat_swift")) return 0;
  const section = (await query("select statut from collecte_sections where collecte_id = $1 and onglet = 'etat_swift'", [collecteId])).rows[0];
  if (section && !["brouillon", "a_corriger"].includes(section.statut)) return 0;

  const plage = plagePeriode(c.periode);
  const virements = (
    await query(
      `select * from swift_virements where societe_id = $1 and envoye
         and ($2::date is null or date_operation is null or date_operation between $2::date and $3::date)
       order by date_operation nulls last, cree_le`,
      [c.societe_id, plage?.du ?? null, plage?.au ?? null],
    )
  ).rows;
  if (virements.length === 0) return 0;
  const factures = (
    await query("select virement_id, num_facture, montant_devise, devise from swift_factures where virement_id = any($1::uuid[]) order by ordre, cree_le", [virements.map((v) => v.id)])
  ).rows;

  // Virements déjà repris, dans cette collecte ou une autre de la société : ligne (id, collecte) par repère.
  const reprises = (
    await query(
      `select l.id, l.collecte_id, l.data from collecte_lignes l join collectes k on k.id = l.collecte_id
        where k.societe_id = $1 and l.onglet = 'etat_swift' and l.data ? '_swift'`,
      [c.societe_id],
    )
  ).rows;
  const parRepere = new Map(reprises.map((r) => [r.data._swift, r]));

  let touchees = 0;
  let ordre = Number((await query("select coalesce(max(ordre), -1) + 1 as n from collecte_lignes where collecte_id = $1 and onglet = 'etat_swift'", [collecteId])).rows[0].n);
  for (const v of virements) {
    const dossier = factures.filter((f) => f.virement_id === v.id);
    const ligne = ligneSwift(v, dossier);
    const deja = parRepere.get(v.id);
    if (!deja) {
      await query("insert into collecte_lignes (collecte_id, onglet, ordre, data) values ($1,'etat_swift',$2,$3::jsonb)", [collecteId, ordre++, JSON.stringify(ligne)]);
      touchees++;
    } else if (deja.collecte_id === collecteId && dossier.length > 0 && vide(deja.data.num_facture) && vide(deja.data.devise) && vide(deja.data.montant_devise)) {
      // La société vient de justifier ce virement dans le module : la ligne reprise reçoit ses factures (sans toucher à ce qui a été saisi).
      await query("update collecte_lignes set data = data || $2::jsonb where id = $1", [deja.id, JSON.stringify({ num_facture: ligne.num_facture, devise: ligne.devise, montant_devise: ligne.montant_devise })]);
      touchees++;
    }
  }
  if (touchees > 0) await query("update collectes set maj_le = now() where id = $1", [collecteId]);
  return touchees;
}

/** Même chose pour toutes les collectes de la société qui demandent l'État SWIFT (après un changement dans le module). Ne lève jamais. */
export async function synchroniserSwiftSociete(societeId) {
  try {
    const ids = (await query("select id from collectes where societe_id = $1 and statut <> 'archive' and onglets ? 'etat_swift'", [societeId])).rows.map((r) => r.id);
    for (const id of ids) await synchroniserSwift(id);
  } catch (e) {
    console.error("[swift] synchronisation des collectes :", e?.message ?? e);
  }
}
