import type { Employe, Tache, TacheStatut } from "@/types";

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

