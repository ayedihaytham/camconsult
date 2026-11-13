import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/store/auth";

/** Pages réservées au compte d'une société cliente (responsable ou délégué), comme « Ma souche » : l'équipe du cabinet n'y a rien à saisir. */
export function RequireSocieteEmploye() {
  const session = useAuth((s) => s.session);
  if (!session) return <Navigate to="/login" replace />;
  if (session.poste !== "societe_employe") return <Navigate to="/" replace />;
  return <Outlet />;
}
