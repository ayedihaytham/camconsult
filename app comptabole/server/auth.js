import "dotenv/config";
import jwt from "jsonwebtoken";
import { query } from "./db.js";
import { adresseClient } from "./loginGuard.js";
import { ouvrirSession, prolongerSession, sessionValide } from "./sessions.js";
import {
  defaultPermissions,
  societeEmployePermissions,
  fullPermissions,
} from "./permissions.js";

const SECRET_PAR_DEFAUT = "dev-secret-change-me";
const SECRET = process.env.JWT_SECRET || SECRET_PAR_DEFAUT;
// Un secret connu permettrait de forger un jeton administrateur : jamais en production.
if (process.env.NODE_ENV === "production" && (SECRET === SECRET_PAR_DEFAUT || SECRET.length < 24)) {
  throw new Error("JWT_SECRET doit être défini en production (24 caractères aléatoires au moins).");
}

const ALGORITHME = "HS256";
/** Une session active se prolonge : au-delà de cet âge, la réponse porte un jeton neuf (en-tête X-Token-Renouvele). Inactive 12 h, elle expire. */
const RENOUVELLEMENT_APRES_S = 3 * 3600;

export function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: "12h", algorithm: ALGORITHME });
}

/** Ticket de la deuxième étape de connexion (double authentification) : prouve que le mot de passe a été vérifié, ne donne AUCUN droit.
 * Il porte `typ: "2fa"` et pas de rôle ; `requireAuth` le refuse explicitement. Valable 5 minutes. */
export function signTicket2fa() {
  return jwt.sign({ typ: "2fa" }, SECRET, { expiresIn: "5m", algorithm: ALGORITHME });
}
export function lireTicket2fa(ticket) {
  try {
    const p = jwt.verify(String(ticket ?? ""), SECRET, { algorithms: [ALGORITHME] });
    return p.typ === "2fa";
  } catch {
    return false;
  }
}

/** Vrai si le jeton date d'avant le dernier changement de mot de passe du compte : il porte l'ancienne version des sessions.
 * Un jeton sans version (émis avant cette protection) vaut la version 0, celle de tout compte jamais modifié. */
function jetonRevoque(payload, versionCompte) {
  return (payload?.v ?? 0) !== (versionCompte ?? 0);
}

/**
 * Ouvre une session pour un compte et renvoie son jeton : une ligne « session » (appareil, adresse, dates) est créée, le jeton porte son
 * identifiant `sid` et la version courante des sessions du compte (relue en base : après un changement de mot de passe, c'est la nouvelle).
 * `identite` : `{ role: "admin" }` ou `{ role: "employe", employeId }`. `remplacer` supprime d'abord les autres sessions du compte
 * (changement de mot de passe, « déconnecter mes autres appareils ») : la nouvelle est alors la seule.
 */
export async function ouvrirJeton(req, identite, { remplacer = false } = {}) {
  const admin = identite.role === "admin";
  const { rows } = admin
    ? await query("select session_version from app_meta where id = 1")
    : await query("select session_version from employes where id = $1", [identite.employeId]);
  const sid = await ouvrirSession({ compte: admin ? "admin" : String(identite.employeId), adresse: adresseClient(req), navigateur: req.headers?.["user-agent"], remplacer });
  return signToken({ ...(admin ? { role: "admin" } : { role: "employe", employeId: identite.employeId }), v: rows[0]?.session_version ?? 0, sid });
}

/** Session à jour d'un compte (relue en base, version des sessions comprise), pour les réponses qui suivent une connexion ou un changement. */
export async function sessionAdmin() {
  const { rows } = await query("select session_version from app_meta where id = 1");
  return sessionFromToken({ role: "admin", v: rows[0]?.session_version ?? 0 });
}
export async function sessionEmploye(employeId) {
  const { rows } = await query("select session_version from employes where id = $1", [employeId]);
  return sessionFromToken({ role: "employe", employeId, v: rows[0]?.session_version ?? 0 });
}

