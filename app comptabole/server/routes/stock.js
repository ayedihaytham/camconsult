import { Router } from "express";
import { z } from "zod";
import { query } from "../db.js";
import { withApurementTransaction as withTransaction } from "../apurement/notifications.js";
import { requireAuth } from "../auth.js";
import { logAction } from "../journal.js";
import { stockMouvementDto } from "../mappers.js";
import { syntheseStock } from "../stockSynthese.js";
import { extractDocument, extractPages } from "../ocr.js";
import { ruspinaApplies } from "../ruspinaOcr.js";
import { randomUUID } from "node:crypto";
import { safeRouter } from "../asyncRoutes.js";
import { persistStock, deleteStock } from "../stock/stockService.js";

export const stockRouter = safeRouter(Router());
stockRouter.use(requireAuth);

/** Stock = données comptables internes : admin + responsable des collaborateurs (toutes les sociétés) + collaborateurs de la société. Jamais le client. */
function canAccess(session, societeId) {
  if (session.role === "admin" || session.poste === "responsable_collaborateurs") return true;
  if (session.poste === "societe_employe") return false;
  return (session.societeIds || []).includes(societeId);
}

const num = z.coerce.number().default(0);
const dateStr = z.string().nullish();

// Une facture peut lister plusieurs marchandises/quantités, pas une seule —
// voir stock_lignes (schema.sql) et le commentaire sur stockMouvementDto.
const ligneSchema = z.object({
  designation: z.string().default(""),
  quantite: num,
  prixUnitaire: num,
  montantDevise: num,
  montantTnd: num,
  unite: z.string().default("").transform((u) => u.trim().toUpperCase().slice(0, 8)),
});

const schema = z.object({
  societeId: z.string().uuid(),
  apurementRevision: z.string().regex(/^\d+$/).optional(),
  // Retrait de la facture d'achat avec suppression de ses règlements (Suivi fournisseur), demandée expressément à l'écran.
  supprimerReglements: z.boolean().optional(),
  natureMarchandise: z.string().default(""),

  achatDate: dateStr,
  achatNumFacture: z.string().default(""),
  achatDocType: z.string().default(""),
  fournisseur: z.string().default(""),
  achatDevise: z.string().default("EUR"),
  achatCours: num,
  achatCoursUsd: num,
  achatLignes: z.array(ligneSchema).default([]),

  venteDate: dateStr,
  venteNumFacture: z.string().default(""),
  venteDocType: z.string().default(""),
  client: z.string().default(""),
  venteDevise: z.string().default("EUR"),
  venteCours: num,
  venteCoursUsd: num,
  venteLignes: z.array(ligneSchema).default([]),

  douaneNumDeclaration: z.string().default(""),
  douaneDate: dateStr,
  douaneRegime: z.string().default(""),
  douaneTypeDeclaration: z.string().default(""),
  douaneReference: z.string().default(""),
  douaneTauxChange: num,
  douaneValeurTnd: num,
  douanePtfn: num,
  douaneExportateur: z.string().default(""),
  douaneImportateur: z.string().default(""),

  achatDocDataUrl: z.string().nullish(),
  venteDocDataUrl: z.string().nullish(),
  douaneDocDataUrl: z.string().nullish(),

  note: z.string().default(""),
});

// Colonnes "en-tête" de stock_mouvements — le détail produit (quantité, PU,
// montants) vit dans stock_lignes, jamais ici (voir replaceLignes).
const COL_NAMES = [
  "societe_id", "nature_marchandise",
  "achat_date", "achat_num_facture", "achat_doc_type", "fournisseur", "achat_devise", "achat_cours", "achat_cours_usd",
  "vente_date", "vente_num_facture", "vente_doc_type", "client", "vente_devise", "vente_cours", "vente_cours_usd",
  "douane_num_declaration", "douane_date", "douane_regime", "douane_type_declaration", "douane_reference",
  "douane_taux_change", "douane_valeur_tnd", "douane_ptfn", "douane_exportateur", "douane_importateur",
  "achat_doc_data_url", "vente_doc_data_url", "douane_doc_data_url",
  "note",
];

