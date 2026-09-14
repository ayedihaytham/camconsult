import { Router } from "express";
import { z } from "zod";
import { query } from "../db.js";
import { requireAuth, requireAdmin } from "../auth.js";
import { logAction } from "../journal.js";
import { notifyMany } from "../notifications.js";
import { conversationDto } from "../mappers.js";

export const conversationsRouter = Router();
conversationsRouter.use(requireAuth);

const schema = z.object({
  titre: z.string().min(1),
  membreIds: z.array(z.string()).default([]),
});

conversationsRouter.get("/", async (req, res) => {
  const { rows } = await query(
    "select * from conversations where type = 'groupe' order by cree_le desc",
  );
  const visible =
    req.session.role === "admin"
      ? rows
      : rows.filter((r) =>
          (Array.isArray(r.membre_ids) ? r.membre_ids : []).includes(
            req.session.employeId,
          ),
        );
  res.json(visible.map(conversationDto));
});

conversationsRouter.post("/", requireAdmin, async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0].message });
  const { titre, membreIds } = parsed.data;
  const { rows } = await query(
    `insert into conversations (type, titre, membre_ids)
     values ('groupe', $1, $2::jsonb) returning *`,
    [titre, JSON.stringify(membreIds)],
  );
  logAction(req.session.nom, "creation", "message", `Groupe « ${titre} »`);
  notifyMany(
    membreIds,
    "message",
    `Ajouté au groupe « ${titre} »`,
    `Par ${req.session.nom}`,
    "/messagerie",
  );
  res.status(201).json(conversationDto(rows[0]));
});

conversationsRouter.patch("/:id", requireAdmin, async (req, res) => {
  const parsed = schema.partial().safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0].message });
  const existing = (
    await query("select * from conversations where id = $1", [req.params.id])
  ).rows[0];
  if (!existing)
    return res.status(404).json({ error: "Groupe introuvable" });
  const titre = parsed.data.titre ?? existing.titre;
  const membreIds = parsed.data.membreIds ?? existing.membre_ids;
  const { rows } = await query(
    `update conversations set titre = $1, membre_ids = $2::jsonb where id = $3 returning *`,
    [titre, JSON.stringify(membreIds), req.params.id],
  );
  logAction(req.session.nom, "modification", "message", `Groupe « ${titre} »`);
  const before = new Set(
    Array.isArray(existing.membre_ids) ? existing.membre_ids : [],
  );
  const added = (Array.isArray(membreIds) ? membreIds : []).filter(
    (id) => !before.has(id),
  );
  notifyMany(
    added,
    "message",
    `Ajouté au groupe « ${titre} »`,
    `Par ${req.session.nom}`,
    "/messagerie",
  );
  res.json(conversationDto(rows[0]));
});

conversationsRouter.delete("/:id", requireAdmin, async (req, res) => {
  const existing = (
    await query("select titre from conversations where id = $1", [req.params.id])
  ).rows[0];
  await query("delete from conversations where id = $1", [req.params.id]);
  await query("delete from messages where conversation_id = $1", [
    req.params.id,
  ]);
  logAction(
    req.session.nom,
    "suppression",
    "message",
    `Groupe « ${existing?.titre ?? ""} »`,
  );
  res.json({ ok: true });
});
