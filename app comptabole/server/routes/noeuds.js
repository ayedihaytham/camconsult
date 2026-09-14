import { Router } from "express";
import { z } from "zod";
import { query, withTransaction } from "../db.js";
import { requireAuth, canSeeSociete } from "../auth.js";
import { can } from "../permissions.js";
import { logAction } from "../journal.js";
import {
  notifyMany,
  notifKey,
  concernedBySociete,
} from "../notifications.js";
import { noeudDto } from "../mappers.js";

/** Prévient les personnes concernées par la société (sauf l'auteur). */
async function notifyStructure(req, societeId, titre, corps) {
  if (!societeId) return;
  const soc = (
    await query("select raison_sociale from societes where id = $1", [societeId])
  ).rows[0];
  const targets = (
    await concernedBySociete(societeId, { includeAdmin: true })
  ).filter((k) => k !== notifKey(req.session));
  notifyMany(
    targets,
    "document",
    titre,
    `${soc ? `Société ${soc.raison_sociale} — ` : ""}par ${req.session.nom}${corps ? ` — ${corps}` : ""}`,
    "/structuration",
  );
}

export const noeudsRouter = Router();
noeudsRouter.use(requireAuth);

const schema = z.object({
  libelle: z.string().min(1),
  description: z.string().default(""),
  type: z.enum(["dossier", "fichier"]).default("dossier"),
  societeId: z.string().nullable().default(null),
  parentId: z.string().nullable().default(null),
  format: z.string().optional(),
  taille: z.string().optional(),
  dataUrl: z.string().optional(),
});

function requireCreate(req, res, next) {
  if (req.session.role === "admin" || can(req.session, "deposerFichiers"))
    return next();
  res.status(403).json({ error: "Droit « déposer des fichiers » requis" });
}
function requireStructEdit(req, res, next) {
  if (req.session.role === "admin" || can(req.session, "modifierSocietes"))
    return next();
  res.status(403).json({ error: "Droit « modifier les sociétés » requis" });
}
function requireDelete(req, res, next) {
  if (req.session.role === "admin" || can(req.session, "supprimer"))
    return next();
  res.status(403).json({ error: "Droit « supprimer » requis" });
}

noeudsRouter.get("/", async (req, res) => {
  const { rows } = await query("select * from noeuds order by maj_le desc");
  const visible = rows.filter((r) => canSeeSociete(req.session, r.societe_id));
  res.json(visible.map(noeudDto));
});

noeudsRouter.post("/", requireCreate, async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0].message });
  const v = parsed.data;
  if (!canSeeSociete(req.session, v.societeId ?? null))
    return res.status(403).json({ error: "Société hors périmètre" });
  const { rows } = await query(
    `insert into noeuds (libelle, description, type, societe_id, parent_id, format, taille, data_url, maj_le)
     values ($1,$2,$3,$4,$5,$6,$7,$8, current_date) returning *`,
    [
      v.libelle, v.description, v.type, v.societeId, v.parentId,
      v.format ?? null, v.taille ?? null, v.dataUrl ?? null,
    ],
  );
  logAction(
    req.session.nom,
    "creation",
    v.type === "fichier" ? "fichier" : "dossier",
    v.libelle,
  );
  await notifyStructure(
    req,
    rows[0].societe_id,
    `Nouveau ${v.type === "fichier" ? "fichier" : "dossier"} : ${v.libelle}`,
  );
  res.status(201).json(noeudDto(rows[0]));
});

noeudsRouter.patch("/:id", requireStructEdit, async (req, res) => {
  const existing = (await query("select * from noeuds where id = $1", [req.params.id])).rows[0];
  if (!existing) return res.status(404).json({ error: "Élément introuvable" });
  if (!canSeeSociete(req.session, existing.societe_id))
    return res.status(403).json({ error: "Élément hors périmètre" });

  const wants = schema.partial().safeParse(req.body);
  if (!wants.success)
    return res.status(400).json({ error: wants.error.issues[0].message });
  const v = { ...noeudDto(existing), ...wants.data };
  const { rows } = await query(
    `update noeuds set libelle=$1, description=$2, societe_id=$3, parent_id=$4,
       format=$5, taille=$6, data_url=$7, maj_le=current_date
     where id=$8 returning *`,
    [
      v.libelle, v.description, v.societeId, v.parentId,
      v.format ?? null, v.taille ?? null, v.dataUrl ?? null, req.params.id,
    ],
  );
  const moved = existing.parent_id !== rows[0].parent_id;
  logAction(
    req.session.nom,
    "modification",
    existing.type === "fichier" ? "fichier" : "dossier",
    moved ? `Déplacement de « ${v.libelle} »` : v.libelle,
  );
  await notifyStructure(
    req,
    rows[0].societe_id,
    `${existing.type === "fichier" ? "Fichier" : "Dossier"} ${moved ? "déplacé" : "modifié"} : ${v.libelle}`,
  );
  res.json(noeudDto(rows[0]));
});

noeudsRouter.post("/:id/duplicate", requireStructEdit, async (req, res) => {
  const all = (await query("select * from noeuds")).rows;
  const byId = new Map(all.map((n) => [n.id, n]));
  const root = byId.get(req.params.id);
  if (!root) return res.status(404).json({ error: "Élément introuvable" });

  const subtree = [];
  const collect = (id) => {
    const node = byId.get(id);
    if (!node) return;
    subtree.push(node);
    all.filter((n) => n.parent_id === id).forEach((c) => collect(c.id));
  };
  collect(root.id);

  const created = await withTransaction(async (client) => {
    const idMap = new Map();
    const out = [];
    for (let i = 0; i < subtree.length; i++) {
      const n = subtree[i];
      const newParent =
        i === 0 ? null : (idMap.get(n.parent_id) ?? null);
      const libelle = i === 0 ? `${n.libelle} (copie)` : n.libelle;
      const { rows } = await client.query(
        `insert into noeuds (libelle, description, type, societe_id, parent_id, format, taille, data_url, maj_le)
         values ($1,$2,$3,$4,$5,$6,$7,$8, current_date) returning *`,
        [
          libelle, n.description, n.type, n.societe_id, newParent,
          n.format, n.taille, n.data_url,
        ],
      );
      idMap.set(n.id, rows[0].id);
      out.push(rows[0]);
    }
    return out;
  });

  logAction(req.session.nom, "duplication", "dossier", root.libelle);
  res.status(201).json(created.map(noeudDto));
});

noeudsRouter.post("/bulk-delete", requireDelete, async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
  if (ids.length === 0) return res.json({ deleted: 0 });
  // ON DELETE CASCADE gère les descendants
  const { rows } = await query(
    "delete from noeuds where id = any($1::uuid[]) returning libelle, type, societe_id",
    [ids],
  );
  logAction(
    req.session.nom,
    "suppression",
    rows[0]?.type === "fichier" ? "fichier" : "dossier",
    rows.length > 1 ? `${rows.length} éléments` : (rows[0]?.libelle ?? "élément"),
  );
  const bySoc = new Map();
  for (const r of rows) {
    if (r.societe_id)
      bySoc.set(r.societe_id, [...(bySoc.get(r.societe_id) ?? []), r.libelle]);
  }
  for (const [socId, libelles] of bySoc) {
    await notifyStructure(
      req,
      socId,
      libelles.length > 1
        ? `${libelles.length} éléments supprimés`
        : `Élément supprimé : ${libelles[0]}`,
    );
  }
  res.json({ deleted: rows.length });
});
