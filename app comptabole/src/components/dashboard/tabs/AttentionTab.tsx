import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AttentionList } from "@/components/dashboard/attention/AttentionList";
import type { DashboardAttentionItem } from "@/lib/dashboard/dashboardData";

export function AttentionTab({ items, loading, error, onRetry }: { items: DashboardAttentionItem[]; loading: boolean; error: boolean; onRetry: () => void; }) {
  return (
    <section className="min-w-0 border-t-2 border-primary">
      <header className="flex items-end justify-between gap-3 py-3">
        <div><h2 className="text-base font-semibold text-primary">File de traitement</h2><p className="mt-0.5 text-xs text-muted-foreground">Éléments classés par urgence et type d'action</p></div>
        {!loading && !error ? <p className="text-xs tabular-nums text-muted-foreground">{items.length} élément{items.length > 1 ? "s" : ""}</p> : null}
      </header>
      {loading ? (
        <div className="space-y-1">{[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-16 w-full" />)}</div>
      ) : error ? (
        <div className="flex items-start gap-3 border-b border-border py-4"><AlertTriangle className="mt-0.5 size-4 text-warning" /><div><p className="text-sm font-medium">Impossible de charger les collectes.</p><Button variant="link" size="sm" className="h-auto px-0" onClick={onRetry}>Réessayer</Button></div></div>
      ) : <AttentionList items={items} grouped />}
    </section>
  );
}
