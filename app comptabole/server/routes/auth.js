import { Router } from "express";
import bcrypt from "bcryptjs";
import { query, withTransaction } from "../db.js";
import {
  jetonAdmin,
  jetonEmploye,
  sessionAdmin,
  sessionEmploye,
  requireAuth,
  requireAdmin,
} from "../auth.js";
import { logAction } from "../journal.js";
import { loginGuard, activationGuard, adresseClient, egalConstant, leverBlocage } from "../loginGuard.js";
import { hashPassword, verifyPassword, besoinDeRehash, estHash, verificationFactice, consommerJeton, lireJeton, motDePasseAcceptable } from "../passwords.js";

export const authRouter = Router();

/** Vérifie le mot de passe d'un employé. Un compte hérité (valeur en clair, sans empreinte) est converti à la première
 * connexion réussie : l'empreinte est enregistrée et la valeur en clair effacée. Un compte sans aucun des deux n'a pas
 * encore d'accès : il faut un lien d'activation. */
async function motDePasseValide(emp, saisi) {
  if (estHash(emp.mdp_hash)) {
    const ok = await verifyPassword(saisi, emp.mdp_hash);
    // Mise à niveau des paramètres : conditionnelle, pour ne jamais écraser un mot de passe changé entre-temps.
    if (ok && besoinDeRehash(emp.mdp_hash))
      await query("update employes set mdp_hash = $1 where id = $2 and mdp_hash = $3", [await hashPassword(saisi), emp.id, emp.mdp_hash]);
    return ok;
  }
  if (emp.mot_de_passe && egalConstant(saisi, emp.mot_de_passe)) {
    // Période de validation d'une mise en ligne : MIGRATE_LEGACY_PASSWORDS=false laisse les comptes hérités se connecter SANS les
    // convertir, ce qui garde un retour à l'ancienne version possible pour eux. À repasser à true (défaut) une fois la version validée.
    if (process.env.MIGRATE_LEGACY_PASSWORDS === "false") return true;
    // Conversion conditionnelle : deux premières connexions simultanées ne s'écrasent pas, et une conversion tardive ne remplace
    // jamais un mot de passe défini entre-temps (activation par lien).
    await query("update employes set mdp_hash = $1, mot_de_passe = '' where id = $2 and mdp_hash is null and mot_de_passe = $3", [
      await hashPassword(saisi),
      emp.id,
      emp.mot_de_passe,
    ]);
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
  const attente = await loginGuard.attente(adresseClient(req), id);
  if (attente > 0) {
    res.setHeader("Retry-After", String(attente));
    return res.status(429).json({ error: `Trop de tentatives. Réessayez dans ${Math.ceil(attente / 60)} minute(s).` });
  }

  // 1. Admin
  const meta = (await query("select * from app_meta where id = 1")).rows[0];
  if (meta && id === meta.admin_identifiant.toLowerCase()) {
    const ok = await bcrypt.compare(String(motDePasse), meta.admin_password_hash);
    if (ok) {
      await loginGuard.succes(adresseClient(req), id);
      await query("update app_meta set last_login = now() where id = 1");
      const token = await jetonAdmin();
      const session = await sessionAdmin();
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
    await loginGuard.succes(adresseClient(req), id);
    await query("update employes set last_login = now() where id = $1", [emp.id]);
    const token = await jetonEmploye(emp.id);
    const session = await sessionEmploye(emp.id);
    logAction(session.nom, "connexion", "compte", `${session.nom} (${emp.type})`);
    return res.json({ token, session });
  }

  await loginGuard.echec(adresseClient(req), id);
  return res.status(401).json({ error: "Identifiant ou mot de passe incorrect" });
});

/** Activation d'un compte ou réinitialisation du mot de passe par un lien à usage unique (jeton envoyé par le cabinet). */
authRouter.post("/activate", async (req, res) => {
  const { token, motDePasse } = req.body ?? {};
  const attente = await activationGuard.attente(adresseClient(req), "activation");
  if (attente > 0) {
    res.setHeader("Retry-After", String(attente));
    return res.status(429).json({ error: "Trop de tentatives. Réessayez plus tard." });
  }
  const refus = motDePasseAcceptable(motDePasse);
  if (refus) return res.status(400).json({ error: refus });
  const lienInvalide = async () => {
    await activationGuard.echec(adresseClient(req), "activation");
    return res.status(400).json({ error: "Ce lien est invalide ou a expiré. Demandez-en un nouveau au cabinet." });
  };
  // Les vérifications se font avant la consommation : un mot de passe refusé ne brûle pas le lien.
  const attendu = await lireJeton(token);
  if (!attendu) return lienInvalide();
  const { rows } = await query("select identifiant, statut from employes where id = $1", [attendu]);
  if (!rows[0] || rows[0].statut !== "actif") return res.status(400).json({ error: "Ce compte n'est pas actif." });
  const refusCompte = motDePasseAcceptable(motDePasse, rows[0].identifiant);
  if (refusCompte) return res.status(400).json({ error: refusCompte });
  const hash = await hashPassword(motDePasse);
  // Une seule transaction : si l'enregistrement du mot de passe échoue, le lien n'est pas consommé et peut resservir.
  const employeId = await withTransaction(async (client) => {
    const id = await consommerJeton(token, (sql, params) => client.query(sql, params));
    if (!id) return null;
    await client.query("update employes set mdp_hash = $1, mot_de_passe = '', doit_changer_mdp = false, last_login = now(), session_version = session_version + 1 where id = $2", [hash, id]);
    return id;
  });
  if (!employeId) return lienInvalide();
  // Un mot de passe réinitialisé lève le blocage de connexion de la personne (jamais celui de l'administrateur).
  await leverBlocage(rows[0].identifiant);
  const nouveau = await jetonEmploye(employeId);
  const session = await sessionEmploye(employeId);
  logAction(session.nom, "modification", "compte", "Mot de passe défini par lien d'activation");
  res.json({ token: nouveau, session });
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
    "update employes set mdp_hash = $1, mot_de_passe = '', doit_changer_mdp = false, session_version = session_version + 1 where id = $2",
    [await hashPassword(motDePasse), req.session.employeId],
  );
  logAction(req.session.nom, "modification", "compte", "Mot de passe changé");
  // Les anciens jetons (autres appareils, session volée) sont désormais refusés : celui-ci les remplace pour cet appareil.
  const token = await jetonEmploye(req.session.employeId);
  const session = await sessionEmploye(req.session.employeId);
  res.json({ session, token });
});

