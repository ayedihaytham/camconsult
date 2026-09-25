import { Router } from "express";
import { z } from "zod";
import { query } from "../db.js";
import { requireAuth } from "../auth.js";
import { logAction } from "../journal.js";
import {
  suiviDeviseDto,
  suiviDeviseFullDto,
  suiviDeviseFactureDto,
  suiviDeviseMouvementDto,
} from "../mappers.js";

export const suiviDeviseRouter = Router();
suiviDeviseRouter.use(requireAuth);

/** Suivi client devise = données comptables internes, comme États
 * financiers : admin + collaborateurs de la société uniquement, jamais
 * l'employé de société cliente. */
function canAccess(session, societeId) {
  if (session.role === "admin") return true;
  if (session.poste === "societe_employe") return false;
  return (session.societeIds || []).includes(societeId);
}

async function loadSuiviOrFail(id, session, res) {
  const s = (await query("select * from suivi_devise where id = $1", [id])).rows[0];
  if (!s) {
    res.status(404).json({ error: "Fiche introuvable" });
    return null;
  }
  if (!canAccess(session, s.societe_id)) {
    res.status(403).json({ error: "Accès non autorisé" });
    return null;
  }
  return s;
}

async function loadFull(suiviId) {
  const [suivi, lots, factures, mouvements] = await Promise.all([
    query("select * from suivi_devise where id = $1", [suiviId]),
    query("select * from suivi_devise_lots where suivi_id = $1 order by ordre", [suiviId]),
    query("select * from suivi_devise_factures where suivi_id = $1 order by ordre", [suiviId]),
    query("select * from suivi_devise_mouvements where suivi_id = $1 order by ordre", [suiviId]),
  ]);
  return suiviDeviseFullDto(suivi.rows[0], lots.rows, factures.rows, mouvements.rows);
}

// ── Fiche (suivi_devise) ───────────────────────────
const createSchema = z.object({
  societeId: z.string().uuid(),
  client: z.string().min(1, "Client requis"),
  exercice: z.string().default(""),
  devise: z.string().default("EUR"),
  note: z.string().default(""),
  // Report manuel de l'exercice précédent (voir suivi_devise.solde_ouverture).
  soldeOuverture: z.coerce.number().default(0),
});

suiviDeviseRouter.get("/", async (req, res) => {
  const societeId = req.query.societeId;
  if (!societeId) return res.status(400).json({ error: "societeId requis" });
  if (!canAccess(req.session, societeId))
    return res.status(403).json({ error: "Accès non autorisé" });
  const { rows } = await query(
    "select * from suivi_devise where societe_id = $1 order by exercice desc, client",
    [societeId],
  );
  // Solde par fiche pour la liste — un aller-retour par fiche reste léger
  // (peu de fiches par société, comme les exercices de balance).
  const withSolde = await Promise.all(
    rows.map(async (r) => {
      const full = await loadFull(r.id);
      return { ...suiviDeviseDto(r), solde: full.solde, totalVentes: full.totalVentes };
    }),
  );
  res.json(withSolde);
});

suiviDeviseRouter.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0].message });
  const v = parsed.data;
  if (!canAccess(req.session, v.societeId))
    return res.status(403).json({ error: "Accès non autorisé" });

  const soc = (
    await query("select raison_sociale from societes where id = $1", [v.societeId])
  ).rows[0];
  if (!soc) return res.status(400).json({ error: "Société introuvable" });

  try {
    const { rows } = await query(
      `insert into suivi_devise (societe_id, client, exercice, devise, note, solde_ouverture)
       values ($1, $2, $3, $4, $5, $6) returning *`,
      [v.societeId, v.client, v.exercice, v.devise, v.note, v.soldeOuverture],
    );
    logAction(
      req.session.nom,
      "creation",
      "suivi_devise",
      `${v.client} — ${soc.raison_sociale}${v.exercice ? ` ${v.exercice}` : ""}`,
    );
    res.status(201).json(await loadFull(rows[0].id));
  } catch (err) {
    if (err.code === "23505")
      return res
        .status(409)
        .json({ error: "Une fiche existe déjà pour ce client, cet exercice et cette devise." });
    throw err;
  }
});

