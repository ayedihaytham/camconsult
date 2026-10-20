import { Router } from "express";
import bcrypt from "bcryptjs";
import { query, withTransaction } from "../db.js";
import { chiffrerSecret, dechiffrerSecret, empreinteSecours, genererCodesSecours, genererSecret, ressembleAUnCodeDeSecours, uriOtpauth, verifierCode } from "../totp.js";
import { cleCompte, revoquerAutres, revoquerSession, sessionsDuCompte } from "../sessions.js";
import {
  effacerCookieSession,
  livrerJeton,
  modeCookie,
  poserCookieSession,
  signTicket2fa,
  lireTicket2fa,
  ouvrirJeton,
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
    if (ok && meta.totp_actif) {
      // Mot de passe correct, mais la double authentification est active : pas de session avant le code (ticket de 5 minutes, sans droits).
      return res.json({ etape: "2fa", ticket: signTicket2fa() });
    }
    if (ok) {
      await loginGuard.succes(adresseClient(req), id);
      await query("update app_meta set last_login = now() where id = 1");
      const token = await ouvrirJeton(req, { role: "admin" });
      const session = await sessionAdmin();
      logAction(session.nom, "connexion", "compte", `${session.nom} (administrateur)`);
      return res.json({ ...livrerJeton(req, res, token), session });
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
    const token = await ouvrirJeton(req, { role: "employe", employeId: emp.id });
    const session = await sessionEmploye(emp.id);
    logAction(session.nom, "connexion", "compte", `${session.nom} (${emp.type})`);
    return res.json({ ...livrerJeton(req, res, token), session });
  }

  await loginGuard.echec(adresseClient(req), id);
  return res.status(401).json({ error: "Identifiant ou mot de passe incorrect" });
});

/**
 * Deuxième facteur de l'administrateur : un code à 6 chiffres de l'application, ou un code de secours (à usage unique). Un code TOTP ne sert
 * jamais deux fois (le dernier pas utilisé est enregistré, la mise à jour est atomique). Renvoie vrai si le facteur est valable.
 */
async function deuxiemeFacteurValide(saisi) {
  const meta = (await query("select totp_secret, totp_dernier_pas, codes_secours from app_meta where id = 1")).rows[0];
  if (!meta?.totp_secret) return false;
  if (ressembleAUnCodeDeSecours(saisi)) {
    // Atomique : deux saisies simultanées du même code de secours ne passent pas toutes les deux.
    const r = await query("update app_meta set codes_secours = codes_secours - $1::text where id = 1 and codes_secours @> to_jsonb($1::text)", [empreinteSecours(saisi)]);
    return r.rowCount === 1;
  }
  let secret;
  try {
    secret = dechiffrerSecret(meta.totp_secret);
  } catch {
    return false;
  }
  const pas = verifierCode(secret, saisi, { dernierPas: meta.totp_dernier_pas });
  if (pas === null) return false;
  const r = await query("update app_meta set totp_dernier_pas = $1 where id = 1 and (totp_dernier_pas is null or totp_dernier_pas < $1)", [pas]);
  return r.rowCount === 1;
}

/** Deuxième étape de la connexion de l'administrateur. Les essais comptent dans le même blocage que le mot de passe. */
authRouter.post("/2fa", async (req, res) => {
  const { ticket, code } = req.body ?? {};
  const meta = (await query("select * from app_meta where id = 1")).rows[0];
  const id = String(meta?.admin_identifiant ?? "").toLowerCase();
  const attente = await loginGuard.attente(adresseClient(req), id);
  if (attente > 0) {
    res.setHeader("Retry-After", String(attente));
    return res.status(429).json({ error: `Trop de tentatives. Réessayez dans ${Math.ceil(attente / 60)} minute(s).` });
  }
  if (!lireTicket2fa(ticket)) return res.status(401).json({ error: "La vérification a expiré : reprenez la connexion." });
  if (!meta.totp_actif) return res.status(400).json({ error: "La double authentification n'est pas active." });
  if (!(await deuxiemeFacteurValide(code))) {
    await loginGuard.echec(adresseClient(req), id);
    return res.status(401).json({ error: "Code incorrect." });
  }
  await loginGuard.succes(adresseClient(req), id);
  await query("update app_meta set last_login = now() where id = 1");
  const token = await ouvrirJeton(req, { role: "admin" });
  const session = await sessionAdmin();
  logAction(session.nom, "connexion", "compte", `${session.nom} (administrateur, double authentification)`);
  res.json({ ...livrerJeton(req, res, token), session });
});

