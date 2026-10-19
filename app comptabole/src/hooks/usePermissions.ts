import { useAuth } from "@/store/auth";
import { defaultPermissions } from "@/store/data";
import type { EmployeRole, PermissionKey } from "@/types";

export interface PermissionContext {
  isAdmin: boolean;
  can: (key: PermissionKey) => boolean;
  /** null = accès à toutes les sociétés (admin, ou responsable des
   * collaborateurs) ; sinon liste d'ids autorisés. */
  societeIds: string[] | null;
  canSeeSociete: (id: string | null) => boolean;
  employeId: string | null;
  /** type de compte employé : "collaborateur" | "societe_employe" |
   * "responsable_collaborateurs" | null (admin) */
  poste: EmployeRole | null;
  /** true pour un employé de société cliente : consultation seule des dossiers */
  lectureSeule: boolean;
  /** raccourci : équipe interne (admin, collaborateur ou responsable des
   * collaborateurs) */
  isCollaborateur: boolean;
  /** admin OU responsable des collaborateurs — gère les comptes
   * collaborateurs (pas la suppression, réservée à l'admin). */
  canManageCollaborateurs: boolean;
  /** Employé de société : responsable (donne des tâches à ses délégués) ou
   * délégué (reçoit ces tâches). Tous deux faux côté cabinet. */
  isResponsableSociete: boolean;
  isDelegue: boolean;
}

export function usePermissions(): PermissionContext {
  const session = useAuth((s) => s.session);

  // Sans session (écran de connexion, chargement) : aucun droit. Jamais le contexte administrateur par défaut.
  if (!session) {
    return {
      isAdmin: false,
      can: () => false,
      societeIds: [],
      canSeeSociete: (id) => id === null,
      employeId: null,
      poste: null,
      lectureSeule: true,
      isCollaborateur: false,
      canManageCollaborateurs: false,
      isResponsableSociete: false,
      isDelegue: false,
    };
  }

  if (session.role === "admin") {
    return {
      isAdmin: true,
      can: () => true,
      societeIds: null,
      canSeeSociete: () => true,
      employeId: null,
      poste: null,
      lectureSeule: false,
      isCollaborateur: true,
      canManageCollaborateurs: true,
      isResponsableSociete: false,
      isDelegue: false,
    };
  }

  const perms = session.permissions ?? defaultPermissions("Stagiaire");
  const poste: EmployeRole = session.poste ?? "collaborateur";
  // Voit toutes les sociétés, comme l'admin — supervise l'équipe à travers
  // tout le cabinet, pas juste son propre périmètre assigné.
  const seesAllSocietes = poste === "responsable_collaborateurs";
  const societeIds = seesAllSocietes ? null : (session.societeIds ?? []);

  return {
    isAdmin: false,
    can: (key) => Boolean(perms[key]),
    societeIds,
    canSeeSociete: (id) =>
      id === null || seesAllSocietes || (societeIds ?? []).includes(id),
    employeId: session.employeId,
    poste,
    lectureSeule: Boolean(session.lectureSeule) || poste === "societe_employe",
    isCollaborateur: poste === "collaborateur" || seesAllSocietes,
    canManageCollaborateurs: seesAllSocietes,
    // Le délégué a les mêmes accès et les mêmes vues que le responsable de société.
    isResponsableSociete: poste === "societe_employe",
    isDelegue: poste === "societe_employe" && Boolean(session.delegue),
  };
}
