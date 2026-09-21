import { useNavigate } from "react-router-dom";
import { ArrowRight, CalendarClock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DashboardEmptyState } from "@/components/dashboard/DashboardEmptyState";
import type { DashboardDeadline, DeadlineBucket } from "@/lib/dashboard/dashboardData";

const GROUP_LABELS: Record<DeadlineBucket, string> = { overdue: "En retard", today: "Aujourd'hui", week: "7 prochains jours", later: "Plus tard" };

function dateParts(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return { day: new Intl.DateTimeFormat("fr-FR", { day: "2-digit" }).format(date), month: new Intl.DateTimeFormat("fr-FR", { month: "short" }).format(date).replace(".", "").toUpperCase() };
}

export function DeadlineList({ deadlines }: { deadlines: DashboardDeadline[] }) {
  const navigate = useNavigate();
  if (deadlines.length === 0) return <DashboardEmptyState icon={CalendarClock} title="Aucune échéance à suivre" description="Aucune collecte visible ne nécessite actuellement de suivi d'échéance." />;
  const groups = (Object.keys(GROUP_LABELS) as DeadlineBucket[]).map((bucket) => ({ bucket, items: deadlines.filter((item) => item.bucket === bucket) })).filter((group) => group.items.length > 0);

  return (
    <div>
      {groups.map((group) => (
        <section key={group.bucket} aria-labelledby={`deadline-${group.bucket}`}>
          <h3 id={`deadline-${group.bucket}`} className="flex items-center justify-between border-b border-primary/25 pb-2 pt-5 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-primary first:pt-0"><span>{GROUP_LABELS[group.bucket]}</span><span className="tabular-nums text-muted-foreground">{group.items.length}</span></h3>
          <ul>
            {group.items.map((item) => {
              const date = dateParts(item.echeance);
              return (
                <li key={item.id} className="grid min-w-0 grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-border py-3">
                  <time dateTime={item.echeance} className="flex shrink-0 flex-col items-center border-r border-border pr-3 leading-none"><span className="text-base font-semibold tabular-nums text-primary">{date.day}</span><span className="mt-1 text-[0.62rem] font-semibold tracking-wide text-muted-foreground">{date.month}</span></time>
                  <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-medium text-foreground">{item.societeName}</p><Badge variant={item.bucket === "overdue" ? "destructive" : item.bucket === "today" ? "warning" : "outline"} className="shrink-0">{item.badge}</Badge></div><p className="mt-0.5 truncate text-xs text-muted-foreground">{item.periode}</p></div>
                  <Button variant="ghost" size="icon-sm" onClick={() => navigate(item.route)} aria-label={`Ouvrir ${item.societeName}`}><ArrowRight className="size-4" /></Button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