/** « Déconnecter mes autres appareils » : la version des sessions du compte monte, tous les autres jetons sont refusés ; un jeton neuf
 * garde l'appareil courant connecté. Utile après avoir ouvert sa session sur un poste partagé, ou si un jeton a pu être copié. */
authRouter.post("/deconnecter-autres", requireAuth, async (req, res) => {
  if (req.session.role === "admin") {
    await query("update app_meta set session_version = session_version + 1 where id = 1");
    logAction(req.session.nom, "modification", "compte", "Autres appareils déconnectés (administrateur)");
    return res.json({ token: await jetonAdmin() });
  }
  await query("update employes set session_version = session_version + 1 where id = $1", [req.session.employeId]);
  logAction(req.session.nom, "modification", "compte", "Autres appareils déconnectés");
  res.json({ token: await jetonEmploye(req.session.employeId) });
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
    // Même règle que pour les employés (longueur, ne contient pas l'identifiant).
    const refus = motDePasseAcceptable(motDePasse, nextId);
    if (refus) return res.status(400).json({ error: refus });
    hash = await bcrypt.hash(String(motDePasse), 10);
  }
  // Un nouveau mot de passe déconnecte les autres sessions de l'administrateur ; un jeton neuf garde celle-ci ouverte.
  await query(
    "update app_meta set admin_identifiant = $1, admin_password_hash = $2, session_version = session_version + (case when $3 then 1 else 0 end) where id = 1",
    [nextId, hash, Boolean(motDePasse)],
  );
  logAction(req.session.nom, "modification", "compte", "Identifiants de connexion administrateur");
  res.json({ ok: true, ...(motDePasse ? { token: await jetonAdmin() } : {}) });
});

authRouter.patch("/profile", requireAuth, requireAdmin, async (req, res) => {
  const { nom, role } = req.body ?? {};
  await query(
    "update app_meta set admin_nom = coalesce($1, admin_nom), admin_role = coalesce($2, admin_role) where id = 1",
    [nom ?? null, role ?? null],
  );
  logAction(req.session.nom, "modification", "compte", "Profil administrateur");
  res.json({ session: await sessionAdmin() });
});
