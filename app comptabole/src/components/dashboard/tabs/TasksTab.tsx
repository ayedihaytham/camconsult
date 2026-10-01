import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TaskRows } from "../TaskRows";
import { WorkspaceSection } from "../WorkspaceSection";
import type { DashboardViewModel } from "@/lib/dashboard/dashboardData";

export function TasksTab({ data }: { data: DashboardViewModel }) {
  const [completed, setCompleted] = useState(false);
  const rows = data.taskRows.filter((task) => completed ? task.statut === "termine" : task.statut !== "termine");
  const others = data.otherTaskRows.filter((task) => completed ? task.statut === "termine" : task.statut !== "termine");
  const accessible = [...data.taskRows, ...data.otherTaskRows];
  const openCount = accessible.filter((task) => task.statut !== "termine").length;
  const doneCount = accessible.length - openCount;
  return <WorkspaceSection title="Tâches" description="Travail accessible dans ce périmètre. Les tâches n’ont pas de date limite." target="dashboard-tasks">
    <div role="group" aria-label="État des tâches accessibles" className="inline-flex flex-wrap gap-1 rounded border border-border bg-background p-1"><Button variant="ghost" className="dashboard-choice min-h-11 gap-2" aria-pressed={!completed} onClick={() => setCompleted(false)}>Ouvertes <span className="tabular-nums opacity-80">{openCount}</span></Button><Button variant="ghost" className="dashboard-choice min-h-11 gap-2" aria-pressed={completed} onClick={() => setCompleted(true)}>Terminées <span className="tabular-nums opacity-80">{doneCount}</span></Button></div>
    {completed ? <WorkspaceSection subsection title="Tâches terminées" route="/taches"><TaskRows tasks={rows} admin={data.role === "admin"} empty="Aucune tâche terminée dans ce périmètre." /></WorkspaceSection> : <>
      <WorkspaceSection subsection title="En cours" route="/taches"><TaskRows tasks={rows.filter((task) => task.statut === "en_cours")} admin={data.role === "admin"} /></WorkspaceSection>
      <WorkspaceSection subsection title="À faire"><TaskRows tasks={rows.filter((task) => task.statut === "a_faire")} admin={data.role === "admin"} /></WorkspaceSection>
    </>}
    {others.length > 0 && <WorkspaceSection subsection title="Autres tâches accessibles" description="Travail visible dans votre périmètre, distinct de vos tâches attribuées." route="/taches"><TaskRows tasks={others} admin /></WorkspaceSection>}
  </WorkspaceSection>;
}
