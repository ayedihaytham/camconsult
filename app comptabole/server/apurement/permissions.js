import { canSeeSociete } from "../auth.js";
import { fail } from "./domain.js";
export const isCabinet = (s) =>
  Boolean(
    s &&
      (s.role === "admin" ||
        ["collaborateur", "responsable_collaborateurs"].includes(s.poste)),
  );
export const isManager = (s) =>
  Boolean(
    s && (s.role === "admin" || s.poste === "responsable_collaborateurs"),
  );
export function requireCabinet(req, res, next) {
  if (!isCabinet(req.session))
    return res
      .status(403)
      .json({ error: "Accès réservé au cabinet.", code: "CABINET_REQUIS" });
  next();
}
export function scope(session, societeId) {
  if (!isCabinet(session) || !societeId || !canSeeSociete(session, societeId))
    fail(403, "SOCIETE_INTERDITE", "Société hors de votre périmètre.");
}
export function manager(session) {
  if (!isManager(session))
    fail(
      403,
      "VALIDATEUR_REQUIS",
      "Validation réservée à l’administrateur ou au responsable des collaborateurs.",
    );
}
