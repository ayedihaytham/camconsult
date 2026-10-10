import { useNavigate } from "react-router-dom";
import { ClipboardCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardEmptyState } from "@/components/dashboard/DashboardEmptyState";
import { COLLECTE_STATUT_LABELS } from "@/lib/collecte/tabs";
import type { DashboardCollectionActivity, DashboardViewModel } from "@/lib/dashboard/dashboardData";
import { formatDate, formatRelative } from "@/lib/utils";

/** Vue d'ensemble du responsable de société : une carte par collecte, avec son avancement et l'action utile. */
export function ClientOverviewTab({ data, loading, error = false }: { data: DashboardViewModel; loading: boolean; error?: boolean }) {
  const navigate = useNavigate();
  if (loading) return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((item) => <Skeleton key={item} className="h-44 w-full" />)}</div>;
  if (error) return <DashboardEmptyState icon={ClipboardCheck} title="Collectes indisponibles" />;
  if (data.collections.length === 0) return <DashboardEmptyState icon={ClipboardCheck} title="Aucune collecte pour le moment" />;
  return (
    <ul className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Vos collectes">
      {data.collections.map((collection) => <CollectionCard key={collection.id} collection={collection} onOpen={() => navigate(collection.route)} />)}
    </ul>
  );
}

function CollectionCard({ collection, onOpen }: { collection: DashboardCollectionActivity; onOpen: () => void }) {
  const aCompleter = collection.statut === "brouillon" || collection.statut === "a_corriger";
  const progress = collection.progress;
  return (
    <li className="flex min-w-0 flex-col gap-3 rounded-md border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.67rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Collecte</p>
          <h3 className="mt-0.5 font-serif text-lg font-semibold leading-tight">{collection.libelle}</h3>
          <Badge variant={collection.statut === "a_corriger" || collection.statut === "brouillon" ? "warning" : collection.statut === "valide" ? "success" : "outline"} className="mt-2">
            {collection.statut === "brouillon" ? "À compléter" : COLLECTE_STATUT_LABELS[collection.statut]}
          </Badge>
        </div>
        {progress !== null && <ProgressRing value={progress} />}
      </div>
      <p className="text-xs text-muted-foreground">{collection.echeance ? `Échéance ${formatDate(collection.echeance)}` : `Mis à jour ${formatRelative(collection.updatedAt)}`}</p>
      <Button variant={aCompleter ? "default" : "outline"} className="mt-auto min-h-11 w-full" onClick={onOpen} aria-label={`${aCompleter ? "Compléter" : "Voir le détail de"} la collecte ${collection.libelle}`}>
        {aCompleter ? "Compléter" : "Voir le détail"}
      </Button>
    </li>
  );
}

function ProgressRing({ value }: { value: number }) {
  return (
    <div role="img" aria-label={`Avancement ${value} %`} className="grid size-14 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(hsl(var(--primary)) ${value}%, hsl(var(--muted)) 0)` }}>
      <span className="grid size-11 place-items-center rounded-full bg-card text-xs font-semibold tabular-nums">{value}%</span>
    </div>
  );
}
