import { hash, audit } from "./audit.js";
import { get, relation } from "./repository.js";
import { calculateVat, parseTnd } from "./amounts.js";
import { checkVersion, fail } from "./domain.js";
import {
  updatePurchaseHeader,
  updatePurchaseAmount,
  lockStock,
} from "../stock/stockService.js";
import { notifyInternal } from "./notifications.js";

export async function sourceState(c, id, societeId) {
  const r = (
    await c.query(
      `select m.id,m.societe_id,to_char(m.achat_date,'YYYY-MM-DD') as date,m.achat_num_facture as numero,m.fournisseur,
    coalesce((select sum(l.montant_tnd) from stock_lignes l where l.mouvement_id=m.id and l.categorie='achat'),m.achat_montant_tnd)::text as ht,
    (select count(*)::int from stock_lignes l where l.mouvement_id=m.id and l.categorie='achat') as lignes
    from stock_mouvements m where m.id=$1 and m.societe_id=$2`,
      [id, societeId],
    )
  ).rows[0];
  if (!r) fail(404, "STOCK_INTROUVABLE", "Mouvement Stock introuvable.");
  return stockState(r);
}
export function stockState(row) {
  const r = {
    id: row.id,
    societe_id: row.societe_id,
    date: row.date,
    numero: row.numero,
    fournisseur: row.fournisseur,
    ht: row.ht,
    lignes: row.lignes,
  };
  // SQL numeric -> decimal string -> exact millimes. Legacy numeric precision
  // beyond millimes is rejected for review, never silently rounded.
  r.ht = String(r.ht).replace(/(\.\d*?[1-9])0+$|\.0+$/, "$1");
  try{r.htMillimes = parseTnd(r.ht);}catch{fail(422,"PRECISION_STOCK","Le total achat Stock doit être positif ou nul et exprimable au millime sans arrondi implicite. Vérifiez les lignes d’achat.");}
  r.hash = hash(r);
  return r;
}
const normalized = (s) =>
  String(s).trim().toLocaleLowerCase("fr").replace(/\s+/g, " ");
