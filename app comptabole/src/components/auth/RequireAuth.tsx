import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/store/auth";
import { ChangePasswordRequiredPage } from "@/pages/ChangePasswordRequiredPage";

export function RequireAuth() {
  const status = useAuth((s) => s.status);
  const session = useAuth((s) => s.session);
  const location = useLocation();

  if (status !== "authed") {
    return (
      <Navigate to="/login" replace state={{ from: location.pathname }} />
    );
  }
  // Bloque tout le reste (avant même l'hydratation des données de
  // l'app — inutile de tout charger pour un écran qu'on va remplacer) tant
  // que l'employé n'a pas choisi son propre mot de passe : 1ère connexion,
  // ou réinitialisation par l'admin/le responsable des collaborateurs.
  if (session?.doitChangerMotDePasse) return <ChangePasswordRequiredPage />;
  return <Outlet />;
}
