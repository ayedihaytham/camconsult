import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TACHE_STATUT_LABELS } from "@/types";
import type { DashboardTaskRow } from "@/lib/dashboard/dashboardData";

export function TaskRows({ tasks, admin, empty = "Aucune tâche dans cette section." }: { tasks: DashboardTaskRow[]; admin: boolean; empty?: string }) {
  if (!tasks.length) return <p className="py-4 text-sm text-muted-foreground">{empty}</p>;
  return <ul>{tasks.map((task) => <li key={task.id} className="border-b border-border py-2.5">
    <Link to="/taches" className="dashboard-row group flex min-h-11 items-center justify-between gap-3 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">
      <div className="dashboard-task-copy min-w-0"><p className="break-words text-sm font-medium text-primary group-hover:underline">{task.titre}</p><p className="mt-1 break-words text-xs text-muted-foreground">{task.societeName}{admin ? ` · ${task.assigneeName}` : ""}{task.origine === "societe" ? " · Tâche de société (lecture seule au cabinet)" : ""}</p></div>
      <span className="dashboard-task-actions flex shrink-0 items-center gap-2"><Badge variant={task.statut === "termine" ? "success" : task.statut === "en_cours" ? "default" : "muted"} className={`dashboard-badge ${task.statut === "termine" ? "dashboard-badge--success" : task.statut === "en_cours" ? "dashboard-badge--progress" : "dashboard-badge--neutral"}`}>{TACHE_STATUT_LABELS[task.statut]}</Badge><ArrowRight className="size-4" aria-hidden="true" /></span>
    </Link>
  </li>)}</ul>;
}