/** Gestion de la double authentification : réservée à l'administrateur connecté, et chaque action sensible redemande le mot de passe. */
async function motDePasseAdminValide(req, res) {
  const meta = (await query("select admin_password_hash from app_meta where id = 1")).rows[0];
  if (await bcrypt.compare(String(req.body?.motDePasse ?? ""), meta.admin_password_hash)) return true;
  res.status(400).json({ error: "Mot de passe incorrect." });
  return false;
}

authRouter.get("/2fa/statut", requireAuth, requireAdmin, async (_req, res) => {
  const m = (await query("select totp_actif, codes_secours from app_meta where id = 1")).rows[0];
  res.json({ actif: Boolean(m.totp_actif), codesSecoursRestants: m.totp_actif ? (m.codes_secours ?? []).length : 0 });
});

/** Étape 1 : un secret provisoire (et son adresse otpauth pour le QR code). Rien n'est actif tant que le code n'est pas confirmé. */
authRouter.post("/2fa/preparer", requireAuth, requireAdmin, async (req, res) => {
  if (!(await motDePasseAdminValide(req, res))) return;
  const m = (await query("select totp_actif, admin_identifiant from app_meta where id = 1")).rows[0];
  if (m.totp_actif) return res.status(409).json({ error: "La double authentification est déjà active." });
  const secret = genererSecret();
  await query("update app_meta set totp_attente = $1 where id = 1", [chiffrerSecret(secret)]);
  res.json({ secret, uri: uriOtpauth({ secret, compte: m.admin_identifiant, emetteur: "Cabinet CamConsult" }) });
});

/** Étape 2 : le code de l'application confirme que le téléphone est bien enregistré. Les autres sessions sont fermées, les codes de secours donnés une fois. */
authRouter.post("/2fa/activer", requireAuth, requireAdmin, async (req, res) => {
  const m = (await query("select totp_actif, totp_attente from app_meta where id = 1")).rows[0];
  if (m.totp_actif) return res.status(409).json({ error: "La double authentification est déjà active." });
  if (!m.totp_attente) return res.status(400).json({ error: "Recommencez : aucune activation en cours." });
  const adresse = adresseClient(req);
  const attente = await loginGuard.attente(adresse, "2fa-activation");
  if (attente > 0) return res.status(429).json({ error: "Trop de tentatives. Réessayez plus tard." });
  const secret = dechiffrerSecret(m.totp_attente);
  const pas = verifierCode(secret, req.body?.code);
  if (pas === null) {
    await loginGuard.echec(adresse, "2fa-activation");
    return res.status(400).json({ error: "Code incorrect. Vérifiez l'heure de votre téléphone et réessayez." });
  }
  const codes = genererCodesSecours();
  await query(
    `update app_meta set totp_actif = true, totp_secret = totp_attente, totp_attente = null, totp_dernier_pas = $1,
            codes_secours = $2::jsonb, session_version = session_version + 1 where id = 1`,
    [pas, JSON.stringify(codes.map(empreinteSecours))],
  );
  logAction(req.session.nom, "modification", "compte", "Double authentification activée (administrateur)");
  res.json({ codesSecours: codes, ...livrerJeton(req, res, await ouvrirJeton(req, { role: "admin" }, { remplacer: true })) });
});

/** Désactivation : mot de passe ET un code (application ou secours). */
authRouter.post("/2fa/desactiver", requireAuth, requireAdmin, async (req, res) => {
  if (!(await motDePasseAdminValide(req, res))) return;
  if (!(await deuxiemeFacteurValide(req.body?.code))) return res.status(400).json({ error: "Code incorrect." });
  await query("update app_meta set totp_actif = false, totp_secret = null, totp_attente = null, totp_dernier_pas = null, codes_secours = '[]'::jsonb, session_version = session_version + 1 where id = 1");
  logAction(req.session.nom, "modification", "compte", "Double authentification désactivée (administrateur)");
  res.json({ ok: true, ...livrerJeton(req, res, await ouvrirJeton(req, { role: "admin" }, { remplacer: true })) });
});