function values(v) {
  return [
    v.societeId, v.natureMarchandise,
    v.achatDate || null, v.achatNumFacture, v.achatDocType, v.fournisseur, v.achatDevise, v.achatCours, v.achatCoursUsd,
    v.venteDate || null, v.venteNumFacture, v.venteDocType, v.client, v.venteDevise, v.venteCours, v.venteCoursUsd,
    v.douaneNumDeclaration, v.douaneDate || null, v.douaneRegime, v.douaneTypeDeclaration, v.douaneReference,
    v.douaneTauxChange, v.douaneValeurTnd, v.douanePtfn, v.douaneExportateur, v.douaneImportateur,
    v.achatDocDataUrl || null, v.venteDocDataUrl || null, v.douaneDocDataUrl || null,
    v.note,
  ];
}

async function lignesOf(mouvementId) {
  const { rows } = await query(
    "select * from stock_lignes where mouvement_id = $1 order by ordre",
    [mouvementId],
  );
  return rows;
}

// Nombre de mouvements par société accessible (liste des sociétés du module).
stockRouter.get("/compteurs", async (req, res) => {
  const { rows } = await query(
    "select societe_id, count(*)::int as n from stock_mouvements group by societe_id",
  );
  const counts = {};
  for (const r of rows) if (canAccess(req.session, r.societe_id)) counts[r.societe_id] = r.n;
  res.json(counts);
});

// Synthèse par société accessible (accueil du module) : mouvements, dernier mouvement, valeur du stock, alertes, cours à saisir.
// Deux requêtes pour toutes les sociétés, sans les documents joints.
stockRouter.get("/synthese", async (req, res) => {
  const { rows: mouvements } = await query(
    `select id, societe_id, ordre, achat_devise, achat_cours, vente_devise, vente_cours, cree_le, maj_le
       from stock_mouvements`,
  );
  const visibles = mouvements.filter((m) => canAccess(req.session, m.societe_id));
  const { rows: lignes } = await query(
    "select * from stock_lignes where mouvement_id = any($1::uuid[])",
    [visibles.map((m) => m.id)],
  );
  res.json(syntheseStock(visibles, lignes));
});

stockRouter.get("/mouvements", async (req, res) => {
  const societeId = req.query.societeId;
  if (!societeId) return res.status(400).json({ error: "societeId requis" });
  if (!canAccess(req.session, societeId))
    return res.status(403).json({ error: "Accès au stock non autorisé" });
  const { rows } = await query(
    "select * from stock_mouvements where societe_id = $1 order by ordre, cree_le",
    [societeId],
  );
  const { rows: lignes } = await query(
    "select * from stock_lignes where mouvement_id = any($1::uuid[]) order by ordre",
    [rows.map((r) => r.id)],
  );
  const lignesByMouvement = new Map();
  for (const l of lignes) {
    const arr = lignesByMouvement.get(l.mouvement_id) ?? [];
    arr.push(l);
    lignesByMouvement.set(l.mouvement_id, arr);
  }
  res.json(rows.map((r) => stockMouvementDto(r, lignesByMouvement.get(r.id) ?? [])));
});

stockRouter.post("/mouvements", async (req, res) => {
  const debut = Date.now();
  const parsed = schema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0].message });
  const v = parsed.data;
  if (!canAccess(req.session, v.societeId))
    return res.status(403).json({ error: "Accès au stock non autorisé" });

  const soc = (
    await query("select raison_sociale from societes where id = $1", [v.societeId])
  ).rows[0];
  if (!soc) return res.status(400).json({ error: "Société introuvable" });

  const { rows: ordreRows } = await query(
    "select coalesce(max(ordre), 0) + 1 as n from stock_mouvements where societe_id = $1",
    [v.societeId],
  );

  const allCols = [...COL_NAMES, "ordre"];
  const allVals = [...values(v), ordreRows[0].n];
  const row = await withTransaction(client => persistStock(client, {
    columns: allCols, values: allVals, achatLignes: v.achatLignes,
    venteLignes: v.venteLignes, session: req.session, societeId: v.societeId,
  }));

  logAction(
    req.session.nom,
    "creation",
    "stock",
    `${v.natureMarchandise || "Mouvement"} — ${soc.raison_sociale}`,
  );
  console.log(`[stock] mouvement créé en ${Date.now() - debut} ms (${(Number(req.headers["content-length"] || 0) / 1048576).toFixed(1)} Mo reçus)`);
  res.status(201).json(stockMouvementDto(row, await lignesOf(row.id)));
});

