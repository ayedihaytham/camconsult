import { Router } from "express";
import { z } from "zod";
import { query } from "../db.js";
import { requireAuth } from "../auth.js";
import { can } from "../permissions.js";
import { logAction } from "../journal.js";
import { notify, notifyMany } from "../notifications.js";
import { pushToUser } from "../sse.js";
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
    .object({
      libelle: z.string(),
      dataUrl: z.string().max(12_000_000).optional(),
      mime: z.string().optional(),
      tailleOctets: z.number().optional(),
      // Ancien format — référence à un document de la Structuration.
      noeudId: z.string().optional(),
    })
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

  // groupe : vérifier l'appartenance — conversations.id est une vraie
  // colonne uuid, jamais préfixée "conv-" ; sans cette garde, un
  // conversationId direct qui n'est ni le sien ni dans son périmètre (ex.
  // "conv-<uuid-d'un-autre-employé>") fait planter cette requête avec une
  // erreur de cast uuid plutôt que de renvoyer "aucune ligne" — repéré en
  // usage réel sur GET /messages (voir plus bas), qui appelait cette même
  // logique par message et provoquait des 504 en boucle.
  if (!UUID_RE.test(conversationId)) return false;
  const g = (
    await query(
      "select membre_ids from conversations where id = $1 and type = 'groupe'",
      [conversationId],
    )
  ).rows[0];
  if (!g) return false;
  return (Array.isArray(g.membre_ids) ? g.membre_ids : []).includes(s.employeId);
}

/**
 * IDs de conversation visibles par cette session, en quelques requêtes —
 * jamais une par message. L'ancienne version chargeait TOUS les messages du
 * système puis rappelait `ownConversation` (donc une requête réseau de plus,
 * parfois deux) pour CHAQUE message un par un, y compris plusieurs fois pour
 * le même groupe : sondé toutes les 5 s par chaque session connectée (voir
 * Topbar.tsx), ça grossit avec le nombre de messages jusqu'à saturer le pool
 * de connexions et provoquer des 504 en usage réel — repéré via les logs
 * navigateur d'un client.
 */
async function visibleConversationIds(req) {
  const s = req.session;
  const ids = new Set([`conv-${s.employeId}`]);

  // Collaborateur <-> employés de société de son périmètre.
  if (s.poste !== "societe_employe" && (s.societeIds || []).length > 0) {
    const { rows } = await query(
      "select id from employes where role = 'societe_employe' and societe_id = any($1::uuid[])",
      [s.societeIds],
    );
    for (const r of rows) ids.add(`conv-${r.id}`);
  }

  // Groupes dont il est membre.
  const { rows: groupes } = await query(
    "select id from conversations where type = 'groupe' and membre_ids @> $1::jsonb",
    [JSON.stringify([s.employeId])],
  );
  for (const g of groupes) ids.add(g.id);

  return [...ids];
}

messagesRouter.get("/", requireMessagerie, async (req, res) => {
  if (req.session.role === "admin") {
    const { rows } = await query("select * from messages order by envoye_le");
    return res.json(rows.map(messageDto));
  }
  const convIds = await visibleConversationIds(req);
  const { rows } = await query(
    "select * from messages where conversation_id = any($1::text[]) order by envoye_le",
    [convIds],
  );
  res.json(rows.map(messageDto));
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
  const { rows } = await query(
    `update messages set statut = 'lu'
      where conversation_id = $1 and auteur_id <> $2 and statut <> 'lu'
      returning auteur_id`,
    [conversationId, viewerAuthorId || "me"],
  );
  // Signal temps réel à l'expéditeur : ses coches passent à "lu" sans qu'il
  // ait besoin de recharger la page.
  const authors = new Set(rows.map((r) => (r.auteur_id === "me" ? "admin" : r.auteur_id)));
  for (const key of authors) pushToUser(key, "message");
  res.json({ ok: true });
});
