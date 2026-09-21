import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AttentionList } from "@/components/dashboard/attention/AttentionList";
import { TaskStatusChart } from "@/components/dashboard/charts/TaskStatusChart";
import type { DashboardViewModel } from "@/lib/dashboard/dashboardData";

export function OverviewTab({ data, loading }: { data: DashboardViewModel; loading: boolean }) {
  const navigate = useNavigate();
  return (
    <div className="grid min-w-0 gap-3 xl:grid-cols-2">
      <Card className="min-w-0 shadow-none">
        <CardHeader className="flex-row items-center justify-between gap-3 p-4">
          <CardTitle>Priorités</CardTitle>
          <Button variant="link" size="sm" className="h-auto px-0" onClick={() => navigate("/?tab=attention")}>
            Voir tout
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 px-4 pb-4">
              {[0, 1, 2].map((item) => <Skeleton key={item} className="h-14 w-full" />)}
            </div>
          ) : (
            <AttentionList items={data.attentionItems} limit={3} />
          )}
        </CardContent>
      </Card>
      <TaskStatusChart counts={data.taskCounts} />
    </div>
  );
}