stockRouter.patch("/mouvements/:id", async (req, res) => {
  const existing = (
    await query("select * from stock_mouvements where id = $1", [req.params.id])
  ).rows[0];
  if (!existing) return res.status(404).json({ error: "Mouvement introuvable" });
  if (!canAccess(req.session, existing.societe_id))
    return res.status(403).json({ error: "Accès au stock non autorisé" });

  const merged = schema.partial().safeParse(req.body);
  if (!merged.success)
    return res.status(400).json({ error: merged.error.issues[0].message });
  const existingDto = stockMouvementDto(existing, await lignesOf(existing.id));
  const v = { ...existingDto, societeId: existing.societe_id, ...merged.data };

  const updCols = COL_NAMES.filter((c) => c !== "societe_id");
  const resume = {};
  const row = await withTransaction(client => persistStock(client, {
    id: req.params.id, columns: updCols, values: values(v).slice(1),
    achatLignes: v.achatLignes, venteLignes: v.venteLignes,
    session: req.session, expectedRevision: merged.data.apurementRevision ?? existing.apurement_revision,
    revisionProvided: merged.data.apurementRevision !== undefined,
    societeId: existing.societe_id,
    apresAchat: { fournisseur: v.fournisseur, achatDevise: v.achatDevise, achatLignes: v.achatLignes },
    supprimerReglements: merged.data.supprimerReglements === true,
    resume,
  }));

  logAction(
    req.session.nom,
    "modification",
    "stock",
    `${v.natureMarchandise || "Mouvement"}${resume.detache ? ` — ${resume.detache.touches} règlement(s) détaché(s), ${resume.detache.supprimes} supprimé(s)` : ""}`,
  );
  res.json(stockMouvementDto(row, await lignesOf(row.id)));
});

stockRouter.delete("/mouvements/:id", async (req, res) => {
  const existing = (
    await query("select * from stock_mouvements where id = $1", [req.params.id])
  ).rows[0];
  if (!existing) return res.status(404).json({ error: "Mouvement introuvable" });
  if (!canAccess(req.session, existing.societe_id))
    return res.status(403).json({ error: "Accès au stock non autorisé" });
  const detache = await withTransaction(client => deleteStock(client, req.params.id, existing.societe_id, { supprimerReglements: req.query.supprimerReglements === "true" }));
  logAction(
    req.session.nom,
    "suppression",
    "stock",
    `${existing.nature_marchandise || "Mouvement"}${detache ? ` — avec ${detache.touches} règlement(s) (${detache.supprimes} supprimé(s))` : ""}`,
  );
  res.json({ ok: true });
});

// ── Extraction automatique ────────────────────────
//
// Aucun OCR local : la lecture est faite par le moteur RUSPINA ou par un
// modèle de vision (voir ocr.js). Deux chemins :
//  - société couverte par le moteur RUSPINA (voir ruspinaOcr.js) : la lecture
//    prend de quelques dizaines de secondes à plusieurs minutes (OCR sur CPU),
//    bien au-delà du délai d'un proxy HTTP. La requête répond donc tout de
//    suite `202 { jobId }` et l'écran interroge `GET /extract-jobs/:id` ;
//  - autres sociétés (modèle de vision) : réponse directe.

/** Tâches d'extraction en cours ou terminées (mémoire du processus, 30 min). */
const JOB_TTL_MS = 30 * 60_000;
const jobs = new Map();

function sessionKey(session) {
  return String(session.employeId ?? session.identifiant ?? session.nom ?? session.role);
}

function purgeJobs() {
  const limit = Date.now() - JOB_TTL_MS;
  for (const [id, job] of jobs) if (job.createdAt < limit) jobs.delete(id);
}

function startJob(session, work) {
  purgeJobs();
  const id = randomUUID();
  const job = { id, owner: sessionKey(session), status: "pending", createdAt: Date.now() };
  jobs.set(id, job);
  work().then(
    (result) => Object.assign(job, { status: "done", result }),
    (err) => {
      console.error("[stock/extract-job]", err);
      Object.assign(job, { status: "error", error: messageExtraction(err) });
    },
  );
  return id;
}

/** Message montré à l'utilisateur : précis quand aucun moteur n'est configuré,
 * générique sinon (le détail reste dans le journal du serveur). */
function messageExtraction(err) {
  return err?.code === "EXTRACTION_UNAVAILABLE" ? err.message : "Extraction impossible sur ce document.";
}

