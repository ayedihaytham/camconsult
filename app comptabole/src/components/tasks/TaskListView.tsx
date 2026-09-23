import type { Table } from "@tanstack/react-table";
import { DataTablePagination } from "@/components/data-table/DataTablePagination";
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
    <div className="task-work-register min-w-0 border-y border-border/80 bg-card">
      <div className="flex min-h-10 items-center justify-between gap-3 border-b border-border/80 px-3 sm:px-4">
        <h2 className="text-sm font-semibold text-foreground">File de travail</h2>
        <p className="hidden text-xs text-muted-foreground sm:block">
          Lecture par statut · prochaines actions à portée de main
        </p>
      </div>
      {groups.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">{emptyMessage}</p>
      ) : groups.map((group, index) => (
        <section key={group.status} aria-labelledby={`task-list-${group.status}`}>
          <header
            className={cn(
              "flex min-h-8 items-center gap-2 border-b border-border/80 bg-muted/20 px-3 sm:px-4",
              index > 0 && "border-t border-border/80",
            )}
          >
            <span className={cn("h-3.5 w-px", STATUS_RULE[group.status])} aria-hidden="true" />
            <h3 id={`task-list-${group.status}`} className="text-[11px] font-bold uppercase tracking-[0.09em] text-foreground/80">
              {STATUS_LABELS[group.status]}
            </h3>
            <span className="text-[11px] text-muted-foreground">
              {group.totalCount} au total
              {group.tasks.length !== group.totalCount && ` · ${group.tasks.length} sur cette page`}
            </span>
          </header>
          <div>
            {group.tasks.map((presented, taskIndex) => {
              const task = presented.task;
              return (
                <article
                  key={task.id}
                  className={cn(
                    "task-ledger-row grid min-w-0 grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,.95fr)_auto_auto] items-center gap-3 px-3 py-2 transition-colors hover:bg-muted/20 sm:px-4",
                    taskIndex < group.tasks.length - 1 && "border-b border-border/70",
                    actions.pendingTaskIds.has(task.id) && "opacity-70",
                  )}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold leading-5 text-foreground" title={task.titre}>{task.titre}</p>
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
      <DataTablePagination table={table} itemLabel="tâches" className="rounded-none border-x-0 border-b-0 bg-transparent" />
    </div>
  );
}
