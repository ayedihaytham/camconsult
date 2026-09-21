import { useNavigate } from "react-router-dom";
import { AlertTriangle, CalendarDays, ClipboardCheck, SearchCheck } from "lucide-react";
import type { DashboardViewModel } from "@/lib/dashboard/dashboardData";

interface UrgencySummaryProps {
  data: DashboardViewModel;
  loading: boolean;
}

export function UrgencySummary({ data, loading }: UrgencySummaryProps) {
  const navigate = useNavigate();
  const overdue = data.deadlines.filter((deadline) => deadline.bucket === "overdue").length;
  const dueToday = data.deadlines.filter((deadline) => deadline.bucket === "today").length;
  const corrections = data.collectionCounts.a_corriger;
  const reviews = data.collectionCounts.transmis;

  if (loading) {
    return <div className="h-16 border-y border-border bg-muted/20" aria-hidden="true" />;
  }

  const items = [
    {
      label: "En retard",
      value: overdue,
      icon: AlertTriangle,
      route: "/?tab=deadlines",
      tone: overdue > 0 ? "text-destructive" : "text-muted-foreground",
    },
    {
      label: "Aujourd'hui",
      value: dueToday,
      icon: CalendarDays,
      route: "/?tab=deadlines",
      tone: dueToday > 0 ? "text-foreground" : "text-muted-foreground",
    },
    {
      label: "À corriger",
      value: corrections,
      icon: ClipboardCheck,
      route: "/?tab=attention",
      tone: corrections > 0 ? "text-foreground" : "text-muted-foreground",
    },
    {
      label: "À vérifier",
      value: reviews,
      icon: SearchCheck,
      route: "/?tab=attention",
      tone: reviews > 0 ? "text-foreground" : "text-muted-foreground",
    },
  ];

  return (
    <section aria-label="Éléments à traiter en priorité" className="border-y border-border bg-muted/20">
      <div className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-4 sm:divide-y-0">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              type="button"
              className="flex min-w-0 items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
              onClick={() => navigate(item.route)}
            >
              <Icon className={`size-4 shrink-0 ${item.tone}`} aria-hidden="true" />
              <span className="min-w-0">
                <span className={`block text-base font-semibold tabular-nums leading-none ${item.tone}`}>{item.value}</span>
                <span className="mt-1 block truncate text-xs text-muted-foreground">{item.label}</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
