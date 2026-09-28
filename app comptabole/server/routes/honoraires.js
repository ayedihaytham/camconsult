import { Router } from "express";
import { z } from "zod";
import { query, withTransaction } from "../db.js";
import { requireAuth, requireAdmin } from "../auth.js";
import { logAction } from "../journal.js";
import { honoraireLignesDto, HONORAIRE_COLONNES_LEGERES } from "../mappers.js";

/** État client (honoraires) — écriture réservée à l'admin. Lecture seule
 * (liste + téléchargement des pièces jointes) aussi pour le RESPONSABLE de la
 * société concernée — jamais un délégué, jamais une autre société. */
export const honorairesRouter = Router();
honorairesRouter.use(requireAuth);

const isResponsableSociete = (s) => s.poste === "societe_employe" && !s.delegue;
const canRead = (s, societeId) =>
  s.role === "admin" ||
  (isResponsableSociete(s) && (s.societeIds || []).includes(societeId));

const TYPES = [
  "mensuelle",
  "trimestrielle",
  "annuelle",
  "acompte1",
  "acompte2",
  "acompte3",
  "autre",
];

const schema = z.object({
  societeId: z.string().uuid(),
  type: z.enum(TYPES).default("mensuelle"),
  nature: z.string().default(""),
  periode: z.string().default(""),
  libelle: z.string().default(""),
  cnss: z.string().default(""),
  numQuittance: z.string().default(""),
  montantDeclaration: z.coerce.number().default(0),
  honoraire: z.coerce.number().default(0),
  reglement: z.coerce.number().default(0),
  note: z.string().default(""),
  // Pièce jointe : pieceDataUrl absent = inchangée (PATCH), null = retirée,
  // chaîne = remplacée. ~8 Mo de fichier au maximum (base64 ≈ ×1,37).
  pieceNom: z.string().default(""),
  pieceFormat: z.string().default(""),
  pieceTaille: z.string().default(""),
  pieceDataUrl: z
    .string()
    .max(12_500_000, "Fichier trop volumineux (8 Mo maximum)")
    .nullish(),
});

async function lignesFor(societeId) {
  const { rows } = await query(
    `select ${HONORAIRE_COLONNES_LEGERES} from honoraires_lignes where societe_id = $1 order by ordre, cree_le`,
    [societeId],
  );
  return honoraireLignesDto(rows);
}

honorairesRouter.get("/", async (req, res) => {
  const societeId = req.query.societeId;
  if (!societeId) return res.status(400).json({ error: "societeId requis" });
  if (!canRead(req.session, societeId))
    return res.status(403).json({ error: "Accès non autorisé" });
  res.json(await lignesFor(societeId));
});

honorairesRouter.post("/", requireAdmin, async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0].message });
  const v = parsed.data;
  const soc = (
    await query("select raison_sociale from societes where id = $1", [v.societeId])
  ).rows[0];
  if (!soc) return res.status(400).json({ error: "Société introuvable" });

  const { rows: ordreRows } = await query(
    "select coalesce(max(ordre), 0) + 1 as n from honoraires_lignes where societe_id = $1",
    [v.societeId],
  );

  await query(
    `insert into honoraires_lignes
       (societe_id, ordre, type, nature, periode, libelle, cnss, num_quittance,
        montant_declaration, honoraire, reglement, note,
        piece_nom, piece_format, piece_taille, piece_data_url)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
    [
      v.societeId, ordreRows[0].n, v.type, v.nature, v.periode, v.libelle,
      v.cnss, v.numQuittance, v.montantDeclaration, v.honoraire, v.reglement, v.note,
      v.pieceDataUrl ? v.pieceNom : "", v.pieceDataUrl ? v.pieceFormat : "",
      v.pieceDataUrl ? v.pieceTaille : "", v.pieceDataUrl || null,
    ],
  );
  logAction(
    req.session.nom,
    "creation",
    "honoraires",
    `${v.libelle || v.periode || v.type} — ${soc.raison_sociale}`,
  );
  res.status(201).json(await lignesFor(v.societeId));
});

// Import en masse depuis un fichier Excel (voir HonoraireImportDialog.tsx) —
// s'ajoute aux lignes existantes de la société, sans jamais les remplacer.
honorairesRouter.post("/import", requireAdmin, async (req, res) => {
  const parsed = z
    .object({
      societeId: z.string().uuid(),
      lignes: z.array(schema.omit({ societeId: true })).min(1),
    })
    .safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0].message });
  const { societeId, lignes } = parsed.data;
  const soc = (
    await query("select raison_sociale from societes where id = $1", [societeId])
  ).rows[0];
  if (!soc) return res.status(400).json({ error: "Société introuvable" });

  await withTransaction(async (client) => {
    const { rows } = await client.query(
      "select coalesce(max(ordre), 0) as n from honoraires_lignes where societe_id = $1",
      [societeId],
    );
    let ordre = rows[0].n;
    for (const v of lignes) {
      ordre += 1;
      await client.query(
        `insert into honoraires_lignes
           (societe_id, ordre, type, nature, periode, libelle, cnss, num_quittance,
            montant_declaration, honoraire, reglement, note)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          societeId, ordre, v.type, v.nature, v.periode, v.libelle,
          v.cnss, v.numQuittance, v.montantDeclaration, v.honoraire, v.reglement, v.note,
        ],
      );
    }
  });
  logAction(
    req.session.nom,
    "creation",
    "honoraires",
    `Import ${lignes.length} ligne(s) — ${soc.raison_sociale}`,
  );
  res.status(201).json(await lignesFor(societeId));
});

