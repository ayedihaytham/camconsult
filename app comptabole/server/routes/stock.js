import { Router } from "express";
import { z } from "zod";
import { query } from "../db.js";
import { requireAuth } from "../auth.js";
import { logAction } from "../journal.js";
import { stockMouvementDto } from "../mappers.js";
import { extractDocument, extractPages, parseFields } from "../ocr.js";

export const stockRouter = Router();
stockRouter.use(requireAuth);

/** Stock = données comptables internes : admin + collaborateurs de la société. Jamais le client. */
function canAccess(session, societeId) {
  if (session.role === "admin") return true;
  if (session.poste === "societe_employe") return false;
  return (session.societeIds || []).includes(societeId);
}

const num = z.coerce.number().default(0);
const dateStr = z.string().nullish();

const schema = z.object({
  societeId: z.string().uuid(),
  natureMarchandise: z.string().default(""),

  achatDate: dateStr,
  achatNumFacture: z.string().default(""),
  achatDocType: z.string().default(""),
  fournisseur: z.string().default(""),
  achatQuantite: num,
  achatPu: num,
  achatMontantDevise: num,
  achatDevise: z.string().default("EUR"),
  achatCours: num,
  achatMontantTnd: num,

  venteDate: dateStr,
  venteNumFacture: z.string().default(""),
  venteDocType: z.string().default(""),
  client: z.string().default(""),
  venteQuantite: num,
  ventePu: num,
  venteMontantDevise: num,
  venteDevise: z.string().default("EUR"),
  venteCours: num,
  venteMontantTnd: num,

  douaneNumDeclaration: z.string().default(""),
  douaneDate: dateStr,
  douaneRegime: z.string().default(""),
  douaneReference: z.string().default(""),

  achatDocDataUrl: z.string().nullish(),
  venteDocDataUrl: z.string().nullish(),
  douaneDocDataUrl: z.string().nullish(),

  note: z.string().default(""),
});

const COL_NAMES = [
  "societe_id", "nature_marchandise",
  "achat_date", "achat_num_facture", "achat_doc_type", "fournisseur", "achat_quantite", "achat_pu",
  "achat_montant_devise", "achat_devise", "achat_cours", "achat_montant_tnd",
  "vente_date", "vente_num_facture", "vente_doc_type", "client", "vente_quantite", "vente_pu",
  "vente_montant_devise", "vente_devise", "vente_cours", "vente_montant_tnd",
  "douane_num_declaration", "douane_date", "douane_regime", "douane_reference",
  "achat_doc_data_url", "vente_doc_data_url", "douane_doc_data_url",
  "note",
];

function values(v) {
  return [
    v.societeId, v.natureMarchandise,
    v.achatDate || null, v.achatNumFacture, v.achatDocType, v.fournisseur, v.achatQuantite, v.achatPu,
    v.achatMontantDevise, v.achatDevise, v.achatCours, v.achatMontantTnd,
    v.venteDate || null, v.venteNumFacture, v.venteDocType, v.client, v.venteQuantite, v.ventePu,
    v.venteMontantDevise, v.venteDevise, v.venteCours, v.venteMontantTnd,
    v.douaneNumDeclaration, v.douaneDate || null, v.douaneRegime, v.douaneReference,
    v.achatDocDataUrl || null, v.venteDocDataUrl || null, v.douaneDocDataUrl || null,
    v.note,
  ];
}

stockRouter.get("/mouvements", async (req, res) => {
  const societeId = req.query.societeId;
  if (!societeId) return res.status(400).json({ error: "societeId requis" });
  if (!canAccess(req.session, societeId))
    return res.status(403).json({ error: "Accès au stock non autorisé" });
  const { rows } = await query(
    "select * from stock_mouvements where societe_id = $1 order by ordre, cree_le",
    [societeId],
  );
  res.json(rows.map(stockMouvementDto));
});

