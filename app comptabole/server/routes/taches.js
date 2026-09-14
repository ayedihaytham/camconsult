import { Router } from "express";
import { z } from "zod";
import { query } from "../db.js";
import { requireAuth, requireAdmin } from "../auth.js";
import { logAction } from "../journal.js";
import { notify } from "../notifications.js";
import { tacheDto } from "../mappers.js";

/** Notification liée à une tâche (lien → /taches). */
const notifT = (userKey, type, titre, corps = "") =>
  notify(userKey, type, titre, corps, "/taches");

export const tachesRouter = Router();
tachesRouter.use(requireAuth);

const STATUTS = ["a_faire", "en_cours", "termine"];
const STATUT_LABEL = {
  a_faire: "À faire",
  en_cours: "En cours",
  termine: "Terminé",
};

const createSchema = z.object({
  titre: z.string().min(2),
  description: z.string().default(""),
  societeId: z.string().uuid(),
  assigneId: z.string().uuid().nullish(),
  statut: z.enum(STATUTS).default("a_faire"),
});

const patchSchema = z.object({
  titre: z.string().min(2).optional(),
  description: z.string().optional(),
  societeId: z.string().uuid().optional(),
  assigneId: z.string().uuid().nullable().optional(),
  statut: z.enum(STATUTS).optional(),
});

/** Un employé de société cliente n'a jamais accès aux tâches. */
function noSocieteEmploye(req, res, next) {
  if (req.session.poste === "societe_employe")
    return res.status(403).json({ error: "Accès aux tâches non autorisé" });
  next();
}

tachesRouter.get("/", noSocieteEmploye, async (req, res) => {
  const s = req.session;
  const clauses = [];
  const params = [];
  if (s.role !== "admin") {
    params.push(s.employeId);
    clauses.push(`assigne_id = $${params.length}`);
  }
  if (req.query.societeId) {
    params.push(req.query.societeId);
    clauses.push(`societe_id = $${params.length}`);
  }
  if (req.query.assigneId && s.role === "admin") {
    params.push(req.query.assigneId);
    clauses.push(`assigne_id = $${params.length}`);
  }
  if (req.query.statut && STATUTS.includes(req.query.statut)) {
    params.push(req.query.statut);
    clauses.push(`statut = $${params.length}`);
  }
  const where = clauses.length ? `where ${clauses.join(" and ")}` : "";
  const { rows } = await query(
    `select * from taches ${where} order by cree_le desc`,
    params,
  );
  res.json(rows.map(tacheDto));
});

tachesRouter.post("/", requireAdmin, async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0].message });
  const v = parsed.data;

  const soc = (
    await query("select raison_sociale from societes where id = $1", [v.societeId])
  ).rows[0];
  if (!soc) return res.status(400).json({ error: "Société introuvable" });

  if (v.assigneId) {
    const emp = (
      await query(
        "select id from employes where id = $1 and role = 'collaborateur'",
        [v.assigneId],
      )
    ).rows[0];
    if (!emp)
      return res.status(400).json({ error: "Collaborateur assigné introuvable" });
  }

  const { rows } = await query(
    `insert into taches (titre, description, societe_id, assigne_id, statut, cree_par)
     values ($1,$2,$3,$4,$5,$6) returning *`,
    [v.titre, v.description, v.societeId, v.assigneId ?? null, v.statut, req.session.nom],
  );
  logAction(
    req.session.nom,
    "creation",
    "tache",
    `${v.titre} — ${soc.raison_sociale}`,
  );
  if (v.assigneId) {
    notifT(
      v.assigneId,
      "tache_assignee",
      `Nouvelle tâche : ${v.titre}`,
      `Société ${soc.raison_sociale} — assignée par ${req.session.nom}`,
    );
  }
  res.status(201).json(tacheDto(rows[0]));
});