// Contenu de la pièce jointe, à la demande (jamais dans les listes).
honorairesRouter.get("/:id/piece", async (req, res) => {
  const { rows } = await query(
    "select societe_id, piece_nom, piece_data_url from honoraires_lignes where id = $1",
    [req.params.id],
  );
  if (!rows[0] || !rows[0].piece_data_url)
    return res.status(404).json({ error: "Pièce jointe introuvable" });
  if (!canRead(req.session, rows[0].societe_id))
    return res.status(403).json({ error: "Accès non autorisé" });
  res.json({ nom: rows[0].piece_nom, dataUrl: rows[0].piece_data_url });
});

honorairesRouter.patch("/:id", requireAdmin, async (req, res) => {
  const existing = (
    await query(`select ${HONORAIRE_COLONNES_LEGERES} from honoraires_lignes where id = $1`, [req.params.id])
  ).rows[0];
  if (!existing) return res.status(404).json({ error: "Ligne introuvable" });

  const parsed = schema.partial().safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0].message });
  const v = parsed.data;

  await query(
    `update honoraires_lignes set
       type = coalesce($1, type),
       nature = coalesce($2, nature),
       periode = coalesce($3, periode),
       libelle = coalesce($4, libelle),
       cnss = coalesce($5, cnss),
       num_quittance = coalesce($6, num_quittance),
       montant_declaration = coalesce($7, montant_declaration),
       honoraire = coalesce($8, honoraire),
       reglement = coalesce($9, reglement),
       note = coalesce($10, note),
       maj_le = now()
     where id = $11`,
    [
      v.type ?? null, v.nature ?? null, v.periode ?? null, v.libelle ?? null,
      v.cnss ?? null, v.numQuittance ?? null, v.montantDeclaration ?? null,
      v.honoraire ?? null, v.reglement ?? null, v.note ?? null, req.params.id,
    ],
  );
  if (v.pieceDataUrl !== undefined) {
    await query(
      `update honoraires_lignes set piece_nom = $1, piece_format = $2,
         piece_taille = $3, piece_data_url = $4 where id = $5`,
      [
        v.pieceDataUrl ? (v.pieceNom ?? "") : "", v.pieceDataUrl ? (v.pieceFormat ?? "") : "",
        v.pieceDataUrl ? (v.pieceTaille ?? "") : "", v.pieceDataUrl || null, req.params.id,
      ],
    );
  }
  logAction(
    req.session.nom,
    "modification",
    "honoraires",
    v.libelle || existing.libelle || existing.periode || existing.type,
  );
  res.json(await lignesFor(existing.societe_id));
});

honorairesRouter.delete("/:id", requireAdmin, async (req, res) => {
  const { rows } = await query(
    "delete from honoraires_lignes where id = $1 returning societe_id, libelle, periode, type",
    [req.params.id],
  );
  if (!rows[0]) return res.status(404).json({ error: "Ligne introuvable" });
  logAction(
    req.session.nom,
    "suppression",
    "honoraires",
    rows[0].libelle || rows[0].periode || rows[0].type,
  );
  res.json(await lignesFor(rows[0].societe_id));
});
