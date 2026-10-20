import { Router } from "express";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { query } from "../db.js";
import { requireAuth, requireAdmin } from "../auth.js";
import { logAction } from "../journal.js";
import { hashPassword, identifiantPris, verifierMdpAdmin } from "../passwords.js";
import { revoquerSession, sessionsDuCompte } from "../sessions.js";

/**
 * Gestion des administrateurs (plusieurs comptes). Tout administrateur actif peut en créer, modifier, désactiver ou réinitialiser un autre ;
 * l'administrateur PRINCIPAL (le compte historique) reste hors de portée des autres : il ne peut être ni désactivé, ni réinitialisé, ni voir
 * sa double authentification retirée — il y aura donc toujours au moins un administrateur actif. Chaque action sensible redemande le mot de
 * passe de celui qui agit et est inscrite au journal.
 */
export const administrateursRouter = Router();
administrateursRouter.use(requireAuth, requireAdmin);

const dto = (r) => ({
  id: r.id,
  identifiant: r.identifiant,
  nom: r.nom,
  fonction: r.fonction,
  statut: r.statut,
  principal: r.principal,
  doitChangerMotDePasse: r.doit_changer_mdp,
  doubleAuthentification: r.totp_actif,
  derniereConnexion: r.last_login ? r.last_login.toISOString() : null,
  creeLe: r.cree_le.toISOString(),
  creePar: r.cree_par,
  moi: false,
});

/** Mot de passe provisoire lisible (sans caractères ambigus), montré UNE fois à celui qui crée ou réinitialise le compte. */
function motDePasseProvisoire() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const octets = randomBytes(14);
  const car = (i) => alphabet[octets[i] % alphabet.length];
  return `${Array.from({ length: 4 }, (_, i) => car(i)).join("")}-${Array.from({ length: 4 }, (_, i) => car(4 + i)).join("")}-${Array.from({ length: 4 }, (_, i) => car(8 + i)).join("")}`;
}

/** Redemande le mot de passe de l'administrateur qui agit. */
async function confirmer(req, res) {
  const moi = (await query("select mdp_hash from administrateurs where id = $1", [req.session.adminId])).rows[0];
  if (await verifierMdpAdmin(moi.mdp_hash, req.body?.motDePasse)) return true;
  res.status(400).json({ error: "Votre mot de passe est incorrect." });
  return false;
}

async function cible(req, res) {
  if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) {
    res.status(400).json({ error: "Administrateur invalide" });
    return null;
  }
  const r = (await query("select * from administrateurs where id = $1", [req.params.id])).rows[0];
  if (!r) {
    res.status(404).json({ error: "Administrateur introuvable" });
    return null;
  }
  return r;
}
/** Le principal n'est modifiable que par lui-même. */
function protegePrincipal(req, res, c) {
  if (c.principal && c.id !== req.session.adminId) {
    res.status(403).json({ error: "L'administrateur principal ne peut être modifié que par lui-même." });
    return false;
  }
  return true;
}

administrateursRouter.get("/", async (req, res) => {
  const { rows } = await query("select * from administrateurs order by principal desc, cree_le");
  res.json(rows.map((r) => ({ ...dto(r), moi: r.id === req.session.adminId })));
});

const creation = z.object({
  nom: z.string().trim().min(2).max(80),
  fonction: z.string().trim().max(80).optional().default(""),
  identifiant: z
    .string()
    .trim()
    .min(3)
    .max(32)
    .regex(/^[a-zA-Z0-9._-]+$/, "Identifiant : lettres, chiffres, point, tiret ou souligné."),
});

administrateursRouter.post("/", async (req, res) => {
  const parsed = creation.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  if (!(await confirmer(req, res))) return;
  const v = parsed.data;
  if (await identifiantPris(v.identifiant)) return res.status(409).json({ error: "Cet identifiant existe déjà." });
  const provisoire = motDePasseProvisoire();
  const { rows } = await query(
    `insert into administrateurs (identifiant, mdp_hash, nom, fonction, doit_changer_mdp, cree_par)
     values ($1,$2,$3,$4,true,$5) returning *`,
    [v.identifiant, await hashPassword(provisoire), v.nom, v.fonction, req.session.nom],
  );
  logAction(req.session.nom, "creation", "compte", `Administrateur créé : ${v.nom} (${v.identifiant})`);
  // Le mot de passe provisoire n'est jamais relu : il n'est montré qu'ici ; la personne le remplace à sa première connexion.
  res.status(201).json({ ...dto(rows[0]), motDePasseProvisoire: provisoire });
});

