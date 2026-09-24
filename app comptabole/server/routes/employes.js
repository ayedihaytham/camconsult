import { Router } from "express";
import { z } from "zod";
import { query } from "../db.js";
import { requireAuth, requireAdmin, requireEquipeManager } from "../auth.js";
import { logAction } from "../journal.js";
import { notify } from "../notifications.js";
import { employeDto } from "../mappers.js";
import { sendCollaborateurWelcomeEmail, sendPasswordResetEmail } from "../mailer.js";
import {
  defaultPermissions,
  societeEmployePermissions,
  fullPermissions,
} from "../permissions.js";

export const employesRouter = Router();
// Gestion d'équipe ouverte à l'admin ET au responsable des collaborateurs
// (voir requireEquipeManager) — la suppression reste strictement admin
// (voir POST /bulk-delete ci-dessous, seule route avec son propre requireAdmin).
employesRouter.use(requireAuth, requireEquipeManager);

const schema = z.object({
  nom: z.string().min(2),
  prenom: z.string().min(2),
  identifiant: z
    .string()
    .min(3)
    .max(32)
    .regex(/^[a-z][a-z0-9._-]*$/, "Identifiant invalide"),
  motDePasse: z.string().min(8),
  type: z
    .enum(["Comptable", "Assistant", "Stagiaire", "Gestionnaire de paie"])
    .default("Assistant"),
  role: z
    .enum(["collaborateur", "societe_employe", "responsable_collaborateurs"])
    .default("collaborateur"),
  societeId: z.string().uuid().nullish(),
  email: z
    .string()
    .email("Email invalide")
    .or(z.literal(""))
    .optional()
    .default(""),
  statut: z.enum(["actif", "inactif", "en_attente"]).default("actif"),
  societesAssignees: z.array(z.string()).default([]),
  permissions: z.record(z.boolean()).optional(),
  delegue: z.boolean().default(false),
});

/** Un responsable des collaborateurs (pas admin) ne peut créer/modifier que
 * de simples comptes collaborateurs — jamais un autre responsable des
 * collaborateurs, ni un employé de société — pour ne jamais pouvoir
 * s'accorder plus de droits que ce qu'on lui a explicitement donné. */
function forbiddenRoleEscalation(req, role) {
  return req.session.role !== "admin" && role !== "collaborateur";
}

/** Normalise droits / périmètre selon le rôle. */
function scopeForRole(v) {
  if (v.role === "societe_employe") {
    return {
      societeId: v.societeId ?? null,
      societesAssignees: [],
      permissions: societeEmployePermissions(),
    };
  }
  if (v.role === "responsable_collaborateurs") {
    return {
      societeId: null,
      societesAssignees: [],
      permissions: fullPermissions(),
    };
  }
  return {
    societeId: null,
    societesAssignees: v.societesAssignees ?? [],
    permissions: { ...defaultPermissions(v.type), ...(v.permissions || {}) },
  };
}

employesRouter.get("/", async (req, res) => {
  const role = req.query.role;
  const { rows } = role
    ? await query(
        "select * from employes where role = $1 order by nom, prenom",
        [role],
      )
    : await query("select * from employes order by nom, prenom");
  res.json(rows.map(employeDto));
});

employesRouter.post("/", async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0].message });
  const v = parsed.data;
  if (forbiddenRoleEscalation(req, v.role))
    return res.status(403).json({ error: "Seul l'administrateur peut attribuer ce rôle" });
  if (v.role === "societe_employe" && !v.societeId)
    return res.status(400).json({ error: "Société requise pour un employé de société" });
  const sc = scopeForRole(v);
  try {
    const { rows } = await query(
      `insert into employes (nom, prenom, identifiant, mot_de_passe, type, role, societe_id, email, statut, societes_assignees, permissions, doit_changer_mdp, delegue)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,true,$12) returning *`,
      [
        v.nom, v.prenom, v.identifiant, v.motDePasse, v.type, v.role, sc.societeId,
        v.email, v.statut, JSON.stringify(sc.societesAssignees),
        JSON.stringify(sc.permissions), v.role === "societe_employe" && v.delegue,
      ],
    );
    logAction(
      req.session.nom,
      "creation",
      v.role === "societe_employe" ? "employe_societe" : "employe",
      `${v.prenom} ${v.nom}`,
    );
    const dto = employeDto(rows[0]);
    // Jamais bloquant : la création du compte réussit même si l'email échoue.
    sendCollaborateurWelcomeEmail(dto).catch((err) =>
      console.error("[mailer] envoi identifiants échoué", err.message),
    );
    res.status(201).json(dto);
  } catch (err) {
    if (err.code === "23505")
      return res.status(409).json({ error: "Cet identifiant existe déjà" });
    throw err;
  }
});

