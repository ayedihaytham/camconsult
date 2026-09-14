import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/store/auth";

/** Route réservée à l'équipe interne du cabinet (admin ou collaborateur). */
export function RequireEquipe() {
  const session = useAuth((s) => s.session);
  if (!session) return <Navigate to="/login" replace />;
  if (session.role === "employe" && session.poste === "societe_employe")
    return <Navigate to="/" replace />;
  return <Outlet />;
}
