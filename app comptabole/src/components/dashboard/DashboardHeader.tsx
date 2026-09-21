import { CalendarDays } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardQuickActions } from "@/components/dashboard/DashboardQuickActions";
import type { DashboardRole, DashboardViewModel } from "@/lib/dashboard/dashboardData";
import { cn, formatNumber } from "@/lib/utils";

interface DashboardHeaderProps {
  salutation: string;
  dateLabel: string;
  data: DashboardViewModel;
  loading: boolean;
  role: DashboardRole;
  canAddSociete: boolean;
  canUseMessaging: boolean;
}

export function DashboardHeader({ salutation, dateLabel, data, loading, role, canAddSociete, canUseMessaging }: DashboardHeaderProps) {
  const metrics = role === "societe_employe"
    ? data.kpis
    : [
        ...data.kpis.filter((kpi) => kpi.id !== "collectes"),
        {
          id: "overdue" as const,
          label: "Échéances en retard",
          value: data.deadlines.filter((deadline) => deadline.bucket === "overdue").length,
          tone: data.deadlines.some((deadline) => deadline.bucket === "overdue") ? "destructive" as const : "neutral" as const,
        },
      ];

  return (
    <header className="overflow-hidden rounded-lg bg-primary text-primary-foreground">
      <div className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
        <div className="min-w-0">
          <h1 className="font-serif text-2xl font-semibold tracking-tight sm:text-[1.7rem]">{salutation}</h1>
          <p className="mt-1 max-w-2xl text-sm text-primary-foreground/72">
            {role === "societe_employe"
              ? "Voici les éléments utiles pour suivre vos échanges avec le cabinet."
              : "Voici les éléments qui demandent votre attention aujourd'hui."}
          </p>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-primary-foreground/60">
            <CalendarDays className="size-3.5" aria-hidden="true" />
            {dateLabel}
          </p>
        </div>
        <DashboardQuickActions role={role} canAddSociete={canAddSociete} canUseMessaging={canUseMessaging} inverse />
      </div>
      <div className="mx-4 border-t border-accent/60 sm:mx-5" />
      <dl className="grid grid-cols-2 px-4 py-3 sm:px-5 md:flex md:divide-x md:divide-primary-foreground/15">
        {metrics.map((metric, index) => {
          const collectionDependent = metric.id === "deadline" || metric.id === "collectes" || metric.id === "overdue";
          return (
            <div
              key={metric.id}
              className={cn(
                "min-w-0 py-2 pr-3 md:flex-1 md:px-4 md:py-0 md:first:pl-0",
                index % 2 === 0 && "border-r border-primary-foreground/15 md:border-r-0",
                index % 2 === 1 && "pl-3 md:pl-4",
                index > 1 && "border-t border-primary-foreground/15 md:border-t-0",
              )}
            >
              <dt className="truncate text-[0.67rem] font-medium uppercase tracking-[0.08em] text-primary-foreground/58">{metric.label}</dt>
              {loading && collectionDependent ? (
                <Skeleton className="mt-1 h-7 w-14 bg-primary-foreground/20" />
              ) : (
                <dd className="mt-0.5 text-2xl font-semibold tabular-nums tracking-tight">
                  {typeof metric.value === "number" ? formatNumber(metric.value) : metric.value}
                </dd>
              )}
            </div>
          );
        })}
      </dl>
    </header>
  );
}
