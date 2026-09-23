import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tache } from "@/types";
import { getTaskActivity } from "./taskTypes";

export function TaskActivity({ task, className }: { task: Tache; className?: string }) {
  const activity = getTaskActivity(task);
  return (
    <time
      dateTime={activity.date}
      className={cn("inline-flex min-w-0 items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground", className)}
    >
      <Clock className="size-3 shrink-0" aria-hidden="true" />
      {activity.label}
    </time>
  );
}