suiviDeviseRouter.get("/:id", async (req, res) => {
  const s = await loadSuiviOrFail(req.params.id, req.session, res);
  if (!s) return;
  res.json(await loadFull(s.id));
});

suiviDeviseRouter.patch("/:id", async (req, res) => {
  const existing = await loadSuiviOrFail(req.params.id, req.session, res);
  if (!existing) return;
  const parsed = createSchema.omit({ societeId: true }).partial().safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0].message });
  const v = parsed.data;
  try {
    await query(
      `update suivi_devise set
         client = coalesce($2, client),
         exercice = coalesce($3, exercice),
         devise = coalesce($4, devise),
         note = coalesce($5, note),
         solde_ouverture = coalesce($6, solde_ouverture),
         maj_le = now()
       where id = $1`,
      [
        req.params.id, v.client ?? null, v.exercice ?? null, v.devise ?? null, v.note ?? null,
        v.soldeOuverture ?? null,
      ],
    );
    logAction(req.session.nom, "modification", "suivi_devise", existing.client);
    res.json(await loadFull(req.params.id));
  } catch (err) {
    if (err.code === "23505")
      return res
        .status(409)
        .json({ error: "Une fiche existe déjà pour ce client, cet exercice et cette devise." });
    throw err;
  }
});

suiviDeviseRouter.delete("/:id", async (req, res) => {
  const existing = await loadSuiviOrFail(req.params.id, req.session, res);
  if (!existing) return;
  // Lots/factures/mouvements suivent par ON DELETE CASCADE (FK sur suivi_id).
  await query("delete from suivi_devise where id = $1", [req.params.id]);
  logAction(req.session.nom, "suppression", "suivi_devise", existing.client);
  res.json({ ok: true });
});

// ── Lots LC ─────────────────────────────────────────
// type : régime du lot — voir le commentaire sur suivi_devise_lots dans
// schema.sql pour le détail des deux formules ("charges_trans_av"/"avoir").
const lotSchema = z.object({
  libelle: z.string().default(""),
  quantiteTonnes: z.coerce.number().default(0),
  prixRendu: z.coerce.number().default(0),
  rabais: z.coerce.number().default(0),
  incoterm: z.string().default(""),
  type: z.enum(["aucun", "charges_trans_av", "avoir"]).default("aucun"),
  valeurReference: z.coerce.number().default(0),
});

suiviDeviseRouter.post("/:id/lots", async (req, res) => {
  const s = await loadSuiviOrFail(req.params.id, req.session, res);
  if (!s) return;
  const parsed = lotSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0].message });
  const v = parsed.data;
  await query(
    `insert into suivi_devise_lots
       (suivi_id, ordre, libelle, quantite_tonnes, prix_rendu, rabais, incoterm, type, valeur_reference)
     values ($1, (select coalesce(max(ordre), 0) + 1 from suivi_devise_lots where suivi_id = $1),
             $2, $3, $4, $5, $6, $7, $8)`,
    [
      req.params.id, v.libelle, v.quantiteTonnes, v.prixRendu, v.rabais, v.incoterm,
      v.type, v.valeurReference,
    ],
  );
  logAction(req.session.nom, "creation", "suivi_devise", `Lot ${v.libelle || ""} — ${s.client}`);
  res.status(201).json(await loadFull(req.params.id));
});

async function loadLotOrFail(lotId, session, res) {
  const l = (
    await query(
      `select l.*, s.societe_id, s.client, s.id as suivi_id_full
         from suivi_devise_lots l join suivi_devise s on s.id = l.suivi_id
        where l.id = $1`,
      [lotId],
    )
  ).rows[0];
  if (!l) {
    res.status(404).json({ error: "Lot introuvable" });
    return null;
  }
  if (!canAccess(session, l.societe_id)) {
    res.status(403).json({ error: "Accès non autorisé" });
    return null;
  }
  return l;
}