tachesRouter.patch("/:id", noSocieteEmploye, async (req, res) => {
  const existing = (
    await query("select * from taches where id = $1", [req.params.id])
  ).rows[0];
  if (!existing) return res.status(404).json({ error: "Tâche introuvable" });

  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0].message });
  const v = parsed.data;
  const isAdmin = req.session.role === "admin";

  // Un collaborateur ne peut changer que le statut d'une tâche qui lui est assignée.
  if (!isAdmin) {
    if (existing.assigne_id !== req.session.employeId)
      return res.status(403).json({ error: "Tâche hors de votre périmètre" });
    const keys = Object.keys(v);
    if (keys.length !== 1 || keys[0] !== "statut")
      return res
        .status(403)
        .json({ error: "Vous pouvez seulement changer le statut" });
  }

  if (isAdmin && v.societeId) {
    const soc = (
      await query("select 1 from societes where id = $1", [v.societeId])
    ).rows[0];
    if (!soc) return res.status(400).json({ error: "Société introuvable" });
  }
  if (isAdmin && v.assigneId) {
    const emp = (
      await query(
        "select 1 from employes where id = $1 and role = 'collaborateur'",
        [v.assigneId],
      )
    ).rows[0];
    if (!emp)
      return res.status(400).json({ error: "Collaborateur assigné introuvable" });
  }

  const next = {
    titre: v.titre ?? existing.titre,
    description: v.description ?? existing.description,
    societe_id: v.societeId ?? existing.societe_id,
    assigne_id:
      v.assigneId === undefined ? existing.assigne_id : v.assigneId,
    statut: v.statut ?? existing.statut,
  };
  const termineLe =
    next.statut === "termine"
      ? existing.termine_le ?? new Date()
      : null;

  const { rows } = await query(
    `update taches set titre=$1, description=$2, societe_id=$3, assigne_id=$4,
       statut=$5, termine_le=$6, maj_le=now()
     where id=$7 returning *`,
    [
      next.titre,
      next.description,
      next.societe_id,
      next.assigne_id,
      next.statut,
      termineLe,
      req.params.id,
    ],
  );
  const statutChange = v.statut && v.statut !== existing.statut;
  const action = statutChange
    ? `Statut « ${v.statut} » — ${next.titre}`
    : `Tâche modifiée — ${next.titre}`;
  logAction(req.session.nom, "modification", "tache", action);

  // Notifications
  if (!isAdmin && statutChange) {
    // Le collaborateur a fait avancer la tâche → prévenir le cabinet.
    notifT(
      "admin",
      "tache_statut",
      `${req.session.nom} : « ${next.titre} » → ${STATUT_LABEL[next.statut]}`,
      "",
    );
  }
  if (isAdmin) {
    const oldAssignee = existing.assigne_id;
    const newAssignee = next.assigne_id;
    if (newAssignee && newAssignee !== oldAssignee) {
      notifT(
        newAssignee,
        "tache_assignee",
        `Tâche assignée : ${next.titre}`,
        `Assignée par ${req.session.nom}`,
      );
    } else if (newAssignee) {
      // même assigné, tâche retouchée par l'admin
      notifT(
        newAssignee,
        statutChange ? "tache_statut" : "tache_modifiee",
        statutChange
          ? `« ${next.titre} » → ${STATUT_LABEL[next.statut]}`
          : `Tâche mise à jour : ${next.titre}`,
        `Par ${req.session.nom}`,
      );
    }
    if (oldAssignee && newAssignee !== oldAssignee) {
      notifT(
        oldAssignee,
        "tache_modifiee",
        `Tâche retirée : ${next.titre}`,
        `Réassignée par ${req.session.nom}`,
      );
    }
  }
  res.json(tacheDto(rows[0]));
});

tachesRouter.delete("/:id", requireAdmin, async (req, res) => {
  const { rows } = await query(
    "delete from taches where id = $1 returning titre, assigne_id",
    [req.params.id],
  );
  if (!rows[0]) return res.status(404).json({ error: "Tâche introuvable" });
  logAction(req.session.nom, "suppression", "tache", rows[0].titre);
  if (rows[0].assigne_id) {
    notifT(
      rows[0].assigne_id,
      "tache_modifiee",
      `Tâche supprimée : ${rows[0].titre}`,
      `Par ${req.session.nom}`,
    );
  }
  res.json({ ok: true });
});
