import { Router } from "express";
import bcrypt from "bcryptjs";
import { query } from "../db.js";
import {
  signToken,
  sessionFromToken,
  requireAuth,
  requireAdmin,
} from "../auth.js";
import { logAction } from "../journal.js";
import { loginGuard, adresseClient, egalConstant } from "../loginGuard.js";
import { hashPassword, verifyPassword, besoinDeRehash, estHash, verificationFactice, consommerJeton, lireJeton, motDePasseAcceptable } from "../passwords.js";

export const authRouter = Router();

/** Vérifie le mot de passe d'un employé. Un compte hérité (valeur en clair, sans empreinte) est converti à la première
 * connexion réussie : l'empreinte est enregistrée et la valeur en clair effacée. Un compte sans aucun des deux n'a pas
 * encore d'accès : il faut un lien d'activation. */
async function motDePasseValide(emp, saisi) {
  if (estHash(emp.mdp_hash)) {
    const ok = await verifyPassword(saisi, emp.mdp_hash);
    if (ok && besoinDeRehash(emp.mdp_hash))
      await query("update employes set mdp_hash = $1 where id = $2", [await hashPassword(saisi), emp.id]);
    return ok;
  }
  if (emp.mot_de_passe && egalConstant(saisi, emp.mot_de_passe)) {
    await query("update employes set mdp_hash = $1, mot_de_passe = '' where id = $2", [await hashPassword(saisi), emp.id]);
    return true;
  }
  await verificationFactice(saisi);
  return false;
}

authRouter.post("/login", async (req, res) => {
  const { identifiant, motDePasse } = req.body ?? {};
  if (!identifiant || !motDePasse)
    return res.status(400).json({ error: "Identifiant et mot de passe requis" });

  const id = String(identifiant).trim().toLowerCase();

  // Force brute : trop d'échecs récents pour ce compte ou depuis cette adresse.
  const attente = loginGuard.attente(adresseClient(req), id);
  if (attente > 0) {
    res.setHeader("Retry-After", String(attente));
    return res.status(429).json({ error: `Trop de tentatives. Réessayez dans ${Math.ceil(attente / 60)} minute(s).` });
  }

  // 1. Admin
  const meta = (await query("select * from app_meta where id = 1")).rows[0];
  if (meta && id === meta.admin_identifiant.toLowerCase()) {
    const ok = await bcrypt.compare(String(motDePasse), meta.admin_password_hash);
    if (ok) {
      loginGuard.succes(adresseClient(req), id);
      await query("update app_meta set last_login = now() where id = 1");
      const token = signToken({ role: "admin" });
      const session = await sessionFromToken({ role: "admin" });
      logAction(session.nom, "connexion", "compte", `${session.nom} (administrateur)`);
      return res.json({ token, session });
    }
  }

  // 2. Employé actif
  const emp = (
    await query(
      "select * from employes where lower(identifiant) = $1 and statut = 'actif'",
      [id],
    )
  ).rows[0];
  if (!emp) await verificationFactice(motDePasse);
  else if (await motDePasseValide(emp, motDePasse)) {
    loginGuard.succes(adresseClient(req), id);
    await query("update employes set last_login = now() where id = $1", [emp.id]);
    const token = signToken({ role: "employe", employeId: emp.id });
    const session = await sessionFromToken({
      role: "employe",
      employeId: emp.id,
    });
    logAction(session.nom, "connexion", "compte", `${session.nom} (${emp.type})`);
    return res.json({ token, session });
  }

  loginGuard.echec(adresseClient(req), id);
  return res.status(401).json({ error: "Identifiant ou mot de passe incorrect" });
});

