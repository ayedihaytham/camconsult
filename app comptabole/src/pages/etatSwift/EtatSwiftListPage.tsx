import { Navigate } from "react-router-dom";
import { Globe } from "lucide-react";
import { SocieteChoixPage } from "@/components/common/SocieteChoixPage";
import { usePermissions } from "@/hooks/usePermissions";

/** Cabinet : choix de la société. Responsable ou délégué de société : directement sur sa société. */
export function EtatSwiftListPage() {
  const { isResponsableSociete, societeIds } = usePermissions();
  if (isResponsableSociete && societeIds?.[0]) return <Navigate to={`/etat-swift/${societeIds[0]}`} replace />;
  return (
    <SocieteChoixPage
      icon={Globe}
      eyebrow="Comptabilité · Devises"
      title="État SWIFT"
      description="Choisissez une société pour suivre ses virements SWIFT en dinars et les factures d'achat qui les justifient."
      basePath="/etat-swift"
      tourId="etat-swift-societes"
    />
  );
}
