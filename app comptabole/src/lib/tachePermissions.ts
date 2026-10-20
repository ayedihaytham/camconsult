import type { Tache, TacheStatut } from "@/types";

/** Ordre du circuit d'une tâche : on avance de gauche à droite. */
export const TACHE_STATUT_ORDRE: TacheStatut[] = ["a_faire", "en_cours", "termine"];

export interface DroitsTache {
  isResponsableSociete: boolean;
  isDelegue: boolean;
  canManageCollaborateurs: boolean;
  employeId: string | null;
}

/**
 * Qui peut faire passer une tâche à ce statut (même règle que le serveur, `PATCH /api/taches/:id`) : chaque circuit est piloté par son côté
 * (le cabinet suit les tâches internes d'une société sans pouvoir les modifier) ; l'assigné ne peut qu'avancer, jamais reculer.
 */
export function peutChangerStatut(task: Pick<Tache, "statut" | "origine" | "assigneId">, statut: TacheStatut, droits: DroitsTache): boolean {
  if (statut === task.statut) return true;
  const tacheSociete = task.origine === "societe";
  if (tacheSociete ? droits.isResponsableSociete : droits.canManageCollaborateurs) return true;
  if (tacheSociete && !droits.isResponsableSociete && !droits.isDelegue) return false;
  return task.assigneId === droits.employeId && TACHE_STATUT_ORDRE.indexOf(statut) > TACHE_STATUT_ORDRE.indexOf(task.statut);
}

/** Action proposée sur une carte : l'étape suivante, ou « Rouvrir » pour une tâche terminée. */
export function actionTache(statut: TacheStatut): { vers: TacheStatut; libelle: string; message: string } {
  if (statut === "a_faire") return { vers: "en_cours", libelle: "Commencer", message: "Tâche en cours" };
  if (statut === "en_cours") return { vers: "termine", libelle: "Terminer", message: "Tâche terminée" };
  return { vers: "en_cours", libelle: "Rouvrir", message: "Tâche rouverte" };
}
