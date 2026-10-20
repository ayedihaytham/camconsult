import { usePermissions } from "@/hooks/usePermissions";
import { useSocieteActive } from "@/hooks/useSocieteActive";
import { ciblerNavigation } from "@/lib/societeContext";
import { visibleNavigation, type NavGroup } from "./navigation";

/** Menu visible pour le compte connecté (droits, compte de société) et ciblé sur la société active : le menu latéral et « Aller à… » partagent cette liste. */
export function useNavigationGroups(): NavGroup[] {
  const { isAdmin, can, lectureSeule, canManageCollaborateurs, isResponsableSociete, poste } = usePermissions();
  const societeActive = useSocieteActive();
  return ciblerNavigation(
    visibleNavigation({
      isAdmin,
      lectureSeule,
      can,
      canManageCollaborateurs,
      isResponsableSociete,
      espaceCollecteSeul: poste === "societe_employe",
    }),
    societeActive?.id ?? null,
  );
}
