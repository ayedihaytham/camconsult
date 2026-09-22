import { Router } from "express";
import { z } from "zod";
import { query } from "../db.js";
import { requireAuth, requireAdmin } from "../auth.js";
import { logAction } from "../journal.js";
import { honoraireLignesDto } from "../mappers.js";

/** État client (honoraires) — réservé à l'admin, voir la demande initiale
 * ("ajouter à l'admin"). */
export const honorairesRouter = Router();
honorairesRouter.use(requireAuth, requireAdmin);

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
});

async function lignesFor(societeId) {
  const { rows } = await query(
    "select * from honoraires_lignes where societe_id = $1 order by ordre, cree_le",
    [societeId],
  );
  return honoraireLignesDto(rows);
}

honorairesRouter.get("/", async (req, res) => {
  const societeId = req.query.societeId;
  if (!societeId) return res.status(400).json({ error: "societeId requis" });
  res.json(await lignesFor(societeId));
});

honorairesRouter.post("/", async (req, res) => {
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
        montant_declaration, honoraire, reglement, note)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [
      v.societeId, ordreRows[0].n, v.type, v.nature, v.periode, v.libelle,
      v.cnss, v.numQuittance, v.montantDeclaration, v.honoraire, v.reglement, v.note,
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

honorairesRouter.patch("/:id", async (req, res) => {
  const existing = (
    await query("select * from honoraires_lignes where id = $1", [req.params.id])
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
  logAction(
    req.session.nom,
    "modification",
    "honoraires",
    v.libelle || existing.libelle || existing.periode || existing.type,
  );
  res.json(await lignesFor(existing.societe_id));
});

honorairesRouter.delete("/:id", async (req, res) => {
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
