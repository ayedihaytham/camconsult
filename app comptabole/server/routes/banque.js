import { Router } from "express";
import { z } from "zod";
import { query, withTransaction } from "../db.js";
import { requireAuth } from "../auth.js";
import { logAction } from "../journal.js";
import { safeRouter } from "../asyncRoutes.js";

/** Suivi bancaire : comptes d'une société et leurs mouvements.
 * Lecture : admin, collaborateurs de la société et responsable de la société (jamais un délégué).
 * Écriture : admin et collaborateurs de la société. */
export const banqueRouter = safeRouter(Router());
banqueRouter.use(requireAuth);

const inScope = (s, societeId) => s.role === "admin" || (s.societeIds || []).includes(societeId);
const canWrite = (s, societeId) => s.poste !== "societe_employe" && inScope(s, societeId);
const canRead = (s, societeId) =>
  canWrite(s, societeId) || (s.poste === "societe_employe" && !s.delegue && inScope(s, societeId));

const TYPES = ["encaissement_client", "paiement_fournisseur", "frais", "credit", "change", "autre"];

/** Date PostgreSQL (minuit local) -> AAAA-MM-JJ, sans décalage de fuseau. */
function jour(d) {
  if (!d) return null;
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}

async function etat(societeId) {
  const { rows: comptes } = await query(
    "select * from comptes_bancaires where societe_id = $1 order by ordre, cree_le",
    [societeId],
  );
  const { rows: mouvements } = await query(
    `select m.*, r.id as reglement_id, r.fournisseur_cle
       from mouvements_bancaires m
       left join fournisseur_reglements r on r.mouvement_bancaire_id = m.id
      where m.societe_id = $1
      order by m.date_op, m.ordre, m.cree_le`,
    [societeId],
  );
  return {
    comptes: comptes.map((c) => ({
      id: c.id,
      banque: c.banque,
      devise: c.devise,
      numero: c.numero,
      soldeDepart: Number(c.solde_depart),
      dateDepart: jour(c.date_depart),
      soldeReel: c.solde_reel == null ? null : Number(c.solde_reel),
      dateReel: jour(c.date_reel),
    })),
    mouvements: mouvements.map((m) => ({
      id: m.id,
      compteId: m.compte_id,
      dateOp: jour(m.date_op),
      dateValeur: jour(m.date_valeur),
      libelle: m.libelle,
      details: m.details,
      reference: m.reference,
      numPiece: m.num_piece,
      debit: Number(m.debit),
      credit: Number(m.credit),
      type: m.type,
      cours: m.cours == null ? null : Number(m.cours),
      reglementId: m.reglement_id ?? null,
      fournisseurCle: m.fournisseur_cle ?? null,
    })),
  };
}

banqueRouter.get("/", async (req, res) => {
  const societeId = req.query.societeId;
  if (!societeId) return res.status(400).json({ error: "societeId requis" });
  if (!canRead(req.session, societeId)) return res.status(403).json({ error: "Accès non autorisé" });
  res.json(await etat(societeId));
});

const montant = z.coerce.number().min(0, "Montant invalide").default(0);
const dateOptionnelle = z.string().nullish();

const compteSchema = z.object({
  societeId: z.string().uuid(),
  banque: z.string().trim().min(1, "Banque requise"),
  devise: z.string().trim().min(1).default("TND").transform((d) => d.toUpperCase()),
  numero: z.string().default(""),
  soldeDepart: z.coerce.number().default(0),
  dateDepart: dateOptionnelle,
  soldeReel: z.coerce.number().nullish(),
  dateReel: dateOptionnelle,
});

