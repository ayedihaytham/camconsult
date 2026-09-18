import type { Table } from "@tanstack/react-table";
import { Clock } from "lucide-react";
import { DataTablePagination } from "@/components/data-table/DataTablePagination";
import { cn, formatRelative } from "@/lib/utils";
import { TaskActionsMenu } from "./TaskActionsMenu";
import { TaskAssignee } from "./TaskAssignee";
import { TaskCompanyBadge } from "./TaskCompanyBadge";
import { TaskStatusBadge } from "./TaskStatusBadge";
import type { PresentedTask, TaskPresentationActions } from "./taskTypes";

export function TaskListView({
  table,
  emptyMessage,
  ...actions
}: TaskPresentationActions & {
  table: Table<PresentedTask>;
  emptyMessage: string;
}) {
  const rows = table.getRowModel().rows;

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            {emptyMessage}
          </p>
        ) : (
          <div className="divide-y divide-border">
            {rows.map(({ original: task }) => {
              const displayDate = task.task.termineLe ?? task.task.majLe;

              return (
                <article
                  key={task.task.id}
                  className={cn(
                    "flex flex-col gap-3 p-4 sm:flex-row sm:items-center",
                    actions.pendingTaskIds.has(task.task.id) && "opacity-70",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
                      {task.task.titre}
                    </p>
                    {task.task.description && (
                      <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                        {task.task.description}
                      </p>
                    )}
                    <div className="mt-2.5 flex flex-wrap items-center gap-3">
                      <TaskCompanyBadge name={task.societeName} />
                      <div className="min-w-0 max-w-full sm:max-w-[200px]">
                        <TaskAssignee task={task} />
                      </div>
                    </div>
                  </div>

                  <div className="flex min-w-0 items-center justify-between gap-3 border-t border-border/60 pt-3 sm:border-0 sm:pt-0">
                    <TaskStatusBadge status={task.task.statut} />
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatRelative(displayDate)}
                    </span>
                    <TaskActionsMenu
                      task={task.task}
                      canManage={actions.canManage}
                      canChangeStatus={actions.canChangeStatus}
                      onStatusChange={actions.onStatusChange}
                      onEdit={actions.onEdit}
                      onDelete={actions.onDelete}
                    />
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
      <DataTablePagination table={table} itemLabel="tâches" />
    </div>
  );
}

