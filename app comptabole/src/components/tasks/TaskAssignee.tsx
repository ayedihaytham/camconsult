import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { PresentedTask } from "./taskTypes";

export function TaskAssignee({
  task,
  size = "compact",
}: {
  task: PresentedTask;
  size?: "compact" | "ledger";
}) {
  const presenceLabel = task.assigneeOnline ? "En ligne" : "Hors ligne";

  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="relative shrink-0">
        <Avatar
          className={cn(
            "border border-border",
            size === "ledger" ? "h-8 w-8" : "h-7 w-7",
          )}
        >
          <AvatarFallback className="bg-primary/10 text-[9px] font-semibold text-primary">
            {task.assigneeInitials}
          </AvatarFallback>
        </Avatar>
        {task.assigneeOnline !== null && (
          <span
            className={cn(
              "absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border-2 border-background",
              task.assigneeOnline
                ? "bg-success"
                : "bg-muted-foreground/40",
            )}
            role="img"
            aria-label={presenceLabel}
            title={`${task.assigneeName} — ${presenceLabel}`}
          />
        )}
      </span>
      <span
        className="truncate text-xs font-medium text-foreground/75"
        title={task.assigneeName}
      >
        {task.assigneeName}
      </span>
    </div>
  );
}
