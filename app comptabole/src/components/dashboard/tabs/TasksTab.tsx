import { useState } from "react";
import { ArrowRight, Building2, FolderOpen, UserRound } from "lucide-react";
import { Link } from "react-router-dom";
import { TaskRegister } from "../TaskRegister";
import type { DashboardViewModel } from "@/lib/dashboard/dashboardData";
import "../tasks-workspace.css";

export function TasksTab({ data }: { data: DashboardViewModel }) {
  const [completed, setCompleted] = useState(false);
  const accessible = [...data.taskRows, ...data.otherTaskRows];
  const openCount = accessible.filter(
    (task) => task.statut !== "termine",
  ).length;
  const ongoingCount = accessible.filter(
    (task) => task.statut === "en_cours",
  ).length;
  const todoCount = accessible.filter(
    (task) => task.statut === "a_faire",
  ).length;
  const doneCount = accessible.length - openCount;
  const rows = data.taskRows.filter((task) =>
    completed ? task.statut === "termine" : task.statut !== "termine",
  );
  const others = data.otherTaskRows.filter((task) =>
    completed ? task.statut === "termine" : task.statut !== "termine",
  );
  const ongoing = rows.filter((task) => task.statut === "en_cours");
  const todo = rows.filter((task) => task.statut === "a_faire");
  const active = !completed ? ongoing[0] : undefined;

  return (
    <section className="dashboard-tasks-workspace" data-tour="dashboard-tasks">
      <div className="tasks-lens-row">
        <div
          data-tour="dashboard-task-lens"
          role="group"
          aria-label="État des tâches accessibles"
          className="tasks-lens"
        >
          <button
            type="button"
            aria-pressed={!completed}
            onClick={() => setCompleted(false)}
          >
            Ouvertes <span>{openCount}</span>
          </button>
          <button
            type="button"
            aria-pressed={completed}
            onClick={() => setCompleted(true)}
          >
            Terminées <span>{doneCount}</span>
          </button>
        </div>
        <p className="tasks-summary">
          <span>
            {openCount} tâche{openCount > 1 ? "s" : ""} ouverte
            {openCount > 1 ? "s" : ""}
          </span>
          <span className="task-state task-state--en_cours">
            {ongoingCount} en cours
          </span>
          <span className="task-state task-state--a_faire">
            {todoCount} à faire
          </span>
        </p>
      </div>
      {active && (
        <section
          className="tasks-active-dossier"
          data-tour="dashboard-task-resume"
          aria-label="Tâche en cours à reprendre"
        >
          <span className="tasks-folder" aria-hidden="true">
            <FolderOpen />
          </span>
          <div className="tasks-active-copy">
            <p className="tasks-active-marker">
              <span aria-hidden="true" />
              Tâche en cours · À reprendre
            </p>
            <h3>{active.titre}</h3>
            <p className="tasks-active-metadata">
              <span>
                <Building2 size={16} aria-hidden="true" />
                {active.societeName}
              </span>
              <span>
                <UserRound size={16} aria-hidden="true" />
                {active.assigneeName}
              </span>
            </p>
          </div>
          <div className="tasks-active-action">
            <span className="tasks-dossier-paper" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
            </span>
            <p>Poursuivre cette tâche depuis votre espace de travail.</p>
            <Link to="/taches">
              Reprendre <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </section>
      )}
      {completed ? (
        <TaskRegister
          title="Tâches terminées"
          description="Travail terminé dans ce périmètre."
          tasks={rows}
          state="termine"
          target="dashboard-task-completed"
          empty="Aucune tâche terminée dans ce périmètre."
        />
      ) : (
        <>
          <TaskRegister
            title="En cours"
            description="Tâches déjà commencées, sans date limite."
            tasks={ongoing}
            state="en_cours"
            target="dashboard-task-ongoing"
          />
          <TaskRegister
            title="À faire"
            description="À faire quand vous êtes disponible."
            tasks={todo}
            state="a_faire"
            target="dashboard-task-todo"
          />
        </>
      )}
      {others.length > 0 && (
        <TaskRegister
          title="Autres tâches accessibles"
          description="Travail visible dans votre périmètre, distinct de vos tâches attribuées."
          tasks={others}
          state={completed ? "termine" : "en_cours"}
          target="dashboard-task-other"
        />
      )}
    </section>
  );
}
