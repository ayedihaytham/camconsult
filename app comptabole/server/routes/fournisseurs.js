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
            s.num_proforma, s.date_proforma, s.montant_proforma, s.etat_proforma, s.num_titre, s.etat_chargement, s.vu_passe
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
  const brut = v.affectations.reduce((s, a) => s + a.montant, 0);
  if (v.rsMontant > brut + 0.0015) return "La retenue à la source dépasse le montant réglé";
  return null;
}

async function ecrire(client, id, v) {
  await client.query(
    `update fournisseur_reglements set fournisseur_cle=$2, date_reglement=$3, mode=$4, reference=$5, banque=$6, devise=$7,
            cours=$8, rs_taux=$9, rs_numero=$10, rs_montant=$11, note=$12, maj_le=now() where id=$1`,
    [id, v.fournisseurCle, v.dateReglement || null, v.mode, v.reference, v.banque, v.devise, v.cours, v.rsTaux, v.rsNumero, v.rsMontant, v.note],
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
    `insert into fournisseur_suivi (mouvement_id, num_proforma, date_proforma, montant_proforma, etat_proforma, num_titre, etat_chargement, vu_passe)
     values ($1,$2,$3,$4,$5,$6,$7,$8)
     on conflict (mouvement_id) do update set num_proforma=$2, date_proforma=$3, montant_proforma=$4, etat_proforma=$5,
       num_titre=$6, etat_chargement=$7, vu_passe=$8`,
    [req.params.mouvementId, v.numProforma, v.dateProforma || null, v.montantProforma, v.etatProforma, v.numTitre, v.etatChargement, v.vuPasse],
  );
  logAction(req.session.nom, "modification", "suivi fournisseur", `Suivi facture ${rows[0].achat_num_facture || ""}`);
  res.json(await etat(rows[0].societe_id));
});