/** Reconstruit la session (droits à jour) à partir du payload du jeton. */
export async function sessionFromToken(payload) {
  if (payload.role === "admin") {
    const { rows } = await query(
      "select admin_nom, admin_role, admin_identifiant, last_login, session_version from app_meta where id = 1",
    );
    const meta = rows[0] ?? {};
    if (jetonRevoque(payload, meta.session_version)) return null;
    return {
      role: "admin",
      identifiant: meta.admin_identifiant ?? "",
      poste: null,
      lectureSeule: false,
      employeId: null,
      nom: meta.admin_nom ?? "Administrateur",
      fonction: meta.admin_role ?? "",
      initiales: initials(meta.admin_nom ?? "AD"),
      cabinetNom: meta.admin_nom ?? "Cabinet",
      cabinetDerniereConnexion: meta.last_login
        ? meta.last_login.toISOString?.() ?? String(meta.last_login)
        : null,
      permissions: {
        consulterDossiers: true,
        deposerFichiers: true,
        modifierSocietes: true,
        supprimer: true,
        messagerie: true,
      },
      societeIds: null, // null = toutes
      // L'admin change son mot de passe via Paramètres (PATCH /credentials),
      // jamais concerné par le changement forcé à la connexion.
      doitChangerMotDePasse: false,
    };
  }

  const { rows } = await query(
    "select * from employes where id = $1",
    [payload.employeId],
  );
  const e = rows[0];
  if (!e || e.statut !== "actif") return null;
  if (jetonRevoque(payload, e.session_version)) return null;
  const meta = (
    await query("select admin_nom, last_login from app_meta where id = 1")
  ).rows[0];
  const nom = `${e.prenom} ${e.nom}`;
  const poste =
    e.role === "societe_employe"
      ? "societe_employe"
      : e.role === "responsable_collaborateurs"
        ? "responsable_collaborateurs"
        : "collaborateur";
  const isSocieteEmp = poste === "societe_employe";
  const isResponsableEquipe = poste === "responsable_collaborateurs";

  // Un collaborateur voit ses sociétés assignées + celles des tâches qu'on lui confie
  // (il doit pouvoir consulter le dossier client pour faire le travail demandé).
  let collabSocieteIds = [];
  if (!isSocieteEmp) {
    const assigned = Array.isArray(e.societes_assignees)
      ? e.societes_assignees
      : [];
    const fromTaches = (
      await query(
        "select distinct societe_id from taches where assigne_id = $1 and societe_id is not null",
        [e.id],
      )
    ).rows.map((r) => r.societe_id);
    collabSocieteIds = [...new Set([...assigned, ...fromTaches])];
  }

  return {
    role: "employe",
    poste,
    lectureSeule: isSocieteEmp,
    employeId: e.id,
    identifiant: e.identifiant,
    nom,
    fonction: isSocieteEmp
      ? e.delegue
        ? "Délégué de société"
        : "Responsable de société"
      : isResponsableEquipe
        ? "Responsable des collaborateurs"
        : e.type,
    initiales: initials(nom),
    cabinetNom: meta?.admin_nom ?? "Cabinet",
    cabinetDerniereConnexion: meta?.last_login
      ? meta.last_login.toISOString?.() ?? String(meta.last_login)
      : null,
    permissions: isSocieteEmp
      ? societeEmployePermissions()
      : isResponsableEquipe
        ? fullPermissions()
        : { ...defaultPermissions(e.type), ...(e.permissions || {}) },
    societeIds: isSocieteEmp
      ? e.societe_id
        ? [e.societe_id]
        : []
      : collabSocieteIds,
    doitChangerMotDePasse: Boolean(e.doit_changer_mdp),
    delegue: isSocieteEmp && Boolean(e.delegue),
  };
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Non authentifié" });
  try {
    // Algorithme imposé : jamais celui que le jeton annonce (attaque « alg: none » ou changement d'algorithme).
    const payload = jwt.verify(token, SECRET, { algorithms: [ALGORITHME] });
    // Un ticket de double authentification n'est pas une session.
    if (payload.typ) return res.status(401).json({ error: "Jeton expiré ou invalide" });
    const compte = payload.role === "admin" ? "admin" : String(payload.employeId);
    // Session révoquée ou expirée (depuis la liste des appareils) : refusée aussitôt. Un jeton sans `sid` (émis avant la liste) reste valable.
    (payload.sid ? sessionValide(payload.sid, compte) : Promise.resolve(true))
      .then((valide) => (valide ? sessionFromToken(payload) : "revoquee"))
      .then(async (session) => {
        if (session === "revoquee") return res.status(401).json({ error: "Cette session a été fermée. Reconnectez-vous." });
        if (!session) return res.status(401).json({ error: "Session invalide" });
        // Mot de passe provisoire : tant qu'il n'est pas changé, seules les routes d'authentification répondent (le changement forcé
        // ne repose pas seulement sur l'écran).
        if (session.doitChangerMotDePasse && req.baseUrl !== "/api/auth")
          return res.status(403).json({ error: "Vous devez d'abord choisir votre mot de passe.", code: "CHANGER_MOT_DE_PASSE" });
        req.session = session;
        req.sid = payload.sid ?? null;
        // Session active : un jeton neuf est proposé une fois le premier à moitié écoulé (le client le garde), au lieu de couper en pleine journée.
        if (payload.iat && Math.floor(Date.now() / 1000) - payload.iat > RENOUVELLEMENT_APRES_S) {
          // Un jeton ancien (sans `sid`) rejoint la liste des appareils à son renouvellement.
          let sid = payload.sid;
          if (sid) await prolongerSession(sid);
          else sid = await ouvrirSession({ compte, adresse: adresseClient(req), navigateur: req.headers["user-agent"] });
          res.setHeader("X-Token-Renouvele", signToken({ ...(payload.role === "admin" ? { role: "admin" } : { role: "employe", employeId: payload.employeId }), v: payload.v ?? 0, sid }));
        }
        next();
      })
      .catch((err) => {
        console.error("[auth] sessionFromToken", err);
        res.status(500).json({ error: "Erreur d'authentification" });
      });
  } catch {
    return res.status(401).json({ error: "Jeton expiré ou invalide" });
  }
}

