import { useAuth } from "@/store/auth";
import { defaultPermissions } from "@/store/data";
import type { EmployeRole, PermissionKey } from "@/types";

export interface PermissionContext {
  isAdmin: boolean;
  can: (key: PermissionKey) => boolean;
  /** null = accès à toutes les sociétés (admin) ; sinon liste d'ids autorisés. */
  societeIds: string[] | null;
  canSeeSociete: (id: string | null) => boolean;
  employeId: string | null;
  /** type de compte employé : "collaborateur" | "societe_employe" | null (admin) */
  poste: EmployeRole | null;
  /** true pour un employé de société cliente : consultation seule des dossiers */
  lectureSeule: boolean;
  /** raccourci : équipe interne (admin ou collaborateur) */
  isCollaborateur: boolean;
}

export function usePermissions(): PermissionContext {
  const session = useAuth((s) => s.session);

  if (!session || session.role === "admin") {
    return {
      isAdmin: true,
      can: () => true,
      societeIds: null,
      canSeeSociete: () => true,
      employeId: null,
      poste: null,
      lectureSeule: false,
      isCollaborateur: true,
    };
  }

  const perms = session.permissions ?? defaultPermissions("Stagiaire");
  const societeIds = session.societeIds ?? [];
  const poste: EmployeRole = session.poste ?? "collaborateur";

  return {
    isAdmin: false,
    can: (key) => Boolean(perms[key]),
    societeIds,
    canSeeSociete: (id) => id === null || societeIds.includes(id),
    employeId: session.employeId,
    poste,
    lectureSeule: Boolean(session.lectureSeule) || poste === "societe_employe",
    isCollaborateur: poste === "collaborateur",
  };
}