administrateursRouter.patch("/:id", async (req, res) => {
  const c = await cible(req, res);
  if (!c || !protegePrincipal(req, res, c)) return;
  const parsed = creation.pick({ nom: true, fonction: true }).partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { rows } = await query("update administrateurs set nom = coalesce($1, nom), fonction = coalesce($2, fonction) where id = $3 returning *", [parsed.data.nom ?? null, parsed.data.fonction ?? null, c.id]);
  logAction(req.session.nom, "modification", "compte", `Administrateur modifié : ${rows[0].nom}`);
  res.json({ ...dto(rows[0]), moi: rows[0].id === req.session.adminId });
});

/** Désactive : le compte ne peut plus se connecter et toutes ses sessions sont refusées aussitôt. Réversible. */
administrateursRouter.post("/:id/desactiver", async (req, res) => {
  const c = await cible(req, res);
  if (!c) return;
  if (c.principal) return res.status(403).json({ error: "L'administrateur principal ne peut pas être désactivé." });
  if (c.id === req.session.adminId) return res.status(400).json({ error: "Vous ne pouvez pas désactiver votre propre compte." });
  if (!(await confirmer(req, res))) return;
  await query("update administrateurs set statut = 'desactive', session_version = session_version + 1 where id = $1", [c.id]);
  await query("delete from sessions_connexion where compte = $1", [`admin:${c.id}`]);
  logAction(req.session.nom, "modification", "compte", `Administrateur désactivé : ${c.nom}`);
  res.json({ ok: true });
});

administrateursRouter.post("/:id/reactiver", async (req, res) => {
  const c = await cible(req, res);
  if (!c) return;
  if (!(await confirmer(req, res))) return;
  await query("update administrateurs set statut = 'actif' where id = $1", [c.id]);
  logAction(req.session.nom, "modification", "compte", `Administrateur réactivé : ${c.nom}`);
  res.json({ ok: true });
});

/** Nouveau mot de passe provisoire (compte oublié) : ferme ses sessions, il choisit le sien à la prochaine connexion. Jamais pour le principal ni pour soi. */
administrateursRouter.post("/:id/reinitialiser", async (req, res) => {
  const c = await cible(req, res);
  if (!c) return;
  if (c.principal) return res.status(403).json({ error: "L'administrateur principal ne peut pas être réinitialisé par un autre." });
  if (c.id === req.session.adminId) return res.status(400).json({ error: "Changez votre propre mot de passe depuis vos paramètres." });
  if (!(await confirmer(req, res))) return;
  const provisoire = motDePasseProvisoire();
  await query("update administrateurs set mdp_hash = $1, doit_changer_mdp = true, session_version = session_version + 1 where id = $2", [await hashPassword(provisoire), c.id]);
  await query("delete from sessions_connexion where compte = $1", [`admin:${c.id}`]);
  logAction(req.session.nom, "modification", "compte", `Mot de passe d'un administrateur réinitialisé : ${c.nom}`);
  res.json({ motDePasseProvisoire: provisoire });
});

/** Téléphone perdu et codes de secours épuisés : retire la double authentification d'un autre administrateur (pas du principal). */
administrateursRouter.post("/:id/retirer-2fa", async (req, res) => {
  const c = await cible(req, res);
  if (!c) return;
  if (c.principal) return res.status(403).json({ error: "La double authentification du principal ne se retire que sur le serveur." });
  if (c.id === req.session.adminId) return res.status(400).json({ error: "Désactivez la vôtre depuis vos paramètres de sécurité." });
  if (!(await confirmer(req, res))) return;
  await query("update administrateurs set totp_actif = false, totp_secret = null, totp_attente = null, totp_dernier_pas = null, codes_secours = '[]'::jsonb, session_version = session_version + 1 where id = $1", [c.id]);
  await query("delete from sessions_connexion where compte = $1", [`admin:${c.id}`]);
  logAction(req.session.nom, "modification", "compte", `Double authentification retirée à un administrateur : ${c.nom}`);
  res.json({ ok: true });
});

/** Appareils connectés d'un autre administrateur et fermeture d'une session. */
administrateursRouter.get("/:id/sessions", async (req, res) => {
  const c = await cible(req, res);
  if (!c) return;
  res.json(await sessionsDuCompte(`admin:${c.id}`, null));
});
administrateursRouter.post("/:id/sessions/:sid/revoquer", async (req, res) => {
  const c = await cible(req, res);
  if (!c || !protegePrincipal(req, res, c)) return;
  if (!/^[0-9a-f-]{36}$/i.test(req.params.sid)) return res.status(400).json({ error: "Session invalide" });
  if (!(await revoquerSession(`admin:${c.id}`, req.params.sid))) return res.status(404).json({ error: "Cette session n'existe plus." });
  logAction(req.session.nom, "modification", "compte", `Session d'un administrateur fermée : ${c.nom}`);
  res.json({ ok: true });
});
