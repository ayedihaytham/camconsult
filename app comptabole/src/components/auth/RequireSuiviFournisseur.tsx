import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/store/auth";

/** Suivi fournisseur et suivi bancaire : l'équipe du cabinet (écriture) et le responsable d'une société cliente (lecture
 * seule sur SA société — le serveur refuse le reste, voir server/routes/fournisseurs.js et banque.js). Pas les délégués. */
export function RequireSuiviFournisseur() {
  const session = useAuth((s) => s.session);
  if (!session) return <Navigate to="/login" replace />;
  if (session.poste === "societe_employe" && session.delegue) return <Navigate to="/" replace />;
  return <Outlet />;
}
