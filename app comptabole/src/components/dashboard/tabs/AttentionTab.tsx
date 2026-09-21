import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AttentionList } from "@/components/dashboard/attention/AttentionList";
import type { DashboardAttentionItem } from "@/lib/dashboard/dashboardData";

export function AttentionTab({ items, loading, error, onRetry }: {
  items: DashboardAttentionItem[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}) {
  return (
    <Card className="min-w-0 shadow-none">
      <CardHeader className="p-4">
        <CardTitle>File de traitement</CardTitle>
        <CardDescription>Éléments classés par urgence et type d'action</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="space-y-3 px-4 pb-4">{[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-16 w-full" />)}</div>
        ) : error ? (
          <div className="flex items-start gap-3 px-4 pb-4">
            <AlertTriangle className="mt-0.5 size-4 text-warning" />
            <div>
              <p className="text-sm font-medium">Impossible de charger les collectes.</p>
              <Button variant="link" size="sm" className="h-auto px-0" onClick={onRetry}>Réessayer</Button>
            </div>
          </div>
        ) : (
          <AttentionList items={items} grouped />
        )}
      </CardContent>
    </Card>
  );
}
