import { Router } from "express";
import { z } from "zod";
import { query } from "../db.js";
import { requireAuth } from "../auth.js";
import { can } from "../permissions.js";
import { logAction } from "../journal.js";
import { notify, notifyMany } from "../notifications.js";
import { messageDto } from "../mappers.js";

export const messagesRouter = Router();
messagesRouter.use(requireAuth);

function requireMessagerie(req, res, next) {
  if (req.session.role === "admin" || can(req.session, "messagerie"))
    return next();
  res.status(403).json({ error: "Accès à la messagerie non autorisé" });
}

const schema = z.object({
  conversationId: z.string().min(1),
  auteurId: z.string().min(1),
  contenu: z.string().default(""),
  envoyeLe: z.string().optional(),
  statut: z.enum(["envoye", "lu"]).default("envoye"),
  pieceJointe: z
    .object({ noeudId: z.string(), libelle: z.string() })
    .nullish(),
});

/**
 * L'employé voit : sa conversation directe + les groupes dont il est membre.
 * En plus, un collaborateur peut échanger avec les employés des sociétés de son périmètre.
 */
async function ownConversation(req, conversationId) {
  const s = req.session;
  if (s.role === "admin") return true;
  if (conversationId === `conv-${s.employeId}`) return true;

  // Collaborateur <-> employé d'une société de son périmètre
  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const otherId = conversationId.startsWith("conv-")
    ? conversationId.slice("conv-".length)
    : "";
  if (s.poste !== "societe_employe" && UUID_RE.test(otherId)) {
    const other = (
      await query(
        "select societe_id from employes where id = $1 and role = 'societe_employe'",
        [otherId],
      )
    ).rows[0];
    if (
      other &&
      other.societe_id &&
      (s.societeIds || []).includes(other.societe_id)
    )
      return true;
  }

  // groupe : vérifier l'appartenance
  const g = (
    await query(
      "select membre_ids from conversations where id = $1 and type = 'groupe'",
      [conversationId],
    )
  ).rows[0];
  if (!g) return false;
  return (Array.isArray(g.membre_ids) ? g.membre_ids : []).includes(s.employeId);
}

messagesRouter.get("/", requireMessagerie, async (req, res) => {
  const { rows } = await query("select * from messages order by envoye_le");
  const checks = await Promise.all(
    rows.map((r) => ownConversation(req, r.conversation_id)),
  );
  res.json(rows.filter((_, i) => checks[i]).map(messageDto));
});

messagesRouter.post("/", requireMessagerie, async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0].message });
  const v = parsed.data;
  if (!(await ownConversation(req, v.conversationId)))
    return res.status(403).json({ error: "Conversation hors périmètre" });
  const { rows } = await query(
    `insert into messages (conversation_id, auteur_id, contenu, envoye_le, statut, piece_jointe)
     values ($1,$2,$3, coalesce($4::timestamptz, now()), $5, $6::jsonb) returning *`,
    [
      v.conversationId,
      v.auteurId,
      v.contenu,
      v.envoyeLe ?? null,
      v.statut,
      v.pieceJointe ? JSON.stringify(v.pieceJointe) : null,
    ],
  );
  logAction(
    req.session.nom,
    "creation",
    "message",
    `Message${v.pieceJointe ? " + pièce jointe" : ""} — ${v.conversationId}`,
  );

  // Notifier le(s) destinataire(s)
  const s = req.session;
  const apercu =
    (v.contenu || (v.pieceJointe ? "📎 Pièce jointe" : "")).slice(0, 120);
  const convId = v.conversationId;
  if (convId.startsWith("conv-")) {
    const otherId = convId.slice("conv-".length);
    if (s.role === "admin") {
      notify(otherId, "message", "Nouveau message du cabinet", apercu, "/messagerie");
    } else if (otherId === s.employeId) {
      notify("admin", "message", `Message de ${s.nom}`, apercu, "/messagerie");
    } else {
      notify(otherId, "message", `Nouveau message de ${s.nom}`, apercu, "/messagerie");
    }
  } else {
    const g = (
      await query(
        "select titre, membre_ids from conversations where id = $1",
        [convId],
      )
    ).rows[0];
    if (g) {
      const members = (Array.isArray(g.membre_ids) ? g.membre_ids : []).filter(
        (id) => id !== s.employeId,
      );
      notifyMany(
        members,
        "message",
        `${g.titre} · ${s.nom}`,
        apercu,
        "/messagerie",
      );
      if (s.role !== "admin")
        notify("admin", "message", `${g.titre} · ${s.nom}`, apercu, "/messagerie");
    }
  }
  res.status(201).json(messageDto(rows[0]));
});

messagesRouter.post("/mark-read", requireMessagerie, async (req, res) => {
  const { conversationId, viewerAuthorId } = req.body ?? {};
  if (!conversationId) return res.status(400).json({ error: "conversationId requis" });
  if (!(await ownConversation(req, conversationId)))
    return res.status(403).json({ error: "Conversation hors périmètre" });
  await query(
    "update messages set statut = 'lu' where conversation_id = $1 and auteur_id <> $2",
    [conversationId, viewerAuthorId || "me"],
  );
  res.json({ ok: true });
});
