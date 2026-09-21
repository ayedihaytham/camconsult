import { ClipboardCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { DashboardEmptyState } from "@/components/dashboard/DashboardEmptyState";
import type { DashboardCollectionCounts } from "@/lib/dashboard/dashboardData";

const ITEMS = [
  { key: "brouillon", label: "Brouillon", bar: "[&>div]:bg-muted-foreground" },
  { key: "transmis", label: "À vérifier", bar: "[&>div]:bg-primary" },
  { key: "a_corriger", label: "À corriger", bar: "[&>div]:bg-warning" },
  { key: "valide", label: "Validées", bar: "[&>div]:bg-success" },
] as const;

export function CollectionStatusChart({ counts }: { counts: DashboardCollectionCounts }) {
  const total = ITEMS.reduce((sum, item) => sum + counts[item.key], 0);
  const max = Math.max(1, ...ITEMS.map((item) => counts[item.key]));
  return (
    <Card className="shadow-none">
      <CardHeader className="p-4">
        <CardTitle>Flux des collectes</CardTitle>
        <CardDescription>Répartition des collectes non archivées</CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {total === 0 ? (
          <DashboardEmptyState icon={ClipboardCheck} title="Aucune collecte" />
        ) : (
          <ul className="space-y-3">
            {ITEMS.map((item) => (
              <li key={item.key}>
                <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="font-medium tabular-nums text-foreground">{counts[item.key]}</span>
                </div>
                <Progress
                  value={(counts[item.key] / max) * 100}
                  aria-label={`${item.label} : ${counts[item.key]} collectes`}
                  className={`h-1.5 bg-muted ${item.bar}`}
                />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
