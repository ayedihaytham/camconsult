import { TACHE_MODULE_LABELS } from "@/types";
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

const JOUR_MS = 86_400_000;
const jourUtc = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};
const jourCourt = (date: Date) => date.toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });

/** « 10 – 20 oct. » ou « 28 sept. – 4 oct. ». */
function formatPlage(debut: number, fin: number) {
  const d = new Date(debut);
  const f = new Date(fin);
  if (d.getUTCMonth() === f.getUTCMonth() && d.getUTCFullYear() === f.getUTCFullYear()) {
    return `${d.getUTCDate()} – ${jourCourt(f)}`;
  }
  return `${jourCourt(d)} – ${jourCourt(f)}`;
}

export interface TaskPlanning {
  plage: string;
  /** Part de la période écoulée, 0 à 100. */
  progress: number;
  label: string;
  tone: "muted" | "warn" | "bad" | "ok";
}

/** Planning lisible d'une carte : où on en est entre le début et la fin prévus. `null` quand la tâche n'est pas planifiée. */
export function getTaskPlanning(task: Tache, today = new Date()): TaskPlanning | null {
  if (!task.debutPrevu || !task.finPrevue) return null;
  const debut = jourUtc(task.debutPrevu);
  const fin = jourUtc(task.finPrevue);
  const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const plage = formatPlage(debut, fin);
  if (task.statut === "termine") {
    return {
      plage,
      progress: 100,
      label: task.termineLe ? `Terminée le ${jourCourt(new Date(jourUtc(task.termineLe)))}` : "Terminée",
      tone: "ok",
    };
  }
  if (now < debut) return { plage, progress: 0, label: `Débute dans ${Math.round((debut - now) / JOUR_MS)} j`, tone: "muted" };
  if (now > fin) return { plage, progress: 100, label: `Fin dépassée de ${Math.round((now - fin) / JOUR_MS)} j`, tone: "bad" };
  const restant = Math.round((fin - now) / JOUR_MS);
  const progress = Math.min(100, Math.max(0, Math.round(((now - debut) / Math.max(fin - debut, JOUR_MS)) * 100)));
  return { plage, progress, label: restant === 0 ? "Fin aujourd'hui" : `Fin dans ${restant} j`, tone: restant <= 3 ? "warn" : "muted" };
}

/** Initiales d'une société pour son carré : « 05-I CARGO LINE » → « IC ». */
export function societeInitiales(nom: string) {
  const lettres = nom
    .split(/\s+/)
    .map((mot) => mot.match(/\p{L}/u)?.[0])
    .filter((l): l is string => Boolean(l));
  return (lettres.slice(0, 2).join("") || "?").toUpperCase();
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
      societeName:
        (societesById.get(task.societeId) ?? "Société supprimée") +
        (task.module ? ` · ${TACHE_MODULE_LABELS[task.module]}` : ""),
      assigneeName,
      assigneeInitials,
      assigneeOnline:
        task.assigneId && assignee
          ? (collaboratorPresence.get(task.assigneId) ?? false)
          : null,
    };
  });
}