export function requireAdmin(req, res, next) {
  if (req.session?.role !== "admin")
    return res.status(403).json({ error: "Accès réservé à l'administrateur" });
  next();
}

/** Admin OU responsable des collaborateurs — pour les routes de gestion
 * d'équipe (voir routes/employes.js), jamais pour Journal/Paramètres/État
 * client/Bordereaux, qui restent strictement requireAdmin. */
export function requireEquipeManager(req, res, next) {
  const s = req.session;
  if (s?.role === "admin" || s?.poste === "responsable_collaborateurs")
    return next();
  return res.status(403).json({ error: "Accès réservé" });
}

/** Sociétés visibles, pour filtrer EN SQL : null = toutes (administrateur, responsable des collaborateurs), sinon la liste des
 * identifiants. Même règle que `canSeeSociete`, qui reste appliquée en seconde barrière sur les lignes renvoyées. */
export function porteeSocietes(session) {
  if (session.role === "admin" || session.poste === "responsable_collaborateurs") return null;
  return session.societeIds || [];
}

/** true si la session peut voir/agir sur une société donnée (null = modèle générique). */
export function canSeeSociete(session, societeId) {
  if (session.role === "admin") return true;
  if (session.poste === "responsable_collaborateurs") return true;
  if (societeId == null) return true;
  return (session.societeIds || []).includes(societeId);
}

function initials(name) {
  return String(name || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}
