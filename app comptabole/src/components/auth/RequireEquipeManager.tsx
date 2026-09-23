import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/store/auth";

/** Route réservée à l'admin OU au responsable des collaborateurs — jamais
 * pour Journal/Paramètres/État client/Bordereaux (voir RequireAdmin). */
export function RequireEquipeManager() {
  const session = useAuth((s) => s.session);
  if (!session) return <Navigate to="/login" replace />;
  if (session.role !== "admin" && session.poste !== "responsable_collaborateurs")
    return <Navigate to="/" replace />;
  return <Outlet />;
}