banqueRouter.post("/comptes", async (req, res) => {
  const parsed = compteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Données invalides" });
  const v = parsed.data;
  if (!canWrite(req.session, v.societeId)) return res.status(403).json({ error: "Accès non autorisé" });
  await query(
    `insert into comptes_bancaires (societe_id, banque, devise, numero, solde_depart, date_depart, solde_reel, date_reel, ordre)
     values ($1,$2,$3,$4,$5,$6,$7,$8, (select coalesce(max(ordre), -1) + 1 from comptes_bancaires where societe_id = $1))`,
    [v.societeId, v.banque, v.devise, v.numero, v.soldeDepart, v.dateDepart || null, v.soldeReel ?? null, v.dateReel || null],
  );
  logAction(req.session.nom, "creation", "suivi bancaire", `Compte ${v.banque} ${v.devise}`);
  res.json(await etat(v.societeId));
});

banqueRouter.patch("/comptes/:id", async (req, res) => {
  const { rows } = await query("select societe_id from comptes_bancaires where id = $1", [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: "Compte introuvable" });
  const parsed = compteSchema.safeParse({ ...req.body, societeId: rows[0].societe_id });
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Données invalides" });
  const v = parsed.data;
  if (!canWrite(req.session, v.societeId)) return res.status(403).json({ error: "Accès non autorisé" });
  await query(
    `update comptes_bancaires set banque=$2, devise=$3, numero=$4, solde_depart=$5, date_depart=$6, solde_reel=$7, date_reel=$8 where id=$1`,
    [req.params.id, v.banque, v.devise, v.numero, v.soldeDepart, v.dateDepart || null, v.soldeReel ?? null, v.dateReel || null],
  );
  logAction(req.session.nom, "modification", "suivi bancaire", `Compte ${v.banque} ${v.devise}`);
  res.json(await etat(v.societeId));
});

banqueRouter.delete("/comptes/:id", async (req, res) => {
  const { rows } = await query("select societe_id, banque, devise from comptes_bancaires where id = $1", [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: "Compte introuvable" });
  if (!canWrite(req.session, rows[0].societe_id)) return res.status(403).json({ error: "Accès non autorisé" });
  await query("delete from comptes_bancaires where id = $1", [req.params.id]);
  logAction(req.session.nom, "suppression", "suivi bancaire", `Compte ${rows[0].banque} ${rows[0].devise}`);
  res.json(await etat(rows[0].societe_id));
});

const mouvementSchema = z
  .object({
    dateOp: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date de l'opération invalide"),
    dateValeur: dateOptionnelle,
    libelle: z.string().default(""),
    details: z.string().default(""),
    reference: z.string().default(""),
    numPiece: z.string().default(""),
    debit: montant,
    credit: montant,
    type: z.enum(TYPES).default("autre"),
    cours: z.coerce.number().positive().nullish(),
  })
  .refine((m) => !(m.debit > 0 && m.credit > 0), { message: "Un mouvement est soit un débit, soit un crédit" });

const SELECT_MOUVEMENT = "select societe_id, compte_id from mouvements_bancaires where id = $1";

banqueRouter.post("/comptes/:id/mouvements", async (req, res) => {
  const { rows } = await query("select societe_id from comptes_bancaires where id = $1", [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: "Compte introuvable" });
  const societeId = rows[0].societe_id;
  if (!canWrite(req.session, societeId)) return res.status(403).json({ error: "Accès non autorisé" });
  const parsed = mouvementSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Données invalides" });
  const v = parsed.data;
  await query(
    `insert into mouvements_bancaires (societe_id, compte_id, date_op, date_valeur, libelle, details, reference, num_piece, debit, credit, type, cours, ordre)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, (select coalesce(max(ordre), -1) + 1 from mouvements_bancaires where compte_id = $2))`,
    [societeId, req.params.id, v.dateOp, v.dateValeur || null, v.libelle, v.details, v.reference, v.numPiece, v.debit, v.credit, v.type, v.cours ?? null],
  );
  logAction(req.session.nom, "creation", "suivi bancaire", v.libelle || "Mouvement");
  res.json(await etat(societeId));
});

