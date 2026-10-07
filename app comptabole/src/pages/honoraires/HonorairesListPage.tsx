import { Navigate } from "react-router-dom";
import { usePermissions } from "@/hooks/usePermissions";
import { HonorairesRecapPage } from "./HonorairesRecapPage";

/** Admin : récapitulatif des soldes de tous les clients ; le responsable de société est redirigé vers
 * la page de SA société (voir RequireEtatClient sur la route) — les
 * honoraires et soldes restent une information sensible au cabinet. */
export function HonorairesListPage() {
  const { isResponsableSociete, societeIds } = usePermissions();

  // Le responsable de société n'a qu'une société : directement sur sa page.
  if (isResponsableSociete && societeIds?.[0]) {
    return <Navigate to={`/honoraires/${societeIds[0]}`} replace />;
  }

  return <HonorairesRecapPage />;
}
