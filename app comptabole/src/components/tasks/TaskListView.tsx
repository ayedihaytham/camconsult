import type { Table } from "@tanstack/react-table";
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
              "flex min-h-10 items-center gap-2 bg-[#FBF9F3] px-4 sm:px-5",
              index > 0 && "mt-3",
            )}
          >
            <span className={cn("hidden", STATUS_RULE[group.status])} aria-hidden="true" />
            <h3 id={`task-list-${group.status}`} className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-primary">
              {STATUS_LABELS[group.status]}
            </h3>
            <span className="text-[11px] font-bold text-primary">
              {group.totalCount}
            </span>
          </header>
          <div>
            {group.tasks.map((presented) => {
              const task = presented.task;
              return (
                <article
                  key={task.id}
                  className={cn(
                    "task-ledger-row mx-3 mt-2 grid min-w-0 grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,.95fr)_auto_auto] items-center gap-3 rounded-xl border border-primary/10 bg-card px-4 py-3 shadow-[0_1px_2px_hsl(var(--primary)/0.05)] transition-colors hover:bg-[#F5F8FD]",
                    actions.pendingTaskIds.has(task.id) && "opacity-70",
                  )}
                >
                  <div className="min-w-0">
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
