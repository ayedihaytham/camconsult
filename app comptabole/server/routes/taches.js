import { Router } from "express";
import { z } from "zod";
import { query } from "../db.js";
import { requireAuth, canSeeSociete } from "../auth.js";
import { logAction } from "../journal.js";
import { notify, notifyMany } from "../notifications.js";
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
const MODULES = ["collectes", "structuration", "messagerie"];

const createSchema = z.object({
  titre: z.string().min(2),
  description: z.string().default(""),
  societeId: z.string().uuid(),
  assigneId: z.string().uuid().nullish(),
  statut: z.enum(STATUTS).default("a_faire"),
  module: z.enum(MODULES).nullish(),
});

const patchSchema = z.object({
  titre: z.string().min(2).optional(),
  description: z.string().optional(),
  societeId: z.string().uuid().optional(),
  assigneId: z.string().uuid().nullable().optional(),
  statut: z.enum(STATUTS).optional(),
  module: z.enum(MODULES).nullable().optional(),
});

// Deux circuits de tâches :
// - "cabinet" : données par l'admin aux collaborateurs (inchangé) ;
// - "societe" : données par un responsable de société à ses délégués. Le
//   cabinet les voit (sur les sociétés de son périmètre) mais en lecture seule.
const isSocieteSide = (s) => s.poste === "societe_employe";
const isResponsableSociete = (s) => isSocieteSide(s) && !s.delegue;
const ownSociete = (s, societeId) => (s.societeIds || []).includes(societeId);

/** Tâches visibles par la session (lignes brutes). */
export async function tachesVisibles(s) {
  if (s.role === "admin")
    return (await query("select * from taches order by cree_le desc")).rows;
  if (isSocieteSide(s)) {
    return s.delegue
      ? (
          await query(
            "select * from taches where origine = 'societe' and assigne_id = $1 order by cree_le desc",
            [s.employeId],
          )
        ).rows
      : (
          await query(
            "select * from taches where origine = 'societe' and societe_id = any($1::uuid[]) order by cree_le desc",
            [s.societeIds ?? []],
          )
        ).rows;
  }
  // Cabinet (collaborateur, responsable des collaborateurs) : ses tâches +
  // celles des sociétés qu'il suit, données en interne par leur responsable.
  const rows = (
    await query(
      "select * from taches where assigne_id = $1 or origine = 'societe' order by cree_le desc",
      [s.employeId],
    )
  ).rows;
  return rows.filter(
    (r) => r.assigne_id === s.employeId || canSeeSociete(s, r.societe_id),
  );
}

/** Responsables (pas délégués) actifs d'une société — pour les notifier. */
async function responsablesDe(societeId) {
  return (
    await query(
      "select id from employes where role = 'societe_employe' and not delegue and statut = 'actif' and societe_id = $1",
      [societeId],
    )
  ).rows.map((r) => r.id);
}

async function isDelegueDe(employeId, societeId) {
  return Boolean(
    (
      await query(
        "select 1 from employes where id = $1 and role = 'societe_employe' and delegue and statut = 'actif' and societe_id = $2",
        [employeId, societeId],
      )
    ).rows[0],
  );
}

tachesRouter.get("/", async (req, res) => {
  const s = req.session;
  const q = req.query;
  const rows = (await tachesVisibles(s)).filter(
    (r) =>
      (!q.societeId || r.societe_id === q.societeId) &&
      (!q.assigneId || s.role !== "admin" || r.assigne_id === q.assigneId) &&
      (!q.statut || !STATUTS.includes(q.statut) || r.statut === q.statut),
  );
  res.json(rows.map(tacheDto));
});