function reponseErreurExtraction(res, err) {
  res.status(err?.code === "EXTRACTION_UNAVAILABLE" ? 503 : 500).json({ error: messageExtraction(err) });
}

stockRouter.get("/extract-jobs/:id", (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job || job.owner !== sessionKey(req.session))
    return res.status(404).json({ error: "Extraction introuvable ou expirée" });
  if (job.status === "pending") return res.json({ status: "pending" });
  if (job.status === "error") return res.json({ status: "error", error: job.error });
  res.json({ status: "done", result: job.result });
});

async function raisonSocialeAccessible(session, societeId) {
  if (!canAccess(session, societeId)) return { denied: true };
  const soc = (
    await query("select raison_sociale from societes where id = $1", [societeId])
  ).rows[0];
  return soc ? { raisonSociale: soc.raison_sociale } : { missing: true };
}

const extractSchema = z.object({
  type: z.enum(["achat", "vente", "douane"]),
  dataUrl: z.string().min(10),
  // Permet de choisir le bon moteur d'extraction pour la société concernée.
  societeId: z.string().uuid().optional(),
});

stockRouter.post("/extract", async (req, res) => {
  const parsed = extractSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0].message });
  // L'extraction appelle un service d'IA payant : jamais pour un compte de société cliente, même sans société précisée.
  if (req.session.poste === "societe_employe") return res.status(403).json({ error: "Accès au stock non autorisé" });
  try {
    let raisonSociale;
    if (parsed.data.societeId) {
      const soc = await raisonSocialeAccessible(req.session, parsed.data.societeId);
      if (soc.denied) return res.status(403).json({ error: "Accès au stock non autorisé" });
      if (soc.missing) return res.status(400).json({ error: "Société introuvable" });
      raisonSociale = soc.raisonSociale;
    }
    if (ruspinaApplies(raisonSociale)) {
      const jobId = startJob(req.session, () =>
        extractDocument(parsed.data.dataUrl, parsed.data.type, raisonSociale),
      );
      return res.status(202).json({ jobId });
    }
    const result = await extractDocument(parsed.data.dataUrl, parsed.data.type, raisonSociale);
    res.json(result);
  } catch (err) {
    console.error("[stock/extract]", err);
    reponseErreurExtraction(res, err);
  }
});

// ── Import "document complet" : un PDF combinant plusieurs pièces ──
// (ex. facture d'achat + facture de vente + déclaration douanière scannées
// ensemble) — chaque page est analysée séparément et son type deviné, à
// confirmer/corriger à l'écran avant application (voir StockMouvementFormSheet).
const extractPagesSchema = z.object({
  societeId: z.string().uuid(),
  dataUrl: z.string().min(10),
});

function pagesPourEcran(pages) {
  return {
    pages: pages.map((p) => ({
      index: p.index,
      imageDataUrl: p.imageDataUrl,
      guessedType: p.type,
      confidence: p.confidence,
      // Calculés pour les 3 types dès l'extraction (voir ocr.js) : quand
      // l'utilisateur corrige le type deviné à l'écran, le bon jeu de
      // champs est déjà prêt, sans aller-retour serveur ni ré-OCR.
      champsByType: p.champsByType,
      ...(p.details ? { details: p.details } : {}),
    })),
  };
}

stockRouter.post("/extract-pages", async (req, res) => {
  const parsed = extractPagesSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0].message });
  const soc = await raisonSocialeAccessible(req.session, parsed.data.societeId);
  if (soc.denied) return res.status(403).json({ error: "Accès au stock non autorisé" });
  if (soc.missing) return res.status(400).json({ error: "Société introuvable" });

  try {
    if (ruspinaApplies(soc.raisonSociale)) {
      const jobId = startJob(req.session, async () =>
        pagesPourEcran(await extractPages(parsed.data.dataUrl, soc.raisonSociale)),
      );
      return res.status(202).json({ jobId });
    }
    const pages = await extractPages(parsed.data.dataUrl, soc.raisonSociale);
    res.json(pagesPourEcran(pages));
  } catch (err) {
    console.error("[stock/extract-pages]", err);
    reponseErreurExtraction(res, err);
  }
});

stockRouter.use((err, _req, res, next) => {
  if (!err.status) return next(err);
  res.status(err.status).json({ error: err.message, code: err.code });
});
