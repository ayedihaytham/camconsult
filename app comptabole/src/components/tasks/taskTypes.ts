import type { Employe, Tache, TacheStatut } from "@/types";
import { formatRelative } from "@/lib/utils";

export interface PresentedTask {
  task: Tache;
  columnId: TacheStatut;
  societeName: string;
  assigneeName: string;
  assigneeInitials: string;
  assigneeOnline: boolean | null;
}

export interface TaskPresentationActions {
  canManage: boolean;
  canChangeStatus: (task: Tache, status: TacheStatut) => boolean;
  onStatusChange: (task: Tache, status: TacheStatut) => Promise<void>;
  onEdit: (task: Tache) => void;
  onDelete: (task: Tache) => void;
  pendingTaskIds: Set<string>;
}

export function summarizeTasks(tasks: Tache[]) {
  const counts = { open: 0, todo: 0, doing: 0, done: 0 };
  for (const task of tasks) {
    if (task.statut === "a_faire") {
      counts.todo += 1;
      counts.open += 1;
    } else if (task.statut === "en_cours") {
      counts.doing += 1;
      counts.open += 1;
    } else {
      counts.done += 1;
    }
  }
  return counts;
}

export function getNextTaskStatus(
  task: Tache,
  canChangeStatus: (task: Tache, status: TacheStatut) => boolean,
): TacheStatut | null {
  const next = task.statut === "a_faire" ? "en_cours" : task.statut === "en_cours" ? "termine" : null;
  return next && canChangeStatus(task, next) ? next : null;
}

export function getTaskActivityDate(task: Tache) {
  return task.statut === "termine" && task.termineLe ? task.termineLe : task.majLe;
}

export function getTaskActivity(task: Tache) {
  const completed = task.statut === "termine" && Boolean(task.termineLe);
  const date = getTaskActivityDate(task);
  return {
    date,
    label: `${completed ? "Terminée" : "Mise à jour"} ${formatRelative(date)}`,
  };
}

export function presentTasks({
  tasks,
  societesById,
  collaborateurs,
  collaboratorPresence,
  statusOverrides,
}: {
  tasks: Tache[];
  societesById: ReadonlyMap<string, string>;
  collaborateurs: Employe[];
  collaboratorPresence: ReadonlyMap<string, boolean>;
  statusOverrides: Readonly<Record<string, TacheStatut>>;
}): PresentedTask[] {
  const collaborateursById = new Map(
    collaborateurs.map((collaborateur) => [collaborateur.id, collaborateur]),
  );

  return tasks.map((task) => {
    const assignee = task.assigneId
      ? collaborateursById.get(task.assigneId)
      : null;
    const assigneeName = task.assigneId
      ? assignee
        ? `${assignee.prenom} ${assignee.nom}`
        : "Collaborateur retiré"
      : "Non assignée";
    const assigneeInitials = task.assigneId
      ? assigneeName
          .split(" ")
          .map((part) => part[0])
          .join("")
          .slice(0, 2)
          .toUpperCase()
      : "—";

    return {
      task,
      columnId: statusOverrides[task.id] ?? task.statut,
      societeName: societesById.get(task.societeId) ?? "Société supprimée",
      assigneeName,
      assigneeInitials,
      assigneeOnline:
        task.assigneId && assignee
          ? (collaboratorPresence.get(task.assigneId) ?? false)
          : null,
    };
  });
}