stockRouter.post("/mouvements", async (req, res) => {
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
  const { rows } = await query(
    `insert into stock_mouvements (${allCols.join(", ")})
     values (${allVals.map((_, i) => `$${i + 1}`).join(", ")})
     returning *`,
    allVals,
  );
  logAction(
    req.session.nom,
    "creation",
    "stock",
    `${v.natureMarchandise || "Mouvement"} — ${soc.raison_sociale}`,
  );
  res.status(201).json(stockMouvementDto(rows[0]));
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
  const v = { ...stockMouvementDto(existing), societeId: existing.societe_id, ...merged.data };

  const updCols = COL_NAMES.filter((c) => c !== "societe_id");
  const updVals = values(v).slice(1); // sans societe_id (jamais réaffecté)
  const setClause = updCols
    .map((c, i) => `${c} = $${i + 2}`)
    .concat("maj_le = now()")
    .join(", ");
  const { rows } = await query(
    `update stock_mouvements set ${setClause} where id = $1 returning *`,
    [req.params.id, ...updVals],
  );
  logAction(
    req.session.nom,
    "modification",
    "stock",
    v.natureMarchandise || "Mouvement",
  );
  res.json(stockMouvementDto(rows[0]));
});

stockRouter.delete("/mouvements/:id", async (req, res) => {
  const existing = (
    await query("select * from stock_mouvements where id = $1", [req.params.id])
  ).rows[0];
  if (!existing) return res.status(404).json({ error: "Mouvement introuvable" });
  if (!canAccess(req.session, existing.societe_id))
    return res.status(403).json({ error: "Accès au stock non autorisé" });
  await query("delete from stock_mouvements where id = $1", [req.params.id]);
  logAction(
    req.session.nom,
    "suppression",
    "stock",
    existing.nature_marchandise || "Mouvement",
  );
  res.json({ ok: true });
});

// ── Extraction automatique (OCR local) ────────────
const extractSchema = z.object({
  type: z.enum(["achat", "vente", "douane"]),
  dataUrl: z.string().min(10),
});

stockRouter.post("/extract", async (req, res) => {
  const parsed = extractSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0].message });
  try {
    const result = await extractDocument(parsed.data.dataUrl, parsed.data.type);
    res.json(result);
  } catch (err) {
    console.error("[stock/extract]", err);
    res.status(500).json({ error: "Extraction impossible sur ce document." });
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

stockRouter.post("/extract-pages", async (req, res) => {
  const parsed = extractPagesSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0].message });
  if (!canAccess(req.session, parsed.data.societeId))
    return res.status(403).json({ error: "Accès au stock non autorisé" });

  const soc = (
    await query("select raison_sociale from societes where id = $1", [parsed.data.societeId])
  ).rows[0];
  if (!soc) return res.status(400).json({ error: "Société introuvable" });

  try {
    const pages = await extractPages(parsed.data.dataUrl, soc.raison_sociale);
    res.json({
      pages: pages.map((p) => ({
        index: p.index,
        imageDataUrl: p.imageDataUrl,
        guessedType: p.type,
        confidence: p.confidence,
        texte: p.texte,
        champs: p.type ? parseFields(p.texte, p.type) : null,
      })),
    });
  } catch (err) {
    console.error("[stock/extract-pages]", err);
    res.status(500).json({ error: "Extraction impossible sur ce document." });
  }
});

/** Recalcule les champs d'une page déjà OCRisée pour un type différent de
 * celui deviné (l'utilisateur corrige le type dans l'écran) — pas d'OCR à
 * relancer, juste les heuristiques (rapide). */
const parseFieldsSchema = z.object({
  texte: z.string(),
  type: z.enum(["achat", "vente", "douane"]),
});

stockRouter.post("/parse-fields", (req, res) => {
  const parsed = parseFieldsSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0].message });
  res.json({ champs: parseFields(parsed.data.texte, parsed.data.type) });
});
