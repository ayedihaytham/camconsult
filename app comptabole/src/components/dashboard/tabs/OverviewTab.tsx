import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AttentionList } from "@/components/dashboard/attention/AttentionList";
import { TaskStatusChart } from "@/components/dashboard/charts/TaskStatusChart";
import type { DashboardViewModel } from "@/lib/dashboard/dashboardData";

export function OverviewTab({ data, loading }: { data: DashboardViewModel; loading: boolean }) {
  const navigate = useNavigate();
  return (
    <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(18rem,0.85fr)]">
      <section className="min-w-0 border-t-2 border-primary">
        <header className="flex items-start justify-between gap-3 py-3">
          <div>
            <h2 className="text-base font-semibold text-primary">Priorités du cabinet</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Les éléments qui nécessitent une décision ou une action.</p>
          </div>
          <Button variant="link" size="sm" className="h-auto px-0" onClick={() => navigate("/?tab=attention")}>Voir tout</Button>
        </header>
        {loading ? (
          <div className="space-y-1">{[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-16 w-full" />)}</div>
        ) : (
          <AttentionList items={data.attentionItems} limit={4} />
        )}
      </section>
      <TaskStatusChart counts={data.taskCounts} nextDeadline={data.nextDeadline} />
    </div>
  );
}
