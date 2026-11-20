import { useState } from "react";
import type { Table } from "@tanstack/react-table";
import { ChevronDown } from "lucide-react";
import {
  OperationalContentHeader,
  OperationalLedgerFooter,
} from "@/components/ledger/OperationalLedgerLayout";
import { cn } from "@/lib/utils";
import type { TacheStatut } from "@/types";
import { TaskActionsMenu } from "./TaskActionsMenu";
import { TaskActivity } from "./TaskActivity";
import { TaskAssignee } from "./TaskAssignee";
import { TaskNextAction } from "./TaskNextAction";
import type { PresentedTask, TaskPresentationActions } from "./taskTypes";

const STATUS_ORDER: TacheStatut[] = ["a_faire", "en_cours", "termine"];
const STATUS_LABELS: Record<TacheStatut, string> = {
  a_faire: "À faire",
  en_cours: "En cours",
  termine: "Terminées",
};
const STATUS_RULE: Record<TacheStatut, string> = {
  a_faire: "bg-muted-foreground/55",
  en_cours: "bg-primary/60",
  termine: "bg-success",
};

/** Liseré et compteur de chaque groupe : mêmes tons que les colonnes du Kanban. */
const REPERE_GROUPE: Record<TacheStatut, string> = { a_faire: "#7284a1", en_cours: "hsl(var(--accent))", termine: "#2f7a55" };

export interface TaskListGroup {
  status: TacheStatut;
  totalCount: number;
  tasks: PresentedTask[];
}

/** One shared page of rows; group totals still describe the full filtered set. */
export function groupTaskListPage(
  visibleTasks: PresentedTask[],
  allFilteredTasks: PresentedTask[],
): TaskListGroup[] {
  return STATUS_ORDER.map((status) => ({
    status,
    totalCount: allFilteredTasks.filter((task) => task.task.statut === status).length,
    tasks: visibleTasks.filter((task) => task.task.statut === status),
  })).filter((group) => group.tasks.length > 0);
}

export function TaskListView({
  table,
  emptyMessage,
  ...actions
}: TaskPresentationActions & {
  table: Table<PresentedTask>;
  emptyMessage: string;
}) {
  const visibleTasks = table.getRowModel().rows.map((row) => row.original);
  const allFilteredTasks = table.getPrePaginationRowModel().rows.map((row) => row.original);
  const groups = groupTaskListPage(visibleTasks, allFilteredTasks);
  // Sur téléphone, les groupes se déplient d'un appui (les terminées sont repliées au départ) ; sur ordinateur ils restent ouverts.
  const [replies, setReplies] = useState<Set<TacheStatut>>(() => new Set<TacheStatut>(["termine"]));
  const basculer = (status: TacheStatut) => setReplies((precedent) => { const suivant = new Set(precedent); if (suivant.has(status)) suivant.delete(status); else suivant.add(status); return suivant; });

  return (
    <div className="task-work-register min-w-0">
      <OperationalContentHeader className="min-h-10 border-x-0 border-t-0">
        <h2 className="font-display text-base font-extrabold text-primary">{allFilteredTasks.filter((t) => t.task.statut !== "termine").length} tâche{allFilteredTasks.filter((t) => t.task.statut !== "termine").length > 1 ? "s" : ""} ouverte{allFilteredTasks.filter((t) => t.task.statut !== "termine").length > 1 ? "s" : ""}</h2>
      </OperationalContentHeader>
      {groups.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">{emptyMessage}</p>
      ) : groups.map((group, index) => (
        <section key={group.status} aria-labelledby={`task-list-${group.status}`}>
          <header
            className={cn(
              "flex min-h-10 items-center gap-2 border-t-[3px] bg-[#FBF9F3] px-4 sm:px-5",
              index > 0 && "mt-3",
            )}
            style={{ borderTopColor: REPERE_GROUPE[group.status] }}
          >
            <span className={cn("hidden", STATUS_RULE[group.status])} aria-hidden="true" />
            <h3 id={`task-list-${group.status}`} className="flex-1 text-[11px] font-extrabold uppercase tracking-[0.12em] text-primary">
              <button type="button" aria-expanded={!replies.has(group.status)} onClick={() => basculer(group.status)} className="flex w-full items-center gap-2 text-left max-lg:min-h-11 lg:pointer-events-none">
                {STATUS_LABELS[group.status]}
                <ChevronDown className={cn("ml-auto size-4 text-muted-foreground transition-transform lg:hidden", replies.has(group.status) && "-rotate-90")} aria-hidden="true" />
              </button>
            </h3>
            <span className="font-serif text-lg font-semibold tabular-nums" style={{ color: REPERE_GROUPE[group.status] }}>
              {group.totalCount}
            </span>
          </header>
          <div className={cn(replies.has(group.status) && "max-lg:hidden")}>
            {group.tasks.map((presented) => {
              const task = presented.task;
              return (
                <article
                  key={task.id}
                  className={cn(
                    "task-ledger-row mx-3 mt-2 grid min-w-0 grid-cols-2 items-center gap-x-3 gap-y-2 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,.95fr)_auto_auto] rounded-xl border border-primary/10 bg-card px-4 py-3 shadow-[0_1px_2px_hsl(var(--primary)/0.05)] transition-colors hover:bg-[#F5F8FD]",
                    actions.pendingTaskIds.has(task.id) && "opacity-70",
                  )}
                >
                  <div className="col-span-2 min-w-0 md:col-span-1">
                    <p className="truncate text-sm font-bold leading-5 text-primary" title={task.titre}>{task.titre}</p>
                    {task.description && <p className="mt-0.5 truncate text-xs leading-4 text-muted-foreground" title={task.description}>{task.description}</p>}
                  </div>
                  <span className="min-w-0 truncate text-xs text-foreground/75" title={presented.societeName}>{presented.societeName}</span>
                  <div className="min-w-0"><TaskAssignee task={presented} /></div>
                  <TaskActivity task={task} className="truncate" />
                  <div className="min-w-[98px]">
                    <TaskNextAction
                      task={task}
                      canChangeStatus={actions.canChangeStatus}
                      onStatusChange={actions.onStatusChange}
                      isPending={actions.pendingTaskIds.has(task.id)}
                    />
                  </div>
                  <div>
                    <TaskActionsMenu
                      task={task}
                      canManage={actions.canManage}
                      canChangeStatus={actions.canChangeStatus}
                      onStatusChange={actions.onStatusChange}
                      onEdit={actions.onEdit}
                      onDelete={actions.onDelete}
                      isPending={actions.pendingTaskIds.has(task.id)}
                    />
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}
      <OperationalLedgerFooter table={table} itemLabel="tâches" />
    </div>
  );
}
