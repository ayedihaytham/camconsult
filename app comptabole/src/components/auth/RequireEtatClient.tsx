import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/store/auth";

/** État client : admin, ou responsable de société (lecture seule sur SA
 * société — le serveur refuse le reste, voir server/routes/honoraires.js).
 * Un délégué n'y a pas accès. */
export function RequireEtatClient() {
  const session = useAuth((s) => s.session);
  if (!session) return <Navigate to="/login" replace />;
  const ok =
    session.role === "admin" ||
    (session.poste === "societe_employe" && !session.delegue);
  if (!ok) return <Navigate to="/" replace />;
  return <Outlet />;
}
