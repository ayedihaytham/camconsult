import type { Row } from "@tanstack/react-table";
import { Clock } from "lucide-react";
import { cn, formatRelative } from "@/lib/utils";
import { TaskActionsMenu } from "./TaskActionsMenu";
import { TaskAssignee } from "./TaskAssignee";
import { TaskCompanyBadge } from "./TaskCompanyBadge";
import { TaskStatusBadge } from "./TaskStatusBadge";
import type { PresentedTask, TaskPresentationActions } from "./taskTypes";

export function TaskTableMobileCard({
  row,
  actions,
}: {
  row: Row<PresentedTask>;
  actions: TaskPresentationActions;
}) {
  const task = row.original;
  const displayDate = task.task.termineLe ?? task.task.majLe;

  return (
    <article
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-card",
        actions.pendingTaskIds.has(task.task.id) && "opacity-70",
      )}
    >
      <div className="p-2.5 pb-2">
        <div className="flex min-w-0 items-start gap-2">
          <p
            className="min-w-0 flex-1 truncate text-sm font-semibold leading-5 text-foreground"
            title={task.task.titre}
          >
            {task.task.titre}
          </p>
          <TaskStatusBadge status={task.task.statut} />
          <TaskActionsMenu
            task={task.task}
            canManage={actions.canManage}
            canChangeStatus={actions.canChangeStatus}
            onStatusChange={actions.onStatusChange}
            onEdit={actions.onEdit}
            onDelete={actions.onDelete}
          />
        </div>

        <div className="mt-1.5 flex min-w-0 items-center gap-2">
          <TaskCompanyBadge
            name={task.societeName}
            className="max-w-[45%] shrink-0"
          />
          {task.task.description && (
            <p
              className="min-w-0 flex-1 truncate text-xs leading-4 text-muted-foreground"
              title={task.task.description}
            >
              {task.task.description}
            </p>
          )}
        </div>
      </div>

      <div className="flex min-w-0 items-center justify-between gap-2 border-t border-border/60 bg-muted/15 px-2.5 py-1.5">
        <div className="min-w-0 flex-1">
          <TaskAssignee task={task} />
        </div>
        <span
          className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground"
          aria-label={`Mise à jour ${formatRelative(displayDate)}`}
        >
          <Clock className="h-3 w-3" />
          {formatRelative(displayDate)}
        </span>
      </div>
    </article>
  );
}
