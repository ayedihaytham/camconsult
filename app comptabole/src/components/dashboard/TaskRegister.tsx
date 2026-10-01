import { ArrowRight, CheckCheck, FileText, Timer } from "lucide-react";
import { Link } from "react-router-dom";
import type { DashboardTaskRow } from "@/lib/dashboard/dashboardData";
import { initials } from "@/lib/utils";
import { TACHE_STATUT_LABELS, type TacheStatut } from "@/types";

export function TaskRegister({ title, description, tasks, state, target, empty = "Aucune tâche dans cette section." }: {
  title: string; description: string; tasks: DashboardTaskRow[]; state: TacheStatut; target: string; empty?: string;
}) {
  const Icon = state === "en_cours" ? Timer : state === "termine" ? CheckCheck : FileText;
  return <section className={`tasks-register tasks-register--${state}`} data-tour={target}>
    <header><span className="tasks-register-icon" aria-hidden="true"><Icon /></span><div><h3>{title}</h3><p>{description}</p></div><span className="tasks-register-count">{tasks.length} tâche{tasks.length > 1 ? "s" : ""}</span><Link to="/taches" className="tasks-see-all">Tout voir <ArrowRight size={16} aria-hidden="true" /></Link></header>
    <div className="tasks-register-columns" aria-hidden="true"><span>Tâche</span><span>Société</span><span>Collaborateur</span><span>Statut</span><span className="sr-only">Action</span></div>
    {tasks.length ? <ul>{tasks.map((task, index) => <li key={task.id}><Link to="/taches" className="tasks-register-row" data-tour={index === 0 && target === "dashboard-task-ongoing" ? "dashboard-task-open" : undefined}>
      <span className="tasks-register-title"><FileText className={`task-row-icon task-row-icon--${task.statut}`} size={18} aria-hidden="true" /><span>{task.titre}{task.origine === "societe" && <small>Tâche de société (lecture seule au cabinet)</small>}</span></span>
      <span className="tasks-register-company">{task.societeName}</span>
      <span className="tasks-register-person"><span className="tasks-avatar" aria-hidden="true">{task.assigneId ? initials(task.assigneeName) : "—"}</span>{task.assigneeName}</span>
      <span className={`task-state task-state--${task.statut}`}>{TACHE_STATUT_LABELS[task.statut]}</span><ArrowRight className="tasks-row-arrow" size={18} aria-hidden="true" />
    </Link></li>)}</ul> : <p className="tasks-register-empty">{empty}</p>}
  </section>;
}
