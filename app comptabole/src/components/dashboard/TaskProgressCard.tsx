import { useState } from "react";
import { ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

interface TaskProgressCardProps {
  counts: { aFaire: number; enCours: number; termine: number };
  workloads: { id: string; label: string; total: number; done: number }[];
  onOpenTasks: () => void;
}

export function TaskProgressCard({ counts, workloads, onOpenTasks }: TaskProgressCardProps) {
  const total = counts.aFaire + counts.enCours + counts.termine;
  const [showAll, setShowAll] = useState(false);
  const visibleWorkloads = showAll ? workloads : workloads.slice(0, 4);
  return (
    <Card className="min-w-0 shadow-none">
      <CardHeader className="flex-col gap-2 p-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:p-5">
        <div className="min-w-0">
          <CardTitle>Avancement des tâches</CardTitle>
          <CardDescription className="mt-1">Suivi de la charge de l'équipe</CardDescription>
        </div>
        <Button variant="link" size="sm" onClick={onOpenTasks} className="h-auto self-start px-0 sm:shrink-0">
          Voir les tâches
        </Button>
      </CardHeader>
      <CardContent className="min-w-0 p-4 pt-0 sm:p-5 sm:pt-0">
        {total === 0 ? (
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="flex size-9 items-center justify-center rounded-lg bg-muted">
              <ListChecks className="size-4" aria-hidden="true" />
            </span>
            Aucune tâche en cours.
          </div>
        ) : (
          <>
            <div className="grid min-w-0 grid-cols-3 divide-x divide-border">
              <TaskSummary value={counts.aFaire} label="À faire" />
              <TaskSummary value={counts.enCours} label="En cours" />
              <TaskSummary value={counts.termine} label="Terminée" />
            </div>
            {workloads.length > 0 && (
              <>
                <Separator className="my-4" />
                <div className="space-y-3">
                  {visibleWorkloads.map((workload) => (
                    <div key={workload.id}>
                      <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                        <span className="truncate text-muted-foreground">{workload.label}</span>
                        <span className="shrink-0 font-medium tabular-nums text-foreground">
                          {workload.done} / {workload.total}
                        </span>
                      </div>
                      <Progress value={(workload.done / workload.total) * 100} aria-label={`${workload.label} : ${workload.done} sur ${workload.total} tâches terminées`} />
                    </div>
                  ))}
                </div>
                {workloads.length > 4 && (
                  <Button variant="link" size="sm" onClick={() => setShowAll((value) => !value)} className="mt-3 h-auto px-0">
                    {showAll ? "Afficher moins" : `Voir tout (${workloads.length})`}
                  </Button>
                )}
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function TaskSummary({ value, label }: { value: number; label: string }) {
  return (
    <div className="min-w-0 px-2 text-center first:pl-0 last:pr-0 sm:px-3">
      <p className="text-xl font-semibold tabular-nums text-foreground sm:text-2xl">{value}</p>
      <p className="mt-1 truncate text-xs font-medium text-muted-foreground">{label}</p>
    </div>
  );
}
