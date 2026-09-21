import { useNavigate } from "react-router-dom";
import { ArrowRight, ClipboardCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardEmptyState } from "@/components/dashboard/DashboardEmptyState";
import { COLLECTE_STATUT_LABELS } from "@/lib/collecte/tabs";
import type { DashboardCollectionActivity } from "@/lib/dashboard/dashboardData";
import { formatDate, formatRelative } from "@/lib/utils";

export function ClientCollectionsTab({ collections, loading }: { collections: DashboardCollectionActivity[]; loading: boolean }) {
  const navigate = useNavigate();
  return (
    <Card className="shadow-none">
      <CardHeader className="p-4"><CardTitle>Collectes ouvertes</CardTitle><CardDescription>Classeurs à suivre avec votre cabinet</CardDescription></CardHeader>
      <CardContent className="p-4 pt-0">
        {loading ? <div className="space-y-3">{[0, 1, 2].map((item) => <Skeleton key={item} className="h-14 w-full" />)}</div> : collections.length === 0 ? <DashboardEmptyState icon={ClipboardCheck} title="Aucune collecte ouverte" /> : (
          <ul>
            {collections.map((collection, index) => (
              <li key={collection.id}>
                {index > 0 && <Separator />}
                <div className="flex min-w-0 items-center gap-3 py-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><ClipboardCheck className="size-4" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><p className="font-medium">{collection.periode}</p><Badge variant={collection.statut === "a_corriger" ? "warning" : "outline"}>{COLLECTE_STATUT_LABELS[collection.statut]}</Badge></div>
                    <p className="mt-1 text-xs text-muted-foreground">{collection.echeance ? `Échéance ${formatDate(collection.echeance)}` : `Mis à jour ${formatRelative(collection.updatedAt)}`}</p>
                  </div>
                  <Button variant="ghost" size="icon-sm" onClick={() => navigate(collection.route)} aria-label={`Ouvrir la collecte ${collection.periode}`}><ArrowRight className="size-4" /></Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
