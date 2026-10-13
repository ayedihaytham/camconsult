import { Navigate } from "react-router-dom";
import { usePermissions } from "@/hooks/usePermissions";
import { useSocieteActive } from "@/hooks/useSocieteActive";
import { EtatSwiftRegistre } from "./EtatSwiftRegistre";

/** Cabinet : registre des sociétés. Responsable ou délégué de société : directement sur sa société. */
export function EtatSwiftListPage() {
  const { isResponsableSociete, societeIds } = usePermissions();
  const societeActive = useSocieteActive();
  if (isResponsableSociete && societeIds?.[0]) return <Navigate to={`/etat-swift/${societeIds[0]}`} replace />;
  // Une société choisie dans la barre du haut s'ouvre directement, comme dans les autres modules par société.
  if (societeActive) return <Navigate to={`/etat-swift/${societeActive.id}`} replace />;
  return <EtatSwiftRegistre />;
}
