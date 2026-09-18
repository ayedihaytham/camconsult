import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface ClientDistributionCardProps {
  entries: [string, number][];
  dotColors: string[];
  activeCount: number;
  totalCount: number;
}

export function ClientDistributionCard({
  entries,
  dotColors,
  activeCount,
  totalCount,
}: ClientDistributionCardProps) {
  const maxCount = Math.max(1, ...entries.map(([, count]) => count));
  return (
    <Card className="shadow-none">
      <CardHeader className="p-4 sm:p-5">
        <CardTitle>Répartition des clients</CardTitle>
        <CardDescription>Répartition par type de société</CardDescription>
      </CardHeader>
      <CardContent className="min-w-0 p-4 pt-0 sm:p-5 sm:pt-0">
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune société enregistrée.</p>
        ) : (
          <ul className="space-y-3" aria-label="Répartition des clients par type de société">
              {entries.map(([theme, count], index) => (
                <li key={theme} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex min-w-0 items-start gap-2 text-muted-foreground">
                    <span className={cn("size-2 shrink-0 rounded-full", dotColors[index % dotColors.length])} aria-hidden="true" />
                    <span className="break-words">{theme}</span>
                    </span>
                    <span className="font-medium tabular-nums text-foreground">{count}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                    <div className={cn("h-full rounded-full", dotColors[index % dotColors.length])} style={{ width: `${(count / maxCount) * 100}%` }} />
                  </div>
                </li>
              ))}
          </ul>
        )}
      </CardContent>
      <CardFooter className="flex-col items-stretch gap-3 p-4 pt-0 sm:p-5 sm:pt-0">
        <Separator />
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Sociétés actives</span>
          <span className="font-medium tabular-nums text-foreground">
            {activeCount} / {totalCount}
          </span>
        </div>
      </CardFooter>
    </Card>
  );
}
