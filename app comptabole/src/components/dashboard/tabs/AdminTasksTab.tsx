import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TaskRegister } from "../TaskRegister";
import type { DashboardViewModel } from "@/lib/dashboard/dashboardData";

type Lens = "open" | "active" | "todo" | "done";

export function AdminTasksTab({ data }: { data: DashboardViewModel }) {
  const [lens, setLens] = useState<Lens>("open");
  const [search, setSearch] = useState("");
  const all = [...data.taskRows, ...data.otherTaskRows];
  const query = search.trim().toLocaleLowerCase("fr");
  const matching = (task: typeof all[number]) => (!query || `${task.titre} ${task.societeName} ${task.assigneeName}`.toLocaleLowerCase("fr").includes(query)) && (lens === "open" ? task.statut !== "termine" : task.statut === (lens === "active" ? "en_cours" : lens === "todo" ? "a_faire" : "termine"));
  const rows = data.taskRows.filter(matching);
  const others = data.otherTaskRows.filter(matching);
  const filters: { id: Lens; label: string; count: number }[] = [
    { id: "open", label: "Ouvertes", count: all.filter((task) => task.statut !== "termine").length },
    { id: "active", label: "En cours", count: all.filter((task) => task.statut === "en_cours").length },
    { id: "todo", label: "À faire", count: all.filter((task) => task.statut === "a_faire").length },
    { id: "done", label: "Terminées", count: all.filter((task) => task.statut === "termine").length },
  ];

  return (
    <section className="dashboard-tasks-workspace admin-task-view" data-tour="dashboard-tasks">
      <header className="admin-view-header"><div><h2>Tâches du cabinet</h2><p>Retrouvez le travail par état, société ou collaborateur.</p></div><Link to="/taches" className="admin-view-link">Ouvrir les tâches<ArrowUpRight className="size-4" aria-hidden="true" /></Link></header>
      <div className="admin-tab-toolbar">
        <Input type="search" aria-label="Rechercher une tâche" placeholder="Tâche, société ou collaborateur…" value={search} onChange={(event) => setSearch(event.target.value)} className="h-11 min-w-0 sm:max-w-sm sm:flex-1" />
        <div className="admin-lenses" role="group" aria-label="État des tâches accessibles" data-tour="dashboard-task-lens">
          {filters.map((filter) => <Button key={filter.id} type="button" variant={lens === filter.id ? "secondary" : "ghost"} aria-pressed={lens === filter.id} className="h-11 px-3 text-xs" onClick={() => setLens(filter.id)}>{filter.label}<span className="tabular-nums">{filter.count}</span></Button>)}
        </div>
      </div>
      {lens === "done" ? <TaskRegister title="Tâches terminées" description="Travail terminé dans ce périmètre." tasks={rows} state="termine" target="dashboard-task-completed" /> : <>
        {lens !== "todo" && <TaskRegister title="En cours" description="Travail déjà commencé." tasks={rows.filter((task) => task.statut === "en_cours")} state="en_cours" target="dashboard-task-ongoing" />}
        {lens !== "active" && <TaskRegister title="À faire" description="Tâches à commencer." tasks={rows.filter((task) => task.statut === "a_faire")} state="a_faire" target="dashboard-task-todo" />}
      </>}
      {others.length > 0 && <TaskRegister title="Autres tâches accessibles" description="Travail accessible dans ce périmètre." tasks={others} state={lens === "done" ? "termine" : "en_cours"} target="dashboard-task-other" />}
    </section>
  );
}
