import type { Table } from "@tanstack/react-table";
import { Clock } from "lucide-react";
import { DataTablePagination } from "@/components/data-table/DataTablePagination";
import { Badge } from "@/components/ui/badge";
import { cn, formatRelative } from "@/lib/utils";
import { TACHE_STATUT_LABELS } from "@/types";
import type { TacheStatut } from "@/types";
import { TaskActionsMenu } from "./TaskActionsMenu";
import { TaskAssignee } from "./TaskAssignee";
import { TaskStatusBadge } from "./TaskStatusBadge";
import type { PresentedTask, TaskPresentationActions } from "./taskTypes";

const STATUS_ORDER: TacheStatut[] = ["a_faire", "en_cours", "termine"];

const STATUS_DOT: Record<TacheStatut, string> = {
  a_faire: "bg-slate-400",
  en_cours: "bg-amber-500",
  termine: "bg-emerald-500",
};

export interface TaskListGroup {
  status: TacheStatut;
  totalCount: number;
  tasks: PresentedTask[];
}

/**
 * Group only the already-paginated rows while keeping counts based on the
 * complete filtered/sorted dataset. This preserves the shared 10-row page
 * between Liste and Table instead of paginating each status independently.
 */
export function groupTaskListPage(
  visibleTasks: PresentedTask[],
  allFilteredTasks: PresentedTask[],
): TaskListGroup[] {
  return STATUS_ORDER.map((status) => ({
    status,
    totalCount: allFilteredTasks.filter((task) => task.task.statut === status)
      .length,
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
  const allFilteredTasks = table
    .getPrePaginationRowModel()
    .rows.map((row) => row.original);
  const groups = groupTaskListPage(visibleTasks, allFilteredTasks);

  return (
    <div className="w-full min-w-0 overflow-hidden rounded-xl border border-border bg-card">
      {groups.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          {emptyMessage}
        </p>
      ) : (
        groups.map((group, groupIndex) => (
          <section key={group.status} aria-labelledby={`task-list-${group.status}`}>
            <header
              className={cn(
                "flex h-11 items-center justify-between border-b border-border bg-muted/20 px-3 sm:px-4",
                groupIndex > 0 && "border-t",
              )}
            >
              <div className="flex items-center gap-2">
                <h2
                  id={`task-list-${group.status}`}
                  className="text-sm font-semibold text-foreground"
                >
                  {TACHE_STATUT_LABELS[group.status]}
                </h2>
                <Badge
                  variant="outline"
                  className="h-5 min-w-5 justify-center rounded-full bg-background px-1.5 text-[11px] font-medium tabular-nums text-muted-foreground"
                >
                  {group.totalCount}
                </Badge>
              </div>
            </header>

            <div>
              {group.tasks.map((task, taskIndex) => {
                const displayDate = task.task.termineLe ?? task.task.majLe;

                return (
                  <article
                    key={task.task.id}
                    className={cn(
                      "grid min-w-0 grid-cols-[minmax(0,1fr)] items-center gap-x-4 gap-y-2 px-3 py-3 transition-colors hover:bg-muted/20 md:grid-cols-[minmax(0,1fr)_auto] md:px-4 md:py-2.5",
                      taskIndex < group.tasks.length - 1 &&
                        "border-b border-border/70",
                      actions.pendingTaskIds.has(task.task.id) && "opacity-70",
                    )}
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <span
                        className={cn(
                          "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                          STATUS_DOT[group.status],
                        )}
                        aria-hidden="true"
                      />
                      <div className="min-w-0 flex-1">
                        <p
                          className="truncate text-sm font-semibold leading-5 text-foreground"
                          title={task.task.titre}
                        >
                          {task.task.titre}
                        </p>
                        <p
                          className="mt-0.5 line-clamp-1 text-xs leading-4 text-muted-foreground"
                          title={
                            task.task.description
                              ? `${task.societeName} · ${task.task.description}`
                              : task.societeName
                          }
                        >
                          <span className="font-medium text-foreground/70">
                            {task.societeName}
                          </span>
                          {task.task.description && ` · ${task.task.description}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex min-w-0 flex-col gap-2 pl-5 md:flex-row md:items-center md:gap-3 md:pl-0">
                      <div className="flex min-w-0 items-center justify-between gap-3 md:contents">
                        <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground md:order-1">
                          <Clock className="h-3 w-3" aria-hidden="true" />
                          {formatRelative(displayDate)}
                        </span>
                        <div className="min-w-0 max-w-[12rem] md:order-2 md:max-w-[10rem]">
                          <TaskAssignee task={task} />
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-3 md:contents">
                        <TaskStatusBadge
                          status={task.task.statut}
                          className="md:order-3"
                        />
                        <div className="md:order-4">
                          <TaskActionsMenu
                            task={task.task}
                            canManage={actions.canManage}
                            canChangeStatus={actions.canChangeStatus}
                            onStatusChange={actions.onStatusChange}
                            onEdit={actions.onEdit}
                            onDelete={actions.onDelete}
                          />
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))
      )}

      <DataTablePagination
        table={table}
        itemLabel="tâches"
        className="rounded-none border-x-0 border-b-0 bg-muted/10"
      />
    </div>
  );
}