/** Nouveaux codes de secours (les anciens sont annulés) : mot de passe ET un code. */
authRouter.post("/2fa/codes-secours", requireAuth, requireAdmin, async (req, res) => {
  if (!(await motDePasseAdminValide(req, res))) return;
  if (!(await deuxiemeFacteurValide(req.body?.code))) return res.status(400).json({ error: "Code incorrect." });
  const codes = genererCodesSecours();
  await query("update app_meta set codes_secours = $1::jsonb where id = 1", [JSON.stringify(codes.map(empreinteSecours))]);
  logAction(req.session.nom, "modification", "compte", "Codes de secours de la double authentification régénérés");
  res.json({ codesSecours: codes });
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
  const nouveau = await ouvrirJeton(req, { role: "employe", employeId }, { remplacer: true });
  const session = await sessionEmploye(employeId);
  logAction(session.nom, "modification", "compte", "Mot de passe défini par lien d'activation");
  res.json({ ...livrerJeton(req, res, nouveau), session });
});

authRouter.get("/me", requireAuth, (req, res) => {
  // Migration : un navigateur qui présente encore son ancien jeton (stockage local) en mode cookie reçoit son cookie, sans se reconnecter.
  if (modeCookie(req) && !req.viaCookie) poserCookieSession(req, res, req.jeton);
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
  const token = await ouvrirJeton(req, { role: "employe", employeId: req.session.employeId }, { remplacer: true });
  const session = await sessionEmploye(req.session.employeId);
  res.json({ session, ...livrerJeton(req, res, token) });
});

/** « Déconnecter mes autres appareils » : la version des sessions du compte monte, tous les autres jetons sont refusés ; un jeton neuf
 * garde l'appareil courant connecté. Utile après avoir ouvert sa session sur un poste partagé, ou si un jeton a pu être copié. */
authRouter.post("/deconnecter-autres", requireAuth, async (req, res) => {
  if (req.session.role === "admin") {
    await query("update app_meta set session_version = session_version + 1 where id = 1");
    logAction(req.session.nom, "modification", "compte", "Autres appareils déconnectés (administrateur)");
    return res.json(livrerJeton(req, res, await ouvrirJeton(req, { role: "admin" }, { remplacer: true })));
  }
  await query("update employes set session_version = session_version + 1 where id = $1", [req.session.employeId]);
  logAction(req.session.nom, "modification", "compte", "Autres appareils déconnectés");
  res.json(livrerJeton(req, res, await ouvrirJeton(req, { role: "employe", employeId: req.session.employeId }, { remplacer: true })));
});

authRouter.post("/logout", requireAuth, async (req, res) => {
  if (req.sid) await revoquerSession(cleCompte(req.session), req.sid);
  effacerCookieSession(req, res);
  logAction(req.session.nom, "deconnexion", "compte", req.session.nom);
  res.json({ ok: true });
});

/** Appareils connectés du compte : une ligne par session ouverte, la courante marquée. */
authRouter.get("/sessions", requireAuth, async (req, res) => {
  res.json(await sessionsDuCompte(cleCompte(req.session), req.sid));
});

/** Révoque UNE session du compte (un autre appareil). La session courante se ferme par « Se déconnecter ». */
authRouter.post("/sessions/:id/revoquer", requireAuth, async (req, res) => {
  if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) return res.status(400).json({ error: "Session invalide" });
  if (req.params.id === req.sid) return res.status(400).json({ error: "C'est la session de cet appareil : utilisez « Se déconnecter »." });
  const ok = await revoquerSession(cleCompte(req.session), req.params.id);
  if (!ok) return res.status(404).json({ error: "Cette session n'existe plus." });
  logAction(req.session.nom, "modification", "compte", "Une session a été fermée depuis la liste des appareils");
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
  res.json({ ok: true, ...(motDePasse ? livrerJeton(req, res, await ouvrirJeton(req, { role: "admin" }, { remplacer: true })) : {}) });
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