/** Activation d'un compte ou réinitialisation du mot de passe par un lien à usage unique (jeton envoyé par le cabinet). */
authRouter.post("/activate", async (req, res) => {
  const { token, motDePasse } = req.body ?? {};
  const attente = loginGuard.attente(adresseClient(req), "activation");
  if (attente > 0) {
    res.setHeader("Retry-After", String(attente));
    return res.status(429).json({ error: "Trop de tentatives. Réessayez plus tard." });
  }
  const refus = motDePasseAcceptable(motDePasse);
  if (refus) return res.status(400).json({ error: refus });
  const lienInvalide = () => {
    loginGuard.echec(adresseClient(req), "activation");
    return res.status(400).json({ error: "Ce lien est invalide ou a expiré. Demandez-en un nouveau au cabinet." });
  };
  // Les vérifications se font avant la consommation : un mot de passe refusé ne brûle pas le lien.
  const attendu = await lireJeton(token);
  if (!attendu) return lienInvalide();
  const { rows } = await query("select identifiant, statut from employes where id = $1", [attendu]);
  if (!rows[0] || rows[0].statut !== "actif") return res.status(400).json({ error: "Ce compte n'est pas actif." });
  const refusCompte = motDePasseAcceptable(motDePasse, rows[0].identifiant);
  if (refusCompte) return res.status(400).json({ error: refusCompte });
  const employeId = await consommerJeton(token);
  if (!employeId) return lienInvalide();
  await query("update employes set mdp_hash = $1, mot_de_passe = '', doit_changer_mdp = false, last_login = now() where id = $2", [
    await hashPassword(motDePasse),
    employeId,
  ]);
  const session = await sessionFromToken({ role: "employe", employeId });
  logAction(session.nom, "modification", "compte", "Mot de passe défini par lien d'activation");
  res.json({ token: signToken({ role: "employe", employeId }), session });
});

authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ session: req.session });
});

/** Changement de mot de passe par l'employé lui-même — utilisé pour le
 * changement forcé à la 1ère connexion (ou après une réinitialisation par
 * l'admin/le responsable des collaborateurs, voir routes/employes.js).
 * L'admin change le sien via PATCH /credentials, pas cette route. */
authRouter.post("/change-password", requireAuth, async (req, res) => {
  if (req.session.role !== "employe")
    return res.status(403).json({ error: "Réservé aux comptes employé" });
  const { motDePasse } = req.body ?? {};
  const refus = motDePasseAcceptable(motDePasse, req.session.identifiant);
  if (refus) return res.status(400).json({ error: refus });
  await query(
    "update employes set mdp_hash = $1, mot_de_passe = '', doit_changer_mdp = false where id = $2",
    [await hashPassword(motDePasse), req.session.employeId],
  );
  logAction(req.session.nom, "modification", "compte", "Mot de passe changé");
  const session = await sessionFromToken({
    role: "employe",
    employeId: req.session.employeId,
  });
  res.json({ session });
});

authRouter.post("/logout", requireAuth, (req, res) => {
  logAction(req.session.nom, "deconnexion", "compte", req.session.nom);
  res.json({ ok: true });
});

authRouter.patch("/credentials", requireAuth, requireAdmin, async (req, res) => {
  const { currentPassword, identifiant, motDePasse } = req.body ?? {};
  const meta = (await query("select * from app_meta where id = 1")).rows[0];
  const ok = await bcrypt.compare(
    String(currentPassword ?? ""),
    meta.admin_password_hash,
  );
  if (!ok) return res.status(400).json({ error: "Mot de passe actuel incorrect." });

  const nextId = (identifiant ?? meta.admin_identifiant).trim();
  if (nextId.length < 3)
    return res.status(400).json({ error: "Identifiant trop court." });
  let hash = meta.admin_password_hash;
  if (motDePasse) {
    if (String(motDePasse).length < 8)
      return res.status(400).json({ error: "Mot de passe : 8 caractères minimum." });
    hash = await bcrypt.hash(String(motDePasse), 10);
  }
  await query(
    "update app_meta set admin_identifiant = $1, admin_password_hash = $2 where id = 1",
    [nextId, hash],
  );
  logAction(req.session.nom, "modification", "compte", "Identifiants de connexion administrateur");
  res.json({ ok: true });
});

authRouter.patch("/profile", requireAuth, requireAdmin, async (req, res) => {
  const { nom, role } = req.body ?? {};
  await query(
    "update app_meta set admin_nom = coalesce($1, admin_nom), admin_role = coalesce($2, admin_role) where id = 1",
    [nom ?? null, role ?? null],
  );
  logAction(req.session.nom, "modification", "compte", "Profil administrateur");
  const session = await sessionFromToken({ role: "admin" });
  res.json({ session });
});
