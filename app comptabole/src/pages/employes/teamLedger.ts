import { PERMISSION_LABELS } from "@/store/data";
import type { Employe, PermissionKey, Societe, Tache } from "@/types";

export function openTasksByCollaborator(tasks: Tache[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const task of tasks) {
    if (!task.assigneId || task.statut === "termine") continue;
    counts.set(task.assigneId, (counts.get(task.assigneId) ?? 0) + 1);
  }
  return counts;
}

export function allowedPermissionCount(employe: Employe): number {
  return (Object.keys(PERMISSION_LABELS) as PermissionKey[]).filter(
    (key) => Boolean(employe.permissions?.[key]),
  ).length;
}

export function assignmentPreview(
  employe: Employe,
  societyNames: Map<string, string>,
): string {
  const names = employe.societesAssignees.map(
    (id) => societyNames.get(id) ?? id,
  );
  if (names.length === 0) return "Aucune société assignée";
  const preview = names.slice(0, 2).join(" · ");
  return names.length > 2 ? `${preview} +${names.length - 2}` : preview;
}

export function societyNameMap(societes: Societe[]): Map<string, string> {
  return new Map(societes.map((s) => [s.id, s.raisonSociale]));
}