suiviDeviseRouter.patch("/lots/:lotId", async (req, res) => {
  const existing = await loadLotOrFail(req.params.lotId, req.session, res);
  if (!existing) return;
  const parsed = lotSchema.partial().safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0].message });
  const v = parsed.data;
  await query(
    `update suivi_devise_lots set
       libelle = coalesce($2, libelle),
       quantite_tonnes = coalesce($3, quantite_tonnes),
       prix_rendu = coalesce($4, prix_rendu),
       rabais = coalesce($5, rabais),
       incoterm = coalesce($6, incoterm),
       type = coalesce($7, type),
       valeur_reference = coalesce($8, valeur_reference)
     where id = $1`,
    [
      req.params.lotId, v.libelle ?? null, v.quantiteTonnes ?? null,
      v.prixRendu ?? null, v.rabais ?? null, v.incoterm ?? null,
      v.type ?? null, v.valeurReference ?? null,
    ],
  );
  logAction(req.session.nom, "modification", "suivi_devise", `Lot — ${existing.client}`);
  res.json(await loadFull(existing.suivi_id));
});

suiviDeviseRouter.delete("/lots/:lotId", async (req, res) => {
  const existing = await loadLotOrFail(req.params.lotId, req.session, res);
  if (!existing) return;
  // Factures/mouvements rattachés : lot_id repasse à null (ON DELETE SET NULL) — jamais supprimés.
  await query("delete from suivi_devise_lots where id = $1", [req.params.lotId]);
  logAction(req.session.nom, "suppression", "suivi_devise", `Lot — ${existing.client}`);
  res.json(await loadFull(existing.suivi_id));
});

// ── Factures ────────────────────────────────────────
const factureSchema = z.object({
  lotId: z.string().uuid().nullish(),
  nFacture: z.string().default(""),
  nSecondaire: z.string().default(""),
  dateFacture: z.string().nullish(),
  modePaiement: z.string().default(""),
  designationProduit: z.string().default(""),
  fournisseur: z.string().default(""),
  qteTonnes: z.coerce.number().default(0),
  pu: z.coerce.number().default(0),
  montantTotal: z.coerce.number().default(0),
  avoirMontant: z.coerce.number().nullish(),
  avoirDate: z.string().nullish(),
});

suiviDeviseRouter.post("/:id/factures", async (req, res) => {
  const s = await loadSuiviOrFail(req.params.id, req.session, res);
  if (!s) return;
  const parsed = factureSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0].message });
  const v = parsed.data;
  const { rows } = await query(
    `insert into suivi_devise_factures
       (suivi_id, lot_id, ordre, n_facture, n_secondaire, date_facture, mode_paiement,
        designation_produit, fournisseur, qte_tonnes, pu, montant_total, avoir_montant, avoir_date)
     values ($1, $2, (select coalesce(max(ordre), 0) + 1 from suivi_devise_factures where suivi_id = $1),
             $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     returning *`,
    [
      req.params.id, v.lotId ?? null, v.nFacture, v.nSecondaire, v.dateFacture || null,
      v.modePaiement, v.designationProduit, v.fournisseur, v.qteTonnes, v.pu, v.montantTotal,
      v.avoirMontant ?? null, v.avoirDate || null,
    ],
  );
  await query("update suivi_devise set maj_le = now() where id = $1", [req.params.id]);
  logAction(req.session.nom, "creation", "suivi_devise", `Facture ${v.nFacture || "—"} — ${s.client}`);
  res.status(201).json(await loadFull(req.params.id));
});

async function loadFactureOrFail(factureId, session, res) {
  const f = (
    await query(
      `select f.*, s.societe_id, s.client
         from suivi_devise_factures f join suivi_devise s on s.id = f.suivi_id
        where f.id = $1`,
      [factureId],
    )
  ).rows[0];
  if (!f) {
    res.status(404).json({ error: "Facture introuvable" });
    return null;
  }
  if (!canAccess(session, f.societe_id)) {
    res.status(403).json({ error: "Accès non autorisé" });
    return null;
  }
  return f;
}

suiviDeviseRouter.patch("/factures/:factureId", async (req, res) => {
  const existing = await loadFactureOrFail(req.params.factureId, req.session, res);
  if (!existing) return;
  const parsed = factureSchema.partial().safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0].message });
  const v = parsed.data;
  const merged = { ...suiviDeviseFactureDto(existing), ...v };
  await query(
    `update suivi_devise_factures set
       lot_id = $2, n_facture = $3, n_secondaire = $4, date_facture = $5, mode_paiement = $6,
       designation_produit = $7, fournisseur = $8, qte_tonnes = $9, pu = $10, montant_total = $11,
       avoir_montant = $12, avoir_date = $13
     where id = $1`,
    [
      req.params.factureId, merged.lotId ?? null, merged.nFacture, merged.nSecondaire,
      merged.dateFacture || null, merged.modePaiement, merged.designationProduit,
      merged.fournisseur, merged.qteTonnes, merged.pu, merged.montantTotal,
      merged.avoirMontant ?? null, merged.avoirDate || null,
    ],
  );
  await query("update suivi_devise set maj_le = now() where id = $1", [existing.suivi_id]);
  logAction(req.session.nom, "modification", "suivi_devise", `Facture — ${existing.client}`);
  res.json(await loadFull(existing.suivi_id));
});

