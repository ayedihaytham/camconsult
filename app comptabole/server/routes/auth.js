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

export const authRouter = Router();

authRouter.post("/login", async (req, res) => {
  const { identifiant, motDePasse } = req.body ?? {};
  if (!identifiant || !motDePasse)
    return res.status(400).json({ error: "Identifiant et mot de passe requis" });

  const id = String(identifiant).trim().toLowerCase();

  // 1. Admin
  const meta = (await query("select * from app_meta where id = 1")).rows[0];
  if (meta && id === meta.admin_identifiant.toLowerCase()) {
    const ok = await bcrypt.compare(String(motDePasse), meta.admin_password_hash);
    if (ok) {
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
  if (emp && String(motDePasse) === emp.mot_de_passe) {
    await query("update employes set last_login = now() where id = $1", [emp.id]);
    const token = signToken({ role: "employe", employeId: emp.id });
    const session = await sessionFromToken({
      role: "employe",
      employeId: emp.id,
    });
    logAction(session.nom, "connexion", "compte", `${session.nom} (${emp.type})`);
    return res.json({ token, session });
  }

  return res.status(401).json({ error: "Identifiant ou mot de passe incorrect" });
});

authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ session: req.session });
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
