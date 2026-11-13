import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useCheminActif } from "@/store/config";

/** Page d'un module fermé dans cet environnement (production) : retour à l'accueil. */
export function RequireModule() {
  const { pathname } = useLocation();
  const ouvert = useCheminActif(pathname);
  return ouvert ? <Outlet /> : <Navigate to="/" replace />;
}