suiviDeviseRouter.delete("/factures/:factureId", async (req, res) => {
  const existing = await loadFactureOrFail(req.params.factureId, req.session, res);
  if (!existing) return;
  await query("delete from suivi_devise_factures where id = $1", [req.params.factureId]);
  logAction(req.session.nom, "suppression", "suivi_devise", `Facture — ${existing.client}`);
  res.json(await loadFull(existing.suivi_id));
});

// ── Mouvements (charges transport / avoirs / règlements) ──
const mouvementSchema = z.object({
  lotId: z.string().uuid().nullish(),
  type: z.enum(["charge_transport", "avoir", "reglement"]).default("reglement"),
  libelle: z.string().default(""),
  date: z.string().nullish(),
  montant: z.coerce.number().default(0),
});

suiviDeviseRouter.post("/:id/mouvements", async (req, res) => {
  const s = await loadSuiviOrFail(req.params.id, req.session, res);
  if (!s) return;
  const parsed = mouvementSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0].message });
  const v = parsed.data;
  await query(
    `insert into suivi_devise_mouvements (suivi_id, lot_id, ordre, type, libelle, date, montant)
     values ($1, $2, (select coalesce(max(ordre), 0) + 1 from suivi_devise_mouvements where suivi_id = $1),
             $3, $4, $5, $6)`,
    [req.params.id, v.lotId ?? null, v.type, v.libelle, v.date || null, v.montant],
  );
  await query("update suivi_devise set maj_le = now() where id = $1", [req.params.id]);
  logAction(req.session.nom, "creation", "suivi_devise", `Mouvement (${v.type}) — ${s.client}`);
  res.status(201).json(await loadFull(req.params.id));
});

async function loadMouvementOrFail(mouvementId, session, res) {
  const m = (
    await query(
      `select mv.*, s.societe_id, s.client
         from suivi_devise_mouvements mv join suivi_devise s on s.id = mv.suivi_id
        where mv.id = $1`,
      [mouvementId],
    )
  ).rows[0];
  if (!m) {
    res.status(404).json({ error: "Mouvement introuvable" });
    return null;
  }
  if (!canAccess(session, m.societe_id)) {
    res.status(403).json({ error: "Accès non autorisé" });
    return null;
  }
  return m;
}

suiviDeviseRouter.patch("/mouvements/:mouvementId", async (req, res) => {
  const existing = await loadMouvementOrFail(req.params.mouvementId, req.session, res);
  if (!existing) return;
  const parsed = mouvementSchema.partial().safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0].message });
  const v = parsed.data;
  const merged = { ...suiviDeviseMouvementDto(existing), ...v };
  await query(
    `update suivi_devise_mouvements set lot_id = $2, type = $3, libelle = $4, date = $5, montant = $6
     where id = $1`,
    [req.params.mouvementId, merged.lotId ?? null, merged.type, merged.libelle, merged.date || null, merged.montant],
  );
  await query("update suivi_devise set maj_le = now() where id = $1", [existing.suivi_id]);
  logAction(req.session.nom, "modification", "suivi_devise", `Mouvement — ${existing.client}`);
  res.json(await loadFull(existing.suivi_id));
});

suiviDeviseRouter.delete("/mouvements/:mouvementId", async (req, res) => {
  const existing = await loadMouvementOrFail(req.params.mouvementId, req.session, res);
  if (!existing) return;
  await query("delete from suivi_devise_mouvements where id = $1", [req.params.mouvementId]);
  logAction(req.session.nom, "suppression", "suivi_devise", `Mouvement — ${existing.client}`);
  res.json(await loadFull(existing.suivi_id));
});
