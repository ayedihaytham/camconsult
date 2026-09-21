import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DeadlineList } from "@/components/dashboard/deadlines/DeadlineList";
import type { DashboardDeadline } from "@/lib/dashboard/dashboardData";

export function DeadlinesTab({ deadlines, loading, error, onRetry }: { deadlines: DashboardDeadline[]; loading: boolean; error: boolean; onRetry: () => void; }) {
  const overdue = deadlines.filter((item) => item.bucket === "overdue").length;
  const today = deadlines.filter((item) => item.bucket === "today").length;
  const week = deadlines.filter((item) => item.bucket === "week").length;
  return (
    <section className="min-w-0 border-t-2 border-primary">
      <header className="flex flex-col gap-3 py-3 sm:flex-row sm:items-end sm:justify-between">
        <div><h2 className="text-base font-semibold text-primary">Échéances des collectes</h2><p className="mt-0.5 text-xs text-muted-foreground">Dates limites réelles, hors collectes validées ou archivées</p></div>
        {!loading && !error ? <div className="flex flex-wrap gap-2" aria-label="Résumé des échéances"><Badge variant={overdue > 0 ? "destructive" : "outline"}>{overdue} en retard</Badge><Badge variant={today > 0 ? "warning" : "outline"}>{today} aujourd'hui</Badge><Badge variant="outline">{week} cette semaine</Badge></div> : null}
      </header>
      {loading ? (
        <div className="space-y-1">{[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-16 w-full" />)}</div>
      ) : error ? (
        <div className="flex items-start gap-3 border-b border-border py-4"><AlertTriangle className="mt-0.5 size-4 text-warning" /><div><p className="text-sm font-medium">Impossible de charger les échéances.</p><Button variant="link" size="sm" className="h-auto px-0" onClick={onRetry}>Réessayer</Button></div></div>
      ) : <DeadlineList deadlines={deadlines} />}
    </section>
  );
}
