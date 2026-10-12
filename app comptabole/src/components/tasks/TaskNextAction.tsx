import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Tache, TacheStatut } from "@/types";
import { getNextTaskStatus } from "./taskTypes";

export function TaskNextAction({
  task,
  canChangeStatus,
  onStatusChange,
  isPending,
  variant = "link",
}: {
  task: Tache;
  canChangeStatus: (task: Tache, status: TacheStatut) => boolean;
  onStatusChange: (task: Tache, status: TacheStatut) => Promise<void>;
  isPending: boolean;
  /** « carte » : bouton lisible du tableau Kanban (Commencer / Terminer). */
  variant?: "link" | "carte";
}) {
  const next = getNextTaskStatus(task, canChangeStatus);
  if (!next) return null;

  const label = next === "en_cours" ? "Passer en cours" : "Terminer";
  if (variant === "carte") {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isPending}
        aria-label={`${label} : ${task.titre}`}
        className={cn(
          "h-8 gap-1.5 px-2.5 text-xs font-bold shadow-none",
          next === "termine"
            ? "border-success/40 bg-success/10 text-success hover:bg-success hover:text-success-foreground"
            : "border-accent bg-accent/15 text-primary hover:bg-accent",
        )}
        onClick={() => void onStatusChange(task, next)}
      >
        {isPending ? "En cours…" : next === "termine" ? "✓ Terminer" : "▶ Commencer"}
      </Button>
    );
  }
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={isPending}
      aria-label={`${label} : ${task.titre}`}
      className="h-7 gap-1 px-1.5 text-xs font-semibold text-primary shadow-none hover:bg-primary/5"
      onClick={() => void onStatusChange(task, next)}
    >
      {isPending ? "En cours…" : label}
      {!isPending && <ArrowRight className="size-3" aria-hidden="true" />}
    </Button>
  );
}