tachesRouter.post("/", async (req, res) => {
  const s = req.session;
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0].message });
  const v = parsed.data;

  let origine;
  if (s.role === "admin") origine = "cabinet";
  else if (isResponsableSociete(s)) origine = "societe";
  else
    return res
      .status(403)
      .json({ error: "Seul l'administrateur ou le responsable de société peut créer une tâche" });

  if (origine === "societe" && !ownSociete(s, v.societeId))
    return res.status(403).json({ error: "Société hors de votre périmètre" });

  const soc = (
    await query("select raison_sociale from societes where id = $1", [v.societeId])
  ).rows[0];
  if (!soc) return res.status(400).json({ error: "Société introuvable" });

  if (v.assigneId) {
    const ok =
      origine === "societe"
        ? await isDelegueDe(v.assigneId, v.societeId)
        : // Assignable à toute l'équipe interne du cabinet (collaborateur ou
          // responsable des collaborateurs) — jamais à un employé de société
          // cliente. Même périmètre que useCollaborateurs() côté client.
          Boolean(
            (
              await query(
                "select id from employes where id = $1 and role != 'societe_employe'",
                [v.assigneId],
              )
            ).rows[0],
          );
    if (!ok)
      return res.status(400).json({
        error:
          origine === "societe"
            ? "Délégué introuvable dans votre société"
            : "Collaborateur assigné introuvable",
      });
  }

  const { rows } = await query(
    `insert into taches (titre, description, societe_id, assigne_id, statut, cree_par, origine, module)
     values ($1,$2,$3,$4,$5,$6,$7,$8) returning *`,
    [
      v.titre, v.description, v.societeId, v.assigneId ?? null, v.statut, s.nom,
      origine, v.module ?? null,
    ],
  );
  logAction(s.nom, "creation", "tache", `${v.titre} — ${soc.raison_sociale}`);
  if (v.assigneId) {
    notifT(
      v.assigneId,
      "tache_assignee",
      `Nouvelle tâche : ${v.titre}`,
      `Société ${soc.raison_sociale} — assignée par ${s.nom}`,
    );
  }
  res.status(201).json(tacheDto(rows[0]));
});

