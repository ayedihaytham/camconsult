import type { Row } from "@tanstack/react-table";
import { cn } from "@/lib/utils";
import { TaskActionsMenu } from "./TaskActionsMenu";
import { TaskActivity } from "./TaskActivity";
import { TaskAssignee } from "./TaskAssignee";
import { TaskNextAction } from "./TaskNextAction";
import { TaskStatusBadge } from "./TaskStatusBadge";
import type { PresentedTask, TaskPresentationActions } from "./taskTypes";

export function TaskTableMobileCard({
  row,
  actions,
}: {
  row: Row<PresentedTask>;
  actions: TaskPresentationActions;
}) {
  const presented = row.original;
  const task = presented.task;
  const isPending = actions.pendingTaskIds.has(task.id);

  return (
    <article className={cn("min-w-0 border-b border-border/80 bg-card px-3 py-3 sm:px-4", isPending && "opacity-70")}>
      <div className="flex min-w-0 items-start gap-2">
        <h3 className="min-w-0 flex-1 line-clamp-2 text-sm font-semibold leading-5 text-foreground" title={task.titre}>
          {task.titre}
        </h3>
        <TaskStatusBadge status={task.statut} className="shrink-0 text-[11px]" />
        <TaskActionsMenu
          task={task}
          canManage={actions.canManage}
          canChangeStatus={actions.canChangeStatus}
          onStatusChange={actions.onStatusChange}
          onEdit={actions.onEdit}
          onDelete={actions.onDelete}
          isPending={isPending}
        />
      </div>
      <p className="mt-1 truncate text-xs font-medium text-foreground/75" title={presented.societeName}>
        {presented.societeName}
      </p>
      {task.description && (
        <p className="mt-1 line-clamp-1 text-xs text-muted-foreground" title={task.description}>
          {task.description}
        </p>
      )}
      <div className="mt-2 flex min-w-0 items-center gap-3 border-t border-border/60 pt-2">
        <div className="min-w-0 flex-1"><TaskAssignee task={presented} /></div>
        <TaskActivity task={task} className="shrink-0 text-[11px]" />
      </div>
      <div className="flex justify-end">
        <TaskNextAction
          task={task}
          canChangeStatus={actions.canChangeStatus}
          onStatusChange={actions.onStatusChange}
          isPending={isPending}
        />
      </div>
    </article>
  );
}