async function supplierMatches(c, invoice, name) {
  const supplier = await relation(
    c,
    "apurement_fournisseurs",
    invoice.fournisseur_id,
    invoice.societe_id,
  );
  return [supplier.raison_sociale, ...supplier.aliases].some(
    (n) => normalized(n) === normalized(name),
  );
}
export async function frozenUsage(c, id) {
  return (
    await c.query(
      `select id from apurement_declarations where statut='valide' and snapshot->'lignes' @> $1::jsonb limit 1`,
      [JSON.stringify([{ id }])],
    )
  ).rows[0];
}
export async function syncFromStock(c, session, before, after) {
  if (before.hash === after.hash) return;
  const f = (
    await c.query(
      "select * from apurement_factures where stock_mouvement_id=$1 and societe_id=$2 for update",
      [after.id, after.societe_id],
    )
  ).rows[0];
  if (!f) return;
  const conflict =
    f.conflit ||
    f.stock_hash !== before.hash ||
    (await frozenUsage(c, f.id)) ||
    !(await supplierMatches(c, f, after.fournisseur));
  let row;
  if (conflict) {
    row = (
      await c.query(
        "update apurement_factures set conflit=$2,version=version+1,updated_at=now() where id=$1 returning *",
        [
          f.id,
          JSON.stringify({
            code: "CONFLIT_SYNCHRO",
            base: before,
            incoming: after,
            approved: !!(await frozenUsage(c, f.id)),
          }),
        ],
      )
    ).rows[0];
    await notifyInternal(
      c,
      f.societe_id,
      "Conflit Stock / Apurement",
      `La facture ${f.numero_facture} nécessite une revue.`,
    );
  } else {
    const calculated = calculateVat(after.htMillimes, f.taux_tva_bps);
    row = (
      await c.query(
        `update apurement_factures set numero_facture=$2,date_facture=$3,date_precision=$4,
      montant_ht_millimes=$5,tva_calculee_millimes=$6,tva_suspendue_millimes=case when tva_mode='auto' then $6 else tva_suspendue_millimes end,
      stock_hash=$7,version=version+1,updated_at=now() where id=$1 returning *`,
        [
          f.id,
          after.numero,
          after.date,
          after.date ? "day" : "unknown",
          after.htMillimes,
          calculated,
          after.hash,
        ],
      )
    ).rows[0];
  }
  await audit(c, session, f.societe_id, "stock.synchroniser", f.id, f, row);
}
export async function syncToStock(
  c,
  session,
  before,
  after,
  { confirmAmount = false } = {},
) {
  if (!before.stock_mouvement_id) return;
  const source = await sourceState(
    c,
    before.stock_mouvement_id,
    before.societe_id,
  );
  if (before.fournisseur_id !== after.fournisseur_id)
    fail(
      409,
      "FOURNISSEUR_STOCK_A_REVOIR",
      "Corrigez d’abord le fournisseur dans Stock, puis choisissez le BC correct dans la comparaison Stock pour confirmer le rapprochement.",
    );
  if (before.conflit || source.hash !== before.stock_hash)
    fail(
      409,
      "CONFLIT_SYNCHRO",
      "Résolvez le conflit Stock avant modification.",
      { source },
    );
  if (before.montant_ht_millimes !== after.montant_ht_millimes) {
    if (!confirmAmount)
      fail(
        409,
        "ALLOCATION_STOCK_REQUISE",
        "Confirmez explicitement la modification d’une ligne TND non ambiguë, ou corrigez le montant dans Stock. Aucune ligne n’a été réécrite.",
      );
    await updatePurchaseAmount(
      c,
      source.id,
      after.societe_id,
      after.montant_ht_millimes,
    );
  }
  const date = after.date_facture
    ? `${after.date_facture.getFullYear()}-${String(after.date_facture.getMonth() + 1).padStart(2, "0")}-${String(after.date_facture.getDate()).padStart(2, "0")}`
    : null;
  await updatePurchaseHeader(c, source.id, after.societe_id, {
    date,
    numero: after.numero_facture,
    fournisseur: source.fournisseur,
  });
  const next = await sourceState(c, source.id, after.societe_id);
  await c.query("update apurement_factures set stock_hash=$2 where id=$1", [
    after.id,
    next.hash,
  ]);
  after.stock_hash = next.hash;
  await audit(
    c,
    session,
    after.societe_id,
    "apurement.synchroniser",
    after.id,
    source,
    next,
  );
  if (await frozenUsage(c, after.id))
    await notifyInternal(
      c,
      after.societe_id,
      "Modification après validation",
      "Les données courantes divergent d’une déclaration figée. Préparer une rectificative si nécessaire.",
    );
}
export async function linkStock(c, session, id, v) {
  const original = await get(c, session, "apurement_factures", id, true);
  const invoice = { ...original };
  checkVersion(invoice, v.expectedVersion);
  if (v.bcId) {
    const bc = await relation(
      c,
      "apurement_bons_commande",
      v.bcId,
      invoice.societe_id,
    );
    invoice.bc_id = bc.id;
    invoice.fournisseur_id = bc.fournisseur_id;
  }
  if (invoice.stock_mouvement_id && invoice.stock_mouvement_id !== v.stockId)
    fail(409, "DEJA_LIE", "Déliez d’abord la source existante.");
  await lockStock(c, v.stockId, invoice.societe_id);
  const source = await sourceState(c, v.stockId, invoice.societe_id);
  if (source.hash !== v.stockHash)
    fail(409, "CONFLIT_SYNCHRO", "Stock a changé depuis la suggestion.");
  if (!source.numero && !source.lignes)
    fail(422, "ACHAT_REQUIS", "Ce mouvement ne porte pas de facture d’achat.");
  if (!(await supplierMatches(c, invoice, source.fournisseur)))
    fail(
      422,
      "FOURNISSEUR_A_CONFIRMER",
      "Le fournisseur Stock doit correspondre au fournisseur vérifié ou à un alias confirmé.",
    );
  if (
    v.resolution === "apurement" &&
    source.htMillimes !== invoice.montant_ht_millimes
  )
    fail(
      409,
      "ALLOCATION_STOCK_REQUISE",
      "Réconciliez le montant dans Stock avant liaison.",
    );
  if (
    invoice.bc_id !== original.bc_id ||
    invoice.fournisseur_id !== original.fournisseur_id
  )
    await c.query(
      "update apurement_factures set bc_id=$2,fournisseur_id=$3 where id=$1",
      [id, invoice.bc_id, invoice.fournisseur_id],
    );
  let row;
  if (v.resolution === "stock") {
    const calc = calculateVat(source.htMillimes, invoice.taux_tva_bps);
    row = (
      await c.query(
        `update apurement_factures set stock_mouvement_id=$2,stock_hash=$3,conflit=null,source='stock',
      numero_facture=$4,date_facture=$5,date_precision=$6,montant_ht_millimes=$7,tva_calculee_millimes=$8,
      tva_suspendue_millimes=case when tva_mode='auto' then $8 else tva_suspendue_millimes end,version=version+1,updated_at=now() where id=$1 returning *`,
        [
          id,
          source.id,
          source.hash,
          source.numero,
          source.date,
          source.date ? "day" : "unknown",
          source.htMillimes,
          calc,
        ],
      )
    ).rows[0];
  } else {
    if (v.resolution === "apurement") {
      const supplier = await relation(
        c,
        "apurement_fournisseurs",
        invoice.fournisseur_id,
        invoice.societe_id,
      );
      const date =
        invoice.date_facture instanceof Date
          ? `${invoice.date_facture.getFullYear()}-${String(invoice.date_facture.getMonth() + 1).padStart(2, "0")}-${String(invoice.date_facture.getDate()).padStart(2, "0")}`
          : invoice.date_facture;
      await updatePurchaseHeader(c, source.id, invoice.societe_id, {
        date,
        numero: invoice.numero_facture,
        fournisseur: supplier.raison_sociale,
      });
    }
    const current = await sourceState(c, source.id, invoice.societe_id);
    row = (
      await c.query(
        `update apurement_factures set stock_mouvement_id=$2,stock_hash=$3,conflit=$4,version=version+1,updated_at=now() where id=$1 returning *`,
        [
          id,
          source.id,
          current.hash,
          v.resolution === "conflit"
            ? JSON.stringify({ source: current, code: "REVUE_INITIALE" })
            : null,
        ],
      )
    ).rows[0];
  }
  await audit(c, session, invoice.societe_id, "stock.lier", id, original, row);
  if (await frozenUsage(c, id))
    await notifyInternal(
      c,
      invoice.societe_id,
      "Rapprochement après validation",
      "Le rapprochement courant a changé. Vérifier la nécessité d’une déclaration rectificative.",
    );
  return row;
}
