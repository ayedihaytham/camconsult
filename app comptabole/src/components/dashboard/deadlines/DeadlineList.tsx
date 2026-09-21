import { useNavigate } from "react-router-dom";
import { ArrowRight, CalendarClock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { DashboardEmptyState } from "@/components/dashboard/DashboardEmptyState";
import type { DashboardDeadline, DeadlineBucket } from "@/lib/dashboard/dashboardData";

const GROUP_LABELS: Record<DeadlineBucket, string> = {
  overdue: "En retard",
  today: "Aujourd'hui",
  week: "7 prochains jours",
  later: "Plus tard",
};

function dateParts(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return {
    day: new Intl.DateTimeFormat("fr-FR", { day: "2-digit" }).format(date),
    month: new Intl.DateTimeFormat("fr-FR", { month: "short" }).format(date).replace(".", "").toUpperCase(),
  };
}

export function DeadlineList({ deadlines }: { deadlines: DashboardDeadline[] }) {
  const navigate = useNavigate();
  if (deadlines.length === 0) {
    return <DashboardEmptyState icon={CalendarClock} title="Aucune échéance à venir" />;
  }
  const groups = (Object.keys(GROUP_LABELS) as DeadlineBucket[])
    .map((bucket) => ({ bucket, items: deadlines.filter((item) => item.bucket === bucket) }))
    .filter((group) => group.items.length > 0);

  return (
    <div>
      {groups.map((group) => (
        <section key={group.bucket} aria-labelledby={`deadline-${group.bucket}`}>
          <h3 id={`deadline-${group.bucket}`} className="bg-muted/30 px-4 py-2 text-[0.68rem] font-semibold uppercase tracking-wider text-muted-foreground">
            {GROUP_LABELS[group.bucket]}
          </h3>
          <ul className="px-4">
            {group.items.map((item, index) => {
              const date = dateParts(item.echeance);
              return (
                <li key={item.id}>
                  {index > 0 && <Separator />}
                  <div className="flex min-w-0 items-center gap-3 py-3">
                    <time dateTime={item.echeance} className="flex w-10 shrink-0 flex-col items-center leading-none">
                      <span className="text-base font-semibold tabular-nums">{date.day}</span>
                      <span className="mt-1 text-[0.62rem] font-semibold tracking-wide text-muted-foreground">{date.month}</span>
                    </time>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{item.societeName}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.periode}</p>
                    </div>
                    <Badge variant={item.bucket === "overdue" ? "destructive" : item.bucket === "today" ? "warning" : "outline"} className="shrink-0">
                      {item.badge}
                    </Badge>
                    <Button variant="ghost" size="icon-sm" onClick={() => navigate(item.route)} aria-label={`Ouvrir ${item.societeName}`}>
                      <ArrowRight className="size-4" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
