import { ArrowRight, FolderOpen } from "lucide-react";
import { Link } from "react-router-dom";
import type { DashboardTaskRow } from "@/lib/dashboard/dashboardData";

export function ResumeWork({ task, admin }: { task: DashboardTaskRow | null; admin: boolean }) {
  return (
    <section data-tour="dashboard-resume" className="dashboard-resume">
      <div className="dashboard-dossier-marker" aria-hidden="true"><FolderOpen /></div>
      <div className="dashboard-resume-copy">
        <h2>{admin ? "Reprendre le travail en cours" : "Reprendre mon travail"}</h2>
        {task ? <>
          <p className="dashboard-active-state"><span aria-hidden="true" />En cours</p>
          <p className="dashboard-resume-title">{task.titre}</p>
          <p className="dashboard-resume-metadata">{task.societeName}{admin ? ` · ${task.assigneeName}` : ""}</p>
        </> : <p className="dashboard-resume-empty">Rien à reprendre pour le moment. Retrouvez les tâches à commencer ci-dessous.</p>}
      </div>
      {task && <div className="dashboard-resume-continuation">
        <span className="dashboard-paper-stack" aria-hidden="true">
          <span /><span /><span /><span />
        </span>
        <p>Poursuivre cette tâche depuis votre espace de travail.</p>
        <Link to="/taches" className="dashboard-resume-action dashboard-navigation">Reprendre<ArrowRight className="size-4" aria-hidden="true" /></Link>
      </div>}
    </section>
  );
}