employesRouter.patch("/:id", async (req, res) => {
  const existing = (await query("select * from employes where id = $1", [req.params.id])).rows[0];
  if (!existing) return res.status(404).json({ error: "Collaborateur introuvable" });
  const merged = schema.partial().safeParse(req.body);
  if (!merged.success)
    return res.status(400).json({ error: merged.error.issues[0].message });
  const v = { ...employeDto(existing), ...merged.data };
  // Bloque une élévation explicite (role dans le payload) ET, séparément,
  // toute modification d'un compte déjà élevé — sinon un responsable des
  // collaborateurs pourrait rétrograder un pair en soumettant simplement
  // "collaborateur" comme role, ce que la première vérification seule
  // laisserait passer (elle ne regarde que la valeur cible, pas l'existant).
  if (
    forbiddenRoleEscalation(req, v.role) ||
    forbiddenRoleEscalation(req, existing.role ?? "collaborateur")
  )
    return res.status(403).json({ error: "Seul l'administrateur peut modifier ce compte" });
  const sc = scopeForRole(v);
  // Un mot de passe changé ici (admin/responsable qui réinitialise un
  // compte oublié) force à nouveau le changement à la prochaine connexion —
  // seul l'employé lui-même choisit son mot de passe définitif (voir
  // POST /auth/change-password). Ne touche pas au drapeau si le mot de
  // passe n'a pas bougé (simple modification de nom/email/statut…).
  const passwordChanged = v.motDePasse !== existing.mot_de_passe;
  const doitChangerMdp = passwordChanged ? true : Boolean(existing.doit_changer_mdp);
  const { rows } = await query(
    `update employes set nom=$1, prenom=$2, identifiant=$3, mot_de_passe=$4, type=$5,
       role=$6, societe_id=$7, email=$8, statut=$9, societes_assignees=$10::jsonb, permissions=$11::jsonb,
       doit_changer_mdp=$12, delegue=$14
     where id=$13 returning *`,
    [
      v.nom, v.prenom, v.identifiant, v.motDePasse, v.type, v.role, sc.societeId,
      v.email, v.statut, JSON.stringify(sc.societesAssignees),
      JSON.stringify(sc.permissions), doitChangerMdp, req.params.id,
      v.role === "societe_employe" &&
        (merged.data.delegue ?? Boolean(existing.delegue)),
    ],
  );
  logAction(req.session.nom, "modification", "employe", `${v.prenom} ${v.nom}`);
  notify(
    req.params.id,
    "compte",
    "Votre fiche a été mise à jour",
    `Par ${req.session.nom}`,
    v.role === "societe_employe" ? "/structuration" : "/",
  );
  const dto = employeDto(rows[0]);
  if (passwordChanged) {
    // Jamais bloquant : la réinitialisation réussit même si l'email échoue.
    sendPasswordResetEmail(dto).catch((err) =>
      console.error("[mailer] envoi réinitialisation échoué", err.message),
    );
  }
  res.json(dto);
});

employesRouter.patch("/:id/acces", async (req, res) => {
  const { societesAssignees, permissions } = req.body ?? {};
  const existing = (await query("select * from employes where id = $1", [req.params.id])).rows[0];
  if (!existing) return res.status(404).json({ error: "Collaborateur introuvable" });
  const { rows } = await query(
    `update employes set societes_assignees=$1::jsonb, permissions=$2::jsonb where id=$3 returning *`,
    [
      JSON.stringify(Array.isArray(societesAssignees) ? societesAssignees : []),
      JSON.stringify(permissions || {}),
      req.params.id,
    ],
  );
  logAction(
    req.session.nom,
    "acces",
    "employe",
    `Droits mis à jour — ${existing.prenom} ${existing.nom}`,
  );
  notify(
    req.params.id,
    "acces",
    "Vos droits d'accès ont été modifiés",
    `Par ${req.session.nom}`,
    "/",
  );
  res.json(employeDto(rows[0]));
});

employesRouter.post("/:id/duplicate", async (req, res) => {
  const src = (await query("select * from employes where id = $1", [req.params.id])).rows[0];
  if (!src) return res.status(404).json({ error: "Collaborateur introuvable" });
  if (forbiddenRoleEscalation(req, src.role ?? "collaborateur"))
    return res.status(403).json({ error: "Seul l'administrateur peut dupliquer ce compte" });
  let identifiant = `${src.identifiant}.copie`;
  let n = 1;
  while (
    (await query("select 1 from employes where identifiant = $1", [identifiant])).rows.length
  ) {
    identifiant = `${src.identifiant}.copie${++n}`;
  }
  const { rows } = await query(
    `insert into employes (nom, prenom, identifiant, mot_de_passe, type, role, societe_id, email, statut, societes_assignees, permissions, doit_changer_mdp)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,true) returning *`,
    [
      `${src.nom} (copie)`, src.prenom, identifiant, src.mot_de_passe, src.type,
      src.role ?? "collaborateur", src.societe_id ?? null,
      src.email, src.statut, JSON.stringify(src.societes_assignees),
      JSON.stringify(src.permissions),
    ],
  );
  logAction(req.session.nom, "duplication", "employe", `${src.prenom} ${src.nom}`);
  res.status(201).json(employeDto(rows[0]));
});

employesRouter.post("/bulk-delete", requireAdmin, async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
  if (ids.length === 0) return res.json({ deleted: 0 });
  const { rows } = await query(
    "delete from employes where id = any($1::uuid[]) returning prenom, nom",
    [ids],
  );
  // Nettoie les conversations orphelines
  await query(
    "delete from messages where conversation_id = any($1)",
    [ids.map((id) => `conv-${id}`)],
  );
  logAction(
    req.session.nom,
    "suppression",
    "employe",
    rows.length > 1
      ? `${rows.length} collaborateurs`
      : rows[0]
        ? `${rows[0].prenom} ${rows[0].nom}`
        : "collaborateur",
  );
  res.json({ deleted: rows.length });
});
