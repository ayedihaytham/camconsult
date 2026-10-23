import { lockCompany } from "../apurement/audit.js";
import { fail } from "../apurement/domain.js";
import { formatTnd } from "../apurement/amounts.js";
import { chargerFusions, memeFournisseur } from "../fournisseurCle.js";
import { syncFromStock, sourceState } from "../apurement/stockLinkService.js";

/** Total déjà réglé sur la facture d'achat de ce mouvement (Suivi fournisseur). */
async function totalRegle(c, id) {
  const { rows } = await c.query("select coalesce(sum(montant), 0) as total from fournisseur_affectations where mouvement_id=$1", [id]);
  return Number(rows[0].total);
}

/**
 * Détache une facture d'achat de ses règlements (Suivi fournisseur), à la demande expresse de l'utilisateur : sa part est retirée de
 * chaque règlement, un règlement qui ne couvre plus aucune facture est supprimé, et la retenue à la source d'un règlement conservé est
 * ramenée à ce qu'il couvre encore. Renvoie le nombre de règlements touchés, ceux supprimés et le montant détaché.
 */
export async function detacherReglements(c, mouvementId) {
  const { rows } = await c.query(
    "select a.reglement_id, a.montant from fournisseur_affectations a where a.mouvement_id=$1",
    [mouvementId],
  );
  if (rows.length === 0) return { touches: 0, supprimes: 0, montant: 0 };
  const ids = rows.map((r) => r.reglement_id);
  // Un règlement qui change ne se modifie pas en même temps qu'un autre du même fournisseur.
  await c.query("select pg_advisory_xact_lock(hashtext($1))", [`detacher:${mouvementId}`]);
  await c.query("delete from fournisseur_affectations where mouvement_id=$1", [mouvementId]);
  const supprimes = await c.query(
    `delete from fournisseur_reglements r where r.id = any($1::uuid[])
       and not exists (select 1 from fournisseur_affectations a where a.reglement_id = r.id)
     returning r.id`,
    [ids],
  );
  await c.query(
    `update fournisseur_reglements r
        set rs_montant = least(r.rs_montant, coalesce((select sum(a.montant) from fournisseur_affectations a where a.reglement_id = r.id), 0)),
            maj_le = now()
      where r.id = any($1::uuid[])`,
    [ids],
  );
  return { touches: ids.length, supprimes: supprimes.rowCount, montant: rows.reduce((t, r) => t + Number(r.montant), 0) };
}

/** Une facture d'achat déjà réglée garde son fournisseur et sa devise, et ne peut pas descendre sous le montant réglé. */
async function verifierAchatRegle(c, id, existing, apres) {
  const regle = await totalRegle(c, id);
  if (regle <= 0) return;
  const total = apres.achatLignes.reduce((s, l) => s + Number(l.montantDevise || 0), 0);
  if (!memeFournisseur(await chargerFusions(c, existing.societe_id), apres.fournisseur, existing.fournisseur))
    fail(409, "ACHAT_REGLE", "Cette facture d'achat a déjà des règlements : le fournisseur ne peut plus être changé. Modifiez ou supprimez d'abord les règlements dans Suivi fournisseur.");
  if (apres.achatDevise !== existing.achat_devise)
    fail(409, "ACHAT_REGLE", "Cette facture d'achat a déjà des règlements : la devise ne peut plus être changée. Modifiez ou supprimez d'abord les règlements dans Suivi fournisseur.");
  if (total + 0.0015 < regle)
    fail(409, "ACHAT_REGLE", "Le montant de la facture d'achat ne peut pas descendre sous le montant déjà réglé. Modifiez d'abord le règlement dans Suivi fournisseur.");
}