tachesRouter.patch("/:id", async (req, res) => {
  const s = req.session;
  const existing = (
    await query("select * from taches where id = $1", [req.params.id])
  ).rows[0];
  if (!existing) return res.status(404).json({ error: "Tâche introuvable" });

  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0].message });
  const v = parsed.data;
  const isAdmin = s.role === "admin";
  const tacheSociete = existing.origine === "societe";
  // Gestionnaire de la tâche : l'admin pour le circuit cabinet, le
  // responsable de la société pour le circuit société.
  const isManager = tacheSociete
    ? isResponsableSociete(s) && ownSociete(s, existing.societe_id)
    : isAdmin;

  if (!isManager) {
    if (tacheSociete && !isSocieteSide(s))
      return res
        .status(403)
        .json({ error: "Tâche interne à la société — lecture seule pour le cabinet" });
    if (!tacheSociete && isSocieteSide(s))
      return res.status(403).json({ error: "Accès aux tâches non autorisé" });
    // L'assigné ne peut changer que le statut, et seulement vers l'avant :
    // revenir en arrière reste la décision de celui qui a donné la tâche.
    if (existing.assigne_id !== s.employeId)
      return res.status(403).json({ error: "Tâche hors de votre périmètre" });
    const keys = Object.keys(v);
    if (keys.length !== 1 || keys[0] !== "statut")
      return res
        .status(403)
        .json({ error: "Vous pouvez seulement changer le statut" });
    if (STATUTS.indexOf(v.statut) < STATUTS.indexOf(existing.statut))
      return res.status(403).json({
        error: tacheSociete
          ? "Seul le responsable de la société peut faire reculer une tâche"
          : "Seul l'administrateur peut faire reculer une tâche",
      });
  }

  if (isManager && v.societeId && v.societeId !== existing.societe_id) {
    if (tacheSociete)
      return res.status(400).json({ error: "La société d'une tâche interne ne change pas" });
    const soc = (
      await query("select 1 from societes where id = $1", [v.societeId])
    ).rows[0];
    if (!soc) return res.status(400).json({ error: "Société introuvable" });
  }
  if (isManager && v.assigneId) {
    const ok = tacheSociete
      ? await isDelegueDe(v.assigneId, existing.societe_id)
      : Boolean(
          (
            await query(
              "select 1 from employes where id = $1 and role != 'societe_employe'",
              [v.assigneId],
            )
          ).rows[0],
        );
    if (!ok)
      return res.status(400).json({
        error: tacheSociete
          ? "Délégué introuvable dans votre société"
          : "Collaborateur assigné introuvable",
      });
  }

  const next = {
    titre: v.titre ?? existing.titre,
    description: v.description ?? existing.description,
    societe_id: tacheSociete ? existing.societe_id : v.societeId ?? existing.societe_id,
    assigne_id: v.assigneId === undefined ? existing.assigne_id : v.assigneId,
    statut: v.statut ?? existing.statut,
    module: v.module === undefined ? existing.module : v.module,
  };
  const termineLe =
    next.statut === "termine" ? existing.termine_le ?? new Date() : null;

  const { rows } = await query(
    `update taches set titre=$1, description=$2, societe_id=$3, assigne_id=$4,
       statut=$5, termine_le=$6, module=$8, maj_le=now()
     where id=$7 returning *`,
    [
      next.titre, next.description, next.societe_id, next.assigne_id,
      next.statut, termineLe, req.params.id, next.module,
    ],
  );
  const statutChange = v.statut && v.statut !== existing.statut;
  const action = statutChange
    ? `Statut « ${v.statut} » — ${next.titre}`
    : `Tâche modifiée — ${next.titre}`;
  logAction(s.nom, "modification", "tache", action);

  // Notifications
  if (!isManager && statutChange) {
    // L'assigné a fait avancer la tâche → prévenir qui l'a donnée.
    const titre = `${s.nom} : « ${next.titre} » → ${STATUT_LABEL[next.statut]}`;
    if (tacheSociete)
      notifyMany(await responsablesDe(existing.societe_id), "tache_statut", titre, "", "/taches");
    else notifT("admin", "tache_statut", titre, "");
  }
  if (isManager) {
    const oldAssignee = existing.assigne_id;
    const newAssignee = next.assigne_id;
    if (newAssignee && newAssignee !== oldAssignee) {
      notifT(
        newAssignee,
        "tache_assignee",
        `Tâche assignée : ${next.titre}`,
        `Assignée par ${s.nom}`,
      );
    } else if (newAssignee) {
      notifT(
        newAssignee,
        statutChange ? "tache_statut" : "tache_modifiee",
        statutChange
          ? `« ${next.titre} » → ${STATUT_LABEL[next.statut]}`
          : `Tâche mise à jour : ${next.titre}`,
        `Par ${s.nom}`,
      );
    }
    if (oldAssignee && newAssignee !== oldAssignee) {
      notifT(
        oldAssignee,
        "tache_modifiee",
        `Tâche retirée : ${next.titre}`,
        `Réassignée par ${s.nom}`,
      );
    }
  }
  res.json(tacheDto(rows[0]));
});

tachesRouter.delete("/:id", async (req, res) => {
  const s = req.session;
  const existing = (
    await query("select origine, societe_id, statut from taches where id = $1", [req.params.id])
  ).rows[0];
  if (!existing) return res.status(404).json({ error: "Tâche introuvable" });
  // Le circuit société reste piloté par son responsable, mais l'admin peut
  // nettoyer une tâche société déjà Terminée (pas les tâches actives : le
  // responsable de société garde la main dessus tant qu'elles sont en cours).
  const allowed =
    existing.origine === "societe"
      ? (isResponsableSociete(s) && ownSociete(s, existing.societe_id)) ||
        (s.role === "admin" && existing.statut === "termine")
      : s.role === "admin";
  if (!allowed)
    return res.status(403).json({
      error:
        existing.origine === "societe"
          ? "Seul le responsable de la société peut supprimer cette tâche"
          : "Accès réservé à l'administrateur",
    });
  const { rows } = await query(
    "delete from taches where id = $1 returning titre, assigne_id",
    [req.params.id],
  );
  logAction(s.nom, "suppression", "tache", rows[0].titre);
  if (rows[0].assigne_id) {
    notifT(
      rows[0].assigne_id,
      "tache_modifiee",
      `Tâche supprimée : ${rows[0].titre}`,
      `Par ${s.nom}`,
    );
  }
  res.json({ ok: true });
});
