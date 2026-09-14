import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/store/auth";

/** Route réservée à l'administrateur (responsable du cabinet). */
export function RequireAdmin() {
  const session = useAuth((s) => s.session);
  if (!session) return <Navigate to="/login" replace />;
  if (session.role !== "admin") return <Navigate to="/" replace />;
  return <Outlet />;
}