export async function lockStock(c, id, societeId) {
  await lockCompany(c, societeId);
  const row = (
    await c.query(
      "select * from stock_mouvements where id=$1 and societe_id=$2 for update",
      [id, societeId],
    )
  ).rows[0];
  if (!row) fail(404, "STOCK_INTROUVABLE", "Mouvement Stock introuvable.");
  return row;
}
export async function replaceLignes(c, id, categorie, lignes) {
  await c.query(
    "delete from stock_lignes where mouvement_id=$1 and categorie=$2",
    [id, categorie],
  );
  for (let i = 0; i < lignes.length; i++) {
    const l = lignes[i];
    await c.query(
      `insert into stock_lignes(mouvement_id,categorie,ordre,designation,quantite,prix_unitaire,montant_devise,montant_tnd,unite)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        id,
        categorie,
        i,
        l.designation,
        l.quantite,
        l.prixUnitaire,
        l.montantDevise,
        l.montantTnd,
        l.unite || "",
      ],
    );
  }
}
export async function persistStock(
  c,
  {
    id,
    columns,
    values,
    achatLignes,
    venteLignes,
    session,
    expectedRevision,
    revisionProvided = true,
    societeId,
    apresAchat,
    supprimerReglements = false,
    resume = {},
  },
) {
  await lockCompany(c, societeId);
  let before = null;
  if (id) {
    const existing = await lockStock(c, id, societeId);
    if (apresAchat && supprimerReglements) {
      // Seul le retrait de la facture d'achat peut emporter ses règlements : pas une simple modification.
      const retire = apresAchat.achatLignes.length === 0 && !String(apresAchat.fournisseur || "").trim();
      if (!retire) fail(400, "SUPPRESSION_REGLEMENTS_REFUSEE", "Les règlements ne sont supprimés qu'avec le retrait de la facture d'achat.");
      resume.detache = await detacherReglements(c, id);
    } else if (apresAchat) await verifierAchatRegle(c, id, existing, apresAchat);
    if (String(existing.apurement_revision) !== String(expectedRevision))
      fail(
        409,
        "CONFLIT_SYNCHRO",
        "Stock a changé pendant l’enregistrement. Rechargez les données.",
      );
    const linked = (
      await c.query(
        "select id from apurement_factures where stock_mouvement_id=$1",
        [id],
      )
    ).rows[0];
    if (linked && !revisionProvided)
      fail(
        409,
        "VERSION_STOCK_REQUISE",
        "Ce mouvement est lié à Apurement. Rechargez Stock pour obtenir la version courante avant modification.",
      );
    if (linked) before = await sourceState(c, id, societeId);
  }
  const row = id
    ? (
        await c.query(
          `update stock_mouvements set ${columns.map((col, i) => `${col}=$${i + 2}`).join(",")},maj_le=now(),apurement_revision=apurement_revision+1 where id=$1 returning *`,
          [id, ...values],
        )
      ).rows[0]
    : (
        await c.query(
          `insert into stock_mouvements(${columns.join(",")}) values(${values.map((_, i) => `$${i + 1}`).join(",")}) returning *`,
          values,
        )
      ).rows[0];
  await replaceLignes(c, row.id, "achat", achatLignes);
  await replaceLignes(c, row.id, "vente", venteLignes);
  if (before)
    await syncFromStock(
      c,
      session,
      before,
      await sourceState(c, row.id, societeId),
    );
  return row;
}
export async function updatePurchaseHeader(
  c,
  id,
  societeId,
  { date, numero, fournisseur },
) {
  const existing = await lockStock(c, id, societeId);
  if (!memeFournisseur(await chargerFusions(c, societeId), fournisseur, existing.fournisseur) && (await totalRegle(c, id)) > 0)
    fail(409, "ACHAT_REGLE", "Cette facture d'achat a déjà des règlements : le fournisseur ne peut plus être changé. Modifiez ou supprimez d'abord les règlements dans Suivi fournisseur.");
  // Never replaces stock lines, foreign currency fields or sales/customs data.
  await c.query(
    `update stock_mouvements set achat_date=$3,achat_num_facture=$4,fournisseur=$5,maj_le=now(),apurement_revision=apurement_revision+1 where id=$1 and societe_id=$2`,
    [id, societeId, date, numero, fournisseur],
  );
}
export async function updatePurchaseAmount(c, id, societeId, millimes) {
  const movement = await lockStock(c, id, societeId);
  const lines = (
    await c.query(
      "select * from stock_lignes where mouvement_id=$1 and categorie='achat' for update",
      [id],
    )
  ).rows;
  const one = (value) => /^1(?:\.0*)?$/.test(String(value));
  if (
    lines.length !== 1 ||
    movement.achat_devise !== "TND" ||
    !one(movement.achat_cours) ||
    !one(lines[0].quantite)
  )
    fail(
      409,
      "ALLOCATION_STOCK_REQUISE",
      "La correction inverse exige une seule ligne, quantité 1, devise TND et cours 1. Corrigez les autres cas dans Stock.",
    );
  if (Number(formatTnd(millimes)) + 0.0015 < (await totalRegle(c, id)))
    fail(409, "ACHAT_REGLE", "Le montant de la facture d'achat ne peut pas descendre sous le montant déjà réglé. Modifiez d'abord le règlement dans Suivi fournisseur.");
  await c.query(
    "update stock_lignes set montant_tnd=$2::numeric,montant_devise=$2::numeric,prix_unitaire=$2::numeric where id=$1",
    [lines[0].id, formatTnd(millimes)],
  );
}
export async function deleteStock(c, id, societeId, { supprimerReglements = false } = {}) {
  await lockStock(c, id, societeId);
  const link = (
    await c.query(
      "select id from apurement_factures where stock_mouvement_id=$1 and societe_id=$2",
      [id, societeId],
    )
  ).rows[0];
  if (link)
    fail(
      409,
      "STOCK_LIE_APUREMENT",
      "Ce mouvement est lié à Apurement. Déliez explicitement la facture brouillon avant toute suppression.",
    );
  let detache = null;
  if ((await totalRegle(c, id)) > 0) {
    if (!supprimerReglements)
      fail(409, "ACHAT_REGLE", "Cette facture d'achat a des règlements. Supprimez d'abord les règlements dans Suivi fournisseur, ou confirmez leur suppression avec le mouvement.");
    detache = await detacherReglements(c, id);
  }
  await c.query("delete from stock_mouvements where id=$1 and societe_id=$2", [
    id,
    societeId,
  ]);
  return detache;
}