const importSchema = z.object({ mouvements: z.array(mouvementSchema).min(1, "Aucun mouvement à importer").max(5000) });
const cle = (m) => [m.dateOp, m.libelle.trim().toLowerCase(), m.debit, m.credit].join("|");

/** Import d'un relevé : les mouvements déjà présents (même date, libellé et montant) ne sont pas recréés,
 * même si le même relevé est importé deux fois. */
banqueRouter.post("/comptes/:id/import", async (req, res) => {
  const { rows } = await query("select societe_id from comptes_bancaires where id = $1", [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: "Compte introuvable" });
  const societeId = rows[0].societe_id;
  if (!canWrite(req.session, societeId)) return res.status(403).json({ error: "Accès non autorisé" });
  const parsed = importSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Données invalides" });
  const bilan = await withTransaction(async (client) => {
    const { rows: existants } = await client.query(
      "select date_op, libelle, debit, credit from mouvements_bancaires where compte_id = $1",
      [req.params.id],
    );
    const deja = new Map();
    for (const e of existants) {
      const k = cle({ dateOp: jour(e.date_op), libelle: e.libelle, debit: Number(e.debit), credit: Number(e.credit) });
      deja.set(k, (deja.get(k) ?? 0) + 1);
    }
    let { rows: [{ prochain }] } = await client.query(
      "select coalesce(max(ordre), -1) + 1 as prochain from mouvements_bancaires where compte_id = $1",
      [req.params.id],
    );
    prochain = Number(prochain);
    let importes = 0;
    for (const m of parsed.data.mouvements) {
      const k = cle(m);
      if ((deja.get(k) ?? 0) > 0) {
        deja.set(k, deja.get(k) - 1);
        continue;
      }
      await client.query(
        `insert into mouvements_bancaires (societe_id, compte_id, date_op, date_valeur, libelle, details, reference, num_piece, debit, credit, type, cours, ordre)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [societeId, req.params.id, m.dateOp, m.dateValeur || null, m.libelle, m.details, m.reference, m.numPiece, m.debit, m.credit, m.type, m.cours ?? null, prochain++],
      );
      importes++;
    }
    return { importes, ignores: parsed.data.mouvements.length - importes };
  });
  logAction(req.session.nom, "creation", "suivi bancaire", `Import de ${bilan.importes} mouvement(s)`);
  res.json({ ...(await etat(societeId)), ...bilan });
});

banqueRouter.patch("/mouvements/:id", async (req, res) => {
  const { rows } = await query(SELECT_MOUVEMENT, [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: "Mouvement introuvable" });
  if (!canWrite(req.session, rows[0].societe_id)) return res.status(403).json({ error: "Accès non autorisé" });
  const parsed = mouvementSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Données invalides" });
  const v = parsed.data;
  await query(
    `update mouvements_bancaires set date_op=$2, date_valeur=$3, libelle=$4, details=$5, reference=$6, num_piece=$7, debit=$8, credit=$9, type=$10, cours=$11 where id=$1`,
    [req.params.id, v.dateOp, v.dateValeur || null, v.libelle, v.details, v.reference, v.numPiece, v.debit, v.credit, v.type, v.cours ?? null],
  );
  logAction(req.session.nom, "modification", "suivi bancaire", v.libelle || "Mouvement");
  res.json(await etat(rows[0].societe_id));
});

banqueRouter.delete("/mouvements/:id", async (req, res) => {
  const { rows } = await query("select societe_id, libelle from mouvements_bancaires where id = $1", [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: "Mouvement introuvable" });
  if (!canWrite(req.session, rows[0].societe_id)) return res.status(403).json({ error: "Accès non autorisé" });
  await query("delete from mouvements_bancaires where id = $1", [req.params.id]);
  logAction(req.session.nom, "suppression", "suivi bancaire", rows[0].libelle || "Mouvement");
  res.json(await etat(rows[0].societe_id));
});
