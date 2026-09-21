import { useNavigate } from "react-router-dom";
import { ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardEmptyState } from "@/components/dashboard/DashboardEmptyState";
import type { DashboardTaskCounts } from "@/lib/dashboard/dashboardData";
import { cn, formatNumber } from "@/lib/utils";

const ITEMS = [
  { key: "a_faire", label: "À faire", color: "bg-muted-foreground" },
  { key: "en_cours", label: "En cours", color: "bg-warning" },
  { key: "termine", label: "Terminées", color: "bg-success" },
] as const;

export function TaskStatusChart({ counts }: { counts: DashboardTaskCounts }) {
  const navigate = useNavigate();
  const total = counts.a_faire + counts.en_cours + counts.termine;
  return (
    <Card className="shadow-none">
      <CardHeader className="flex-row items-center justify-between gap-3 p-4">
        <CardTitle>Avancement des tâches</CardTitle>
        <Button variant="link" size="sm" className="h-auto px-0" onClick={() => navigate("/taches")}>
          Voir les tâches
        </Button>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {total === 0 ? (
          <DashboardEmptyState icon={ListChecks} title="Aucune tâche assignée" />
        ) : (
          <div aria-label={`${total} tâches au total`}>
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-3xl font-semibold tabular-nums tracking-tight">{formatNumber(total)}</p>
                <p className="text-xs text-muted-foreground">tâches au total</p>
              </div>
              <p className="text-right text-xs text-muted-foreground">
                {formatNumber(counts.a_faire + counts.en_cours)} ouvertes
              </p>
            </div>
            <div className="mt-5 flex h-2.5 overflow-hidden rounded-full bg-muted" role="img" aria-label="Répartition par statut">
              {ITEMS.map((item) => {
                const value = counts[item.key];
                return value > 0 ? (
                  <span
                    key={item.key}
                    className={cn("h-full", item.color)}
                    style={{ width: `${(value / total) * 100}%` }}
                    title={`${item.label} : ${value}`}
                  />
                ) : null;
              })}
            </div>
            <ul className="mt-5 grid grid-cols-3 gap-2">
              {ITEMS.map((item) => (
                <li key={item.key} className="min-w-0">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className={cn("size-2 shrink-0 rounded-full", item.color)} aria-hidden="true" />
                    <span className="truncate">{item.label}</span>
                  </div>
                  <p className="mt-1 text-lg font-semibold tabular-nums">{formatNumber(counts[item.key])}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
