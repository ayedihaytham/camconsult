import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Tache, TacheStatut } from "@/types";
import { getNextTaskStatus } from "./taskTypes";

export function TaskNextAction({
  task,
  canChangeStatus,
  onStatusChange,
  isPending,
}: {
  task: Tache;
  canChangeStatus: (task: Tache, status: TacheStatut) => boolean;
  onStatusChange: (task: Tache, status: TacheStatut) => Promise<void>;
  isPending: boolean;
}) {
  const next = getNextTaskStatus(task, canChangeStatus);
  if (!next) return null;

  const label = next === "en_cours" ? "Passer en cours" : "Terminer";
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
