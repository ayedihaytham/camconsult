import { Router } from "express";
import { z } from "zod";
import { query, withTransaction } from "../db.js";
import { requireAuth } from "../auth.js";
import { logAction } from "../journal.js";
import { safeRouter } from "../asyncRoutes.js";

/** Suivi fournisseur : état des factures d'achat du stock et de leurs règlements.
 * Lecture : admin, collaborateurs de la société, et responsable de la société (jamais un délégué).
 * Écriture : admin et collaborateurs de la société. */
export const fournisseursRouter = safeRouter(Router());
fournisseursRouter.use(requireAuth);

const inScope = (s, societeId) => s.role === "admin" || (s.societeIds || []).includes(societeId);
const canWrite = (s, societeId) => s.poste !== "societe_employe" && inScope(s, societeId);
const canRead = (s, societeId) =>
  canWrite(s, societeId) || (s.poste === "societe_employe" && !s.delegue && inScope(s, societeId));

const r3 = (n) => Math.round((Number(n) + Number.EPSILON) * 1000) / 1000;

/** Clé de regroupement d'un fournisseur : sans accents, casse ni ponctuation. */
export function cleFournisseur(nom) {
  return String(nom || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const MODES = ["virement", "cheque", "effet", "especes", "autre"];

/** Date PostgreSQL (minuit local) -> AAAA-MM-JJ, sans décalage de fuseau. */
function jour(d) {
  if (!d) return null;
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}

async function etat(societeId) {
  const { rows: mouvements } = await query(
    `select m.id, m.fournisseur, m.achat_num_facture, m.achat_date, m.achat_devise, m.achat_cours,
            m.vente_num_facture, m.douane_num_declaration, m.ordre,
            coalesce(sum(l.quantite), 0) as quantite,
            coalesce(sum(l.montant_devise), 0) as montant,
            coalesce(sum(l.montant_tnd), 0) as montant_tnd,
            string_agg(l.designation, ' / ' order by l.ordre) filter (where l.designation <> '') as designation,
            s.num_proforma, s.date_proforma, s.montant_proforma, s.qte_proforma, s.etat_proforma, s.num_titre, s.etat_chargement, s.vu_passe
       from stock_mouvements m
       left join stock_lignes l on l.mouvement_id = m.id and l.categorie = 'achat'
       left join fournisseur_suivi s on s.mouvement_id = m.id
      where m.societe_id = $1 and (m.fournisseur <> '' or m.achat_num_facture <> '')
      group by m.id, s.mouvement_id
      order by m.achat_date nulls last, m.ordre, m.cree_le`,
    [societeId],
  );
  const { rows: reglements } = await query(
    "select * from fournisseur_reglements where societe_id = $1 order by date_reglement nulls last, cree_le",
    [societeId],
  );
  const { rows: affectations } = await query(
    `select a.reglement_id, a.mouvement_id, a.montant
       from fournisseur_affectations a join fournisseur_reglements r on r.id = a.reglement_id
      where r.societe_id = $1`,
    [societeId],
  );
  return {
    factures: mouvements.map((m) => {
      const quantite = Number(m.quantite);
      const montant = Number(m.montant);
      return {
        id: m.id,
        fournisseur: m.fournisseur,
        fournisseurCle: cleFournisseur(m.fournisseur),
        numFacture: m.achat_num_facture,
        date: jour(m.achat_date),
        devise: m.achat_devise,
        cours: Number(m.achat_cours),
        quantite,
        designation: m.designation || "",
        prixUnitaire: quantite ? r3(montant / quantite) : 0,
        montant,
        montantTnd: Number(m.montant_tnd),
        venteNumFacture: m.vente_num_facture,
        douaneNumDeclaration: m.douane_num_declaration,
        suivi: {
          numProforma: m.num_proforma || "",
          dateProforma: jour(m.date_proforma),
          montantProforma: Number(m.montant_proforma || 0),
          qteProforma: Number(m.qte_proforma || 0),
          etatProforma: m.etat_proforma || "",
          numTitre: m.num_titre || "",
          etatChargement: m.etat_chargement || "",
          vuPasse: m.vu_passe || "",
        },
      };
    }),
    reglements: reglements.map((r) => {
      const affs = affectations
        .filter((a) => a.reglement_id === r.id)
        .map((a) => ({ mouvementId: a.mouvement_id, montant: Number(a.montant) }));
      const brut = r3(affs.reduce((s, a) => s + a.montant, 0));
      return {
        id: r.id,
        fournisseurCle: r.fournisseur_cle,
        date: jour(r.date_reglement),
        mode: r.mode,
        reference: r.reference,
        banque: r.banque,
        devise: r.devise,
        cours: Number(r.cours),
        rsTaux: Number(r.rs_taux),
        rsNumero: r.rs_numero,
        rsMontant: Number(r.rs_montant),
        note: r.note,
        mouvementBancaireId: r.mouvement_bancaire_id ?? null,
        brut,
        vire: r3(brut - Number(r.rs_montant)),
        affectations: affs,
      };
    }),
  };
}

fournisseursRouter.get("/", async (req, res) => {
  const societeId = req.query.societeId;
  if (!societeId) return res.status(400).json({ error: "societeId requis" });
  if (!canRead(req.session, societeId)) return res.status(403).json({ error: "Accès non autorisé" });
  res.json(await etat(societeId));
});

const num = z.coerce.number().default(0);
const reglementSchema = z.object({
  societeId: z.string().uuid(),
  fournisseurCle: z.string().min(1),
  dateReglement: z.string().nullish(),
  mode: z.enum(MODES).default("virement"),
  reference: z.string().default(""),
  banque: z.string().default(""),
  devise: z.string().default("TND"),
  cours: num,
  rsTaux: num,
  rsNumero: z.string().default(""),
  rsMontant: z.coerce.number().min(0).default(0),
  note: z.string().default(""),
  // Mouvement bancaire qui a payé ce règlement (rapprochement), ou rien.
  mouvementBancaireId: z.string().uuid().nullish(),
  affectations: z
    .array(z.object({ mouvementId: z.string().uuid(), montant: z.coerce.number().positive("Montant affecté invalide") }))
    .min(1, "Choisissez au moins une facture"),
});

/** Les factures doivent appartenir à la société, au fournisseur et à la devise du règlement, et aucune
 * ne peut être payée au-delà de son montant. Renvoie le message d'erreur, ou null. */
async function verifier(client, v, reglementId) {
  const ids = v.affectations.map((a) => a.mouvementId);
  if (new Set(ids).size !== ids.length) return "Une facture est choisie deux fois";
  const { rows } = await client.query(
    `select m.id, m.fournisseur, m.achat_num_facture, m.achat_devise,
            coalesce((select sum(l.montant_devise) from stock_lignes l where l.mouvement_id = m.id and l.categorie = 'achat'), 0) as montant,
            coalesce((select sum(a.montant) from fournisseur_affectations a where a.mouvement_id = m.id and a.reglement_id is distinct from $3), 0) as deja
       from stock_mouvements m where m.societe_id = $1 and m.id = any($2::uuid[])`,
    [v.societeId, ids, reglementId ?? null],
  );
  if (rows.length !== ids.length) return "Facture introuvable pour cette société";
  for (const m of rows) {
    const nom = m.achat_num_facture || "sans numéro";
    if (cleFournisseur(m.fournisseur) !== v.fournisseurCle) return `La facture ${nom} n'est pas de ce fournisseur`;
    if (m.achat_devise !== v.devise) return `La facture ${nom} est en ${m.achat_devise}, pas en ${v.devise}`;
    const a = v.affectations.find((x) => x.mouvementId === m.id);
    if (Number(m.deja) + a.montant > Number(m.montant) + 0.0015) return `Le règlement dépasse le solde de la facture ${nom}`;
  }
  if (v.mouvementBancaireId) {
    const { rows: mb } = await client.query(
      `select m.id, (select r.id from fournisseur_reglements r where r.mouvement_bancaire_id = m.id and r.id is distinct from $3) as autre
         from mouvements_bancaires m where m.id = $1 and m.societe_id = $2`,
      [v.mouvementBancaireId, v.societeId, reglementId ?? null],
    );
    if (!mb[0]) return "Mouvement bancaire introuvable pour cette société";
    if (mb[0].autre) return "Ce mouvement bancaire est déjà rapproché d'un autre règlement";
  }
  const brut = v.affectations.reduce((s, a) => s + a.montant, 0);
  if (v.rsMontant > brut + 0.0015) return "La retenue à la source dépasse le montant réglé";
  return null;
}

async function ecrire(client, id, v) {
  await client.query(
    `update fournisseur_reglements set fournisseur_cle=$2, date_reglement=$3, mode=$4, reference=$5, banque=$6, devise=$7,
            cours=$8, rs_taux=$9, rs_numero=$10, rs_montant=$11, note=$12, mouvement_bancaire_id=$13, maj_le=now() where id=$1`,
    [id, v.fournisseurCle, v.dateReglement || null, v.mode, v.reference, v.banque, v.devise, v.cours, v.rsTaux, v.rsNumero, v.rsMontant, v.note, v.mouvementBancaireId || null],
  );
  await client.query("delete from fournisseur_affectations where reglement_id = $1", [id]);
  for (const a of v.affectations)
    await client.query("insert into fournisseur_affectations (reglement_id, mouvement_id, montant) values ($1,$2,$3)", [id, a.mouvementId, a.montant]);
}

fournisseursRouter.post("/reglements", async (req, res) => {
  const parsed = reglementSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Données invalides" });
  const v = parsed.data;
  if (!canWrite(req.session, v.societeId)) return res.status(403).json({ error: "Accès non autorisé" });
  const erreur = await withTransaction(async (client) => {
    const e = await verifier(client, v, null);
    if (e) return e;
    const { rows } = await client.query(
      "insert into fournisseur_reglements (societe_id, fournisseur_cle) values ($1,$2) returning id",
      [v.societeId, v.fournisseurCle],
    );
    await ecrire(client, rows[0].id, v);
    return null;
  });
  if (erreur) return res.status(400).json({ error: erreur });
  logAction(req.session.nom, "creation", "suivi fournisseur", `Règlement ${v.reference || v.mode}`);
  res.json(await etat(v.societeId));
});

fournisseursRouter.patch("/reglements/:id", async (req, res) => {
  const { rows } = await query("select societe_id from fournisseur_reglements where id = $1", [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: "Règlement introuvable" });
  const parsed = reglementSchema.safeParse({ ...req.body, societeId: rows[0].societe_id });
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Données invalides" });
  const v = parsed.data;
  if (!canWrite(req.session, v.societeId)) return res.status(403).json({ error: "Accès non autorisé" });
  const erreur = await withTransaction(async (client) => {
    const e = await verifier(client, v, req.params.id);
    if (e) return e;
    await ecrire(client, req.params.id, v);
    return null;
  });
  if (erreur) return res.status(400).json({ error: erreur });
  logAction(req.session.nom, "modification", "suivi fournisseur", `Règlement ${v.reference || v.mode}`);
  res.json(await etat(v.societeId));
});

fournisseursRouter.delete("/reglements/:id", async (req, res) => {
  const { rows } = await query("select societe_id, reference, mode from fournisseur_reglements where id = $1", [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: "Règlement introuvable" });
  if (!canWrite(req.session, rows[0].societe_id)) return res.status(403).json({ error: "Accès non autorisé" });
  await query("delete from fournisseur_reglements where id = $1", [req.params.id]);
  logAction(req.session.nom, "suppression", "suivi fournisseur", `Règlement ${rows[0].reference || rows[0].mode}`);
  res.json(await etat(rows[0].societe_id));
});

const suiviSchema = z.object({
  numProforma: z.string().default(""),
  dateProforma: z.string().nullish(),
  montantProforma: num,
  qteProforma: num,
  etatProforma: z.string().default(""),
  numTitre: z.string().default(""),
  etatChargement: z.string().default(""),
  vuPasse: z.string().default(""),
});

fournisseursRouter.put("/suivi/:mouvementId", async (req, res) => {
  const { rows } = await query("select societe_id, achat_num_facture from stock_mouvements where id = $1", [req.params.mouvementId]);
  if (!rows[0]) return res.status(404).json({ error: "Facture introuvable" });
  if (!canWrite(req.session, rows[0].societe_id)) return res.status(403).json({ error: "Accès non autorisé" });
  const parsed = suiviSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Données invalides" });
  const v = parsed.data;
  await query(
    `insert into fournisseur_suivi (mouvement_id, num_proforma, date_proforma, montant_proforma, qte_proforma, etat_proforma, num_titre, etat_chargement, vu_passe)
     values ($1,$2,$3,$4,$9,$5,$6,$7,$8)
     on conflict (mouvement_id) do update set num_proforma=$2, date_proforma=$3, montant_proforma=$4, qte_proforma=$9, etat_proforma=$5,
       num_titre=$6, etat_chargement=$7, vu_passe=$8`,
    [req.params.mouvementId, v.numProforma, v.dateProforma || null, v.montantProforma, v.etatProforma, v.numTitre, v.etatChargement, v.vuPasse, v.qteProforma],
  );
  logAction(req.session.nom, "modification", "suivi fournisseur", `Suivi facture ${rows[0].achat_num_facture || ""}`);
  res.json(await etat(rows[0].societe_id));
});

// ── Import d'un état fournisseur Excel : règlements et suivi de proforma, rapprochés des factures d'achat du stock ──
const importSchema = z.object({
  societeId: z.string().uuid(),
  suivis: z
    .array(
      z.object({
        mouvementId: z.string().uuid(),
        numProforma: z.string().default(""),
        dateProforma: z.string().nullish(),
        montantProforma: num,
        qteProforma: num,
        etatProforma: z.string().default(""),
        numTitre: z.string().default(""),
        etatChargement: z.string().default(""),
        vuPasse: z.string().default(""),
      }),
    )
    .max(5000)
    .default([]),
  reglements: z
    .array(
      z.object({
        fournisseurCle: z.string().min(1),
        dateReglement: z.string().nullish(),
        mode: z.enum(MODES).default("virement"),
        reference: z.string().default(""),
        banque: z.string().default(""),
        devise: z.string().default("TND"),
        rsNumero: z.string().default(""),
        rsTaux: num,
        rsMontant: z.coerce.number().min(0).default(0),
        note: z.string().default(""),
        affectations: z.array(z.object({ mouvementId: z.string().uuid(), montant: z.coerce.number().positive() })).min(1),
      }),
    )
    .max(2000)
    .default([]),
});

fournisseursRouter.post("/import", async (req, res) => {
  const parsed = importSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Données invalides" });
  const { societeId, suivis, reglements } = parsed.data;
  if (!canWrite(req.session, societeId)) return res.status(403).json({ error: "Accès non autorisé" });

  // Suivi : seules les valeurs renseignées dans le classeur remplacent celles de l'application.
  let suivisMaj = 0;
  if (suivis.length > 0) {
    const ids = suivis.map((s) => s.mouvementId);
    const { rows } = await query("select id from stock_mouvements where societe_id = $1 and id = any($2::uuid[])", [societeId, ids]);
    const permis = new Set(rows.map((r) => r.id));
    await withTransaction(async (client) => {
      for (const s of suivis) {
        if (!permis.has(s.mouvementId)) continue;
        await client.query(
          `insert into fournisseur_suivi (mouvement_id, num_proforma, date_proforma, montant_proforma, qte_proforma, etat_proforma, num_titre, etat_chargement, vu_passe)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           on conflict (mouvement_id) do update set
             num_proforma = coalesce(nullif($2, ''), fournisseur_suivi.num_proforma),
             date_proforma = coalesce($3, fournisseur_suivi.date_proforma),
             montant_proforma = case when $4 > 0 then $4 else fournisseur_suivi.montant_proforma end,
             qte_proforma = case when $5 > 0 then $5 else fournisseur_suivi.qte_proforma end,
             etat_proforma = coalesce(nullif($6, ''), fournisseur_suivi.etat_proforma),
             num_titre = coalesce(nullif($7, ''), fournisseur_suivi.num_titre),
             etat_chargement = coalesce(nullif($8, ''), fournisseur_suivi.etat_chargement),
             vu_passe = coalesce(nullif($9, ''), fournisseur_suivi.vu_passe)`,
          [s.mouvementId, s.numProforma, s.dateProforma || null, s.montantProforma, s.qteProforma, s.etatProforma, s.numTitre, s.etatChargement, s.vuPasse],
        );
        suivisMaj++;
      }
    });
  }

  // Règlements : chacun dans sa transaction, pour que l'un refusé n'empêche pas les autres. Un règlement déjà présent
  // (même fournisseur, date, mode, référence, n° de RS et montant) n'est pas recréé : l'import peut être relancé.
  let crees = 0;
  let ignores = 0;
  const refuses = [];
  for (const [i, r] of reglements.entries()) {
    const brut = r3(r.affectations.reduce((s, a) => s + a.montant, 0));
    const v = { ...r, societeId, cours: 0, dateReglement: r.dateReglement || null, mouvementBancaireId: null };
    v.rsMontant = Math.min(v.rsMontant, brut);
    const { rows: deja } = await query(
      `select r.id from fournisseur_reglements r
        where r.societe_id = $1 and r.fournisseur_cle = $2 and r.date_reglement is not distinct from $3 and r.mode = $4
          and r.reference = $5 and r.rs_numero = $6
          and abs(coalesce((select sum(a.montant) from fournisseur_affectations a where a.reglement_id = r.id), 0) - $7) < 0.002`,
      [societeId, r.fournisseurCle, v.dateReglement, r.mode, r.reference, r.rsNumero, brut],
    );
    if (deja.length > 0) {
      ignores++;
      continue;
    }
    try {
      const erreur = await withTransaction(async (client) => {
        const e = await verifier(client, v, null);
        if (e) return e;
        const { rows } = await client.query("insert into fournisseur_reglements (societe_id, fournisseur_cle) values ($1,$2) returning id", [societeId, r.fournisseurCle]);
        await ecrire(client, rows[0].id, v);
        return null;
      });
      if (erreur) refuses.push({ index: i, raison: erreur });
      else crees++;
    } catch (err) {
      refuses.push({ index: i, raison: "Erreur lors de l'enregistrement" });
      console.error("[fournisseurs] import", err);
    }
  }
  logAction(req.session.nom, "creation", "suivi fournisseur", `Import d'un état : ${crees} règlement(s), ${suivisMaj} suivi(s)`);
  res.json({ ...(await etat(societeId)), crees, ignores, refuses, suivisMaj });
});
