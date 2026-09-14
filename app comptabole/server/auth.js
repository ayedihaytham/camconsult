import "dotenv/config";
import jwt from "jsonwebtoken";
import { query } from "./db.js";
import {
  defaultPermissions,
  societeEmployePermissions,
} from "./permissions.js";

const SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

export function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: "12h" });
}

/** Reconstruit la session (droits à jour) à partir du payload du jeton. */
export async function sessionFromToken(payload) {
  if (payload.role === "admin") {
    const { rows } = await query(
      "select admin_nom, admin_role, last_login from app_meta where id = 1",
    );
    const meta = rows[0] ?? {};
    return {
      role: "admin",
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
    };
  }

  const { rows } = await query(
    "select * from employes where id = $1",
    [payload.employeId],
  );
  const e = rows[0];
  if (!e || e.statut !== "actif") return null;
  const meta = (
    await query("select admin_nom, last_login from app_meta where id = 1")
  ).rows[0];
  const nom = `${e.prenom} ${e.nom}`;
  const poste = e.role === "societe_employe" ? "societe_employe" : "collaborateur";
  const isSocieteEmp = poste === "societe_employe";

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
    nom,
    fonction: isSocieteEmp ? "Employé de société" : e.type,
    initiales: initials(nom),
    cabinetNom: meta?.admin_nom ?? "Cabinet",
    cabinetDerniereConnexion: meta?.last_login
      ? meta.last_login.toISOString?.() ?? String(meta.last_login)
      : null,
    permissions: isSocieteEmp
      ? societeEmployePermissions()
      : { ...defaultPermissions(e.type), ...(e.permissions || {}) },
    societeIds: isSocieteEmp
      ? e.societe_id
        ? [e.societe_id]
        : []
      : collabSocieteIds,
  };
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Non authentifié" });
  try {
    const payload = jwt.verify(token, SECRET);
    sessionFromToken(payload)
      .then((session) => {
        if (!session) return res.status(401).json({ error: "Session invalide" });
        req.session = session;
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

/** true si la session peut voir/agir sur une société donnée (null = modèle générique). */
export function canSeeSociete(session, societeId) {
  if (session.role === "admin") return true;
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
