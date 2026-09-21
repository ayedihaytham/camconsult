import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CollectionStatusChart } from "@/components/dashboard/charts/CollectionStatusChart";
import { DeadlineList } from "@/components/dashboard/deadlines/DeadlineList";
import type { DashboardCollectionCounts, DashboardDeadline } from "@/lib/dashboard/dashboardData";

export function DeadlinesTab({ deadlines, counts, loading, error, onRetry }: {
  deadlines: DashboardDeadline[];
  counts: DashboardCollectionCounts;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}) {
  const overdue = deadlines.filter((item) => item.bucket === "overdue").length;
  const today = deadlines.filter((item) => item.bucket === "today").length;
  const week = deadlines.filter((item) => item.bucket === "week").length;
  return (
    <div className="min-w-0 space-y-3">
      <div className="flex flex-wrap gap-2" aria-label="Résumé des échéances">
        <Badge variant={overdue > 0 ? "destructive" : "outline"}>{overdue} en retard</Badge>
        <Badge variant={today > 0 ? "warning" : "outline"}>{today} aujourd'hui</Badge>
        <Badge variant="outline">{week} cette semaine</Badge>
      </div>
      <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1.5fr)_minmax(18rem,0.75fr)]">
        <Card className="min-w-0 shadow-none">
          <CardHeader className="p-4">
            <CardTitle>Échéances des collectes</CardTitle>
            <CardDescription>Dates limites réelles, hors collectes validées ou archivées</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-3 px-4 pb-4">{[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-14 w-full" />)}</div>
            ) : error ? (
              <div className="flex items-start gap-3 px-4 pb-4">
                <AlertTriangle className="mt-0.5 size-4 text-warning" />
                <div><p className="text-sm font-medium">Impossible de charger les échéances.</p><Button variant="link" size="sm" className="h-auto px-0" onClick={onRetry}>Réessayer</Button></div>
              </div>
            ) : <DeadlineList deadlines={deadlines} />}
          </CardContent>
        </Card>
        <CollectionStatusChart counts={counts} />
      </div>
    </div>
  );
}
