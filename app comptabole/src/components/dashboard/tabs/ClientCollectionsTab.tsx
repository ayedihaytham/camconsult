import { useNavigate } from "react-router-dom";
import { ArrowRight, ClipboardCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardEmptyState } from "@/components/dashboard/DashboardEmptyState";
import { COLLECTE_STATUT_LABELS } from "@/lib/collecte/tabs";
import type { DashboardCollectionActivity } from "@/lib/dashboard/dashboardData";
import { formatDate, formatRelative } from "@/lib/utils";

export function ClientCollectionsTab({ collections, loading }: { collections: DashboardCollectionActivity[]; loading: boolean }) {
  const navigate = useNavigate();
  return (
    <section className="min-w-0 border-t-2 border-primary">
      <header className="py-3"><h2 className="text-base font-semibold text-primary">Collectes ouvertes</h2><p className="mt-0.5 text-xs text-muted-foreground">Classeurs à suivre avec votre cabinet</p></header>
      {loading ? <div className="space-y-1">{[0, 1, 2].map((item) => <Skeleton key={item} className="h-14 w-full" />)}</div> : collections.length === 0 ? <DashboardEmptyState icon={ClipboardCheck} title="Aucune collecte ouverte" /> : (
        <ul>{collections.map((collection) => (
          <li key={collection.id} className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-border py-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/8 text-primary"><ClipboardCheck className="size-3.5" /></span>
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{collection.periode}</p><Badge variant={collection.statut === "a_corriger" ? "warning" : "outline"}>{COLLECTE_STATUT_LABELS[collection.statut]}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{collection.echeance ? `Échéance ${formatDate(collection.echeance)}` : `Mis à jour ${formatRelative(collection.updatedAt)}`}</p></div>
            <Button variant="ghost" size="icon-sm" onClick={() => navigate(collection.route)} aria-label={`Ouvrir la collecte ${collection.periode}`}><ArrowRight className="size-4" /></Button>
          </li>
        ))}</ul>
      )}
    </section>
  );
}
