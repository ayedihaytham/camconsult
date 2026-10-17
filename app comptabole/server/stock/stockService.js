import { lockCompany } from "../apurement/audit.js";
import { fail } from "../apurement/domain.js";
import { formatTnd } from "../apurement/amounts.js";
import { syncFromStock, sourceState } from "../apurement/stockLinkService.js";

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
  },
) {
  await lockCompany(c, societeId);
  let before = null;
  if (id) {
    const existing = await lockStock(c, id, societeId);
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
  await lockStock(c, id, societeId);
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
  await c.query(
    "update stock_lignes set montant_tnd=$2::numeric,montant_devise=$2::numeric,prix_unitaire=$2::numeric where id=$1",
    [lines[0].id, formatTnd(millimes)],
  );
}
export async function deleteStock(c, id, societeId) {
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
  await c.query("delete from stock_mouvements where id=$1 and societe_id=$2", [
    id,
    societeId,
  ]);
}
