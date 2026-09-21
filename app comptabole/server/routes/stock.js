import { Router } from "express";
import { z } from "zod";
import { query, withTransaction } from "../db.js";
import { requireAuth } from "../auth.js";
import { logAction } from "../journal.js";
import { stockMouvementDto } from "../mappers.js";
import { extractDocument, extractPages } from "../ocr.js";

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

// Une facture peut lister plusieurs marchandises/quantités, pas une seule —
// voir stock_lignes (schema.sql) et le commentaire sur stockMouvementDto.
const ligneSchema = z.object({
  designation: z.string().default(""),
  quantite: num,
  prixUnitaire: num,
  montantDevise: num,
  montantTnd: num,
});

const schema = z.object({
  societeId: z.string().uuid(),
  natureMarchandise: z.string().default(""),

  achatDate: dateStr,
  achatNumFacture: z.string().default(""),
  achatDocType: z.string().default(""),
  fournisseur: z.string().default(""),
  achatDevise: z.string().default("EUR"),
  achatCours: num,
  achatLignes: z.array(ligneSchema).default([]),

  venteDate: dateStr,
  venteNumFacture: z.string().default(""),
  venteDocType: z.string().default(""),
  client: z.string().default(""),
  venteDevise: z.string().default("EUR"),
  venteCours: num,
  venteLignes: z.array(ligneSchema).default([]),

  douaneNumDeclaration: z.string().default(""),
  douaneDate: dateStr,
  douaneRegime: z.string().default(""),
  douaneReference: z.string().default(""),

  achatDocDataUrl: z.string().nullish(),
  venteDocDataUrl: z.string().nullish(),
  douaneDocDataUrl: z.string().nullish(),

  note: z.string().default(""),
});

// Colonnes "en-tête" de stock_mouvements — le détail produit (quantité, PU,
// montants) vit dans stock_lignes, jamais ici (voir replaceLignes).
const COL_NAMES = [
  "societe_id", "nature_marchandise",
  "achat_date", "achat_num_facture", "achat_doc_type", "fournisseur", "achat_devise", "achat_cours",
  "vente_date", "vente_num_facture", "vente_doc_type", "client", "vente_devise", "vente_cours",
  "douane_num_declaration", "douane_date", "douane_regime", "douane_reference",
  "achat_doc_data_url", "vente_doc_data_url", "douane_doc_data_url",
  "note",
];

function values(v) {
  return [
    v.societeId, v.natureMarchandise,
    v.achatDate || null, v.achatNumFacture, v.achatDocType, v.fournisseur, v.achatDevise, v.achatCours,
    v.venteDate || null, v.venteNumFacture, v.venteDocType, v.client, v.venteDevise, v.venteCours,
    v.douaneNumDeclaration, v.douaneDate || null, v.douaneRegime, v.douaneReference,
    v.achatDocDataUrl || null, v.venteDocDataUrl || null, v.douaneDocDataUrl || null,
    v.note,
  ];
}

/** Remplace toutes les lignes d'une catégorie (achat ou vente) d'un
 * mouvement : supprime puis réinsère dans l'ordre donné — plus simple et
 * plus sûr que de diffier ligne à ligne (id présents ou non, réordre…). */
async function replaceLignes(client, mouvementId, categorie, lignes) {
  await client.query(
    "delete from stock_lignes where mouvement_id = $1 and categorie = $2",
    [mouvementId, categorie],
  );
  for (let i = 0; i < lignes.length; i++) {
    const l = lignes[i];
    await client.query(
      `insert into stock_lignes (mouvement_id, categorie, ordre, designation, quantite, prix_unitaire, montant_devise, montant_tnd)
       values ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [mouvementId, categorie, i, l.designation, l.quantite, l.prixUnitaire, l.montantDevise, l.montantTnd],
    );
  }
}

async function lignesOf(mouvementId) {
  const { rows } = await query(
    "select * from stock_lignes where mouvement_id = $1 order by ordre",
    [mouvementId],
  );
  return rows;
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
  const row = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `insert into stock_mouvements (${allCols.join(", ")})
       values (${allVals.map((_, i) => `$${i + 1}`).join(", ")})
       returning *`,
      allVals,
    );
    await replaceLignes(client, rows[0].id, "achat", v.achatLignes);
    await replaceLignes(client, rows[0].id, "vente", v.venteLignes);
    return rows[0];
  });

  logAction(
    req.session.nom,
    "creation",
    "stock",
    `${v.natureMarchandise || "Mouvement"} — ${soc.raison_sociale}`,
  );
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
  const updVals = values(v).slice(1); // sans societe_id (jamais réaffecté)
  const setClause = updCols
    .map((c, i) => `${c} = $${i + 2}`)
    .concat("maj_le = now()")
    .join(", ");
  const row = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `update stock_mouvements set ${setClause} where id = $1 returning *`,
      [req.params.id, ...updVals],
    );
    await replaceLignes(client, req.params.id, "achat", v.achatLignes);
    await replaceLignes(client, req.params.id, "vente", v.venteLignes);
    return rows[0];
  });

  logAction(
    req.session.nom,
    "modification",
    "stock",
    v.natureMarchandise || "Mouvement",
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
        // Calculés pour les 3 types dès l'extraction (voir ocr.js) : quand
        // l'utilisateur corrige le type deviné à l'écran, le bon jeu de
        // champs est déjà prêt, sans aller-retour serveur ni ré-OCR.
        champsByType: p.champsByType,
      })),
    });
  } catch (err) {
    console.error("[stock/extract-pages]", err);
    res.status(500).json({ error: "Extraction impossible sur ce document." });
  }
});
