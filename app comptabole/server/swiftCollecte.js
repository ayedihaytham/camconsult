import { query } from "./db.js";

/**
 * Les virements du module « État SWIFT » alimentent automatiquement le tableau « État SWIFT » des collectes de pièces d'une société, avec la
 * même logique que le module : chaque virement est une ligne d'en-tête (date, réf., libellé, banque, montant en dinars) et ses factures d'achat
 * s'ajoutent une à une, sur autant de lignes qu'il faut, jusqu'à atteindre le montant (comme les chèques d'un bordereau).
 *
 *  - Seul un virement envoyé à la société (daté et envoyé par le cabinet) est repris : tant qu'il ne lui est pas envoyé, elle ne le voit pas.
 *  - Une collecte ne reprend que les virements de sa période quand elle se lit (« Octobre 2026 », « T3 2026 », « S1 2026 », « 2026 » ou « Exercice 2025 »).
 *  - Un virement n'est repris qu'une fois pour l'ensemble des collectes de la société (repère `_swift` sur sa ligne d'en-tête), ses factures aussi (`_swiftf`).
 *  - Seul un tableau encore ouvert reçoit des lignes : un tableau transmis, validé ou archivé n'est jamais modifié.
 *  - Une facture justifiée plus tard dans le module s'ajoute sous son virement, sans toucher à ce que la société a saisi.
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

/** Référence d'un virement dans le tableau : elle identifie son groupe de lignes (en-tête et factures). */
export const refSwift = (virement) => `SWIFT-${String(virement.id).replace(/-/g, "").slice(0, 6).toUpperCase()}`;

/** Ligne d'en-tête d'un virement : date, réf., libellé, banque, montant ; la société y ajoute ses factures. */
export function ligneSwift(virement) {
  return {
    date: jour(virement.date_operation),
    ref: refSwift(virement),
    libelle: virement.libelle ?? "",
    banque: virement.banque ?? "",
    montant: Number(virement.montant) || 0,
    num_facture: "",
    devise: "",
    montant_devise: "",
    taux: "",
    montant_tnd: "",
    observations: "",
    _swift: virement.id,
  };
}

/** Ligne d'une facture d'un virement : les colonnes du virement se répètent (sans son montant) pour que la ligne reste dans son groupe. */
export function ligneFactureSwift(virement, facture) {
  return {
    date: jour(virement.date_operation),
    ref: refSwift(virement),
    libelle: virement.libelle ?? "",
    banque: virement.banque ?? "",
    montant: "",
    num_facture: facture.num_facture ?? "",
    devise: String(facture.devise ?? "").toUpperCase(),
    montant_devise: Number(facture.montant_devise) || 0,
    taux: Number(facture.taux) || "",
    montant_tnd: Number(facture.montant_tnd) || "",
    observations: "",
    _swiftf: facture.id,
  };
}

/** Reprend dans une collecte les virements SWIFT envoyés à la société (et leurs factures) qui n'y sont pas encore. Renvoie le nombre de lignes ajoutées. */
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
    await query("select id, virement_id, num_facture, montant_devise, devise, taux, montant_tnd from swift_factures where virement_id = any($1::uuid[]) order by ordre, cree_le", [virements.map((v) => v.id)])
  ).rows;

  // Ce qui est déjà repris, dans cette collecte ou une autre de la société.
  const reprises = (
    await query(
      `select l.collecte_id, l.data from collecte_lignes l join collectes k on k.id = l.collecte_id
        where k.societe_id = $1 and l.onglet = 'etat_swift' and (l.data ? '_swift' or l.data ? '_swiftf')`,
      [c.societe_id],
    )
  ).rows;
  const enTete = new Map(reprises.filter((r) => r.data._swift).map((r) => [r.data._swift, r]));
  const dejaFactures = new Set(reprises.map((r) => r.data._swiftf).filter(Boolean));

  const ajouter = async (data, apresRef) => {
    let ordre;
    if (apresRef) {
      // Sous la dernière ligne du groupe du virement : les lignes qui suivent descendent d'un rang.
      const dernier = (await query("select max(ordre) as n from collecte_lignes where collecte_id = $1 and onglet = 'etat_swift' and data->>'ref' = $2", [collecteId, apresRef])).rows[0].n;
      if (dernier !== null) {
        ordre = Number(dernier) + 1;
        await query("update collecte_lignes set ordre = ordre + 1 where collecte_id = $1 and onglet = 'etat_swift' and ordre >= $2", [collecteId, ordre]);
      }
    }
    if (ordre === undefined) ordre = Number((await query("select coalesce(max(ordre), -1) + 1 as n from collecte_lignes where collecte_id = $1 and onglet = 'etat_swift'", [collecteId])).rows[0].n);
    await query("insert into collecte_lignes (collecte_id, onglet, ordre, data) values ($1,'etat_swift',$2,$3::jsonb)", [collecteId, ordre, JSON.stringify(data)]);
  };

  let ajoutees = 0;
  for (const v of virements) {
    const existant = enTete.get(v.id);
    // Repris par une autre collecte : ce virement et ses factures lui appartiennent.
    if (existant && existant.collecte_id !== collecteId) continue;
    if (!existant) {
      await ajouter(ligneSwift(v), null);
      ajoutees++;
    }
    const ref = existant?.data?.ref ?? refSwift(v);
    for (const f of factures.filter((x) => x.virement_id === v.id)) {
      if (dejaFactures.has(f.id)) continue;
      await ajouter(ligneFactureSwift(v, f), ref);
      ajoutees++;
    }
  }
  if (ajoutees > 0) await query("update collectes set maj_le = now() where id = $1", [collecteId]);
  return ajoutees;
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
