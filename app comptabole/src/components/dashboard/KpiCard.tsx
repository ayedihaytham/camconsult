import {
  Building2,
  CalendarClock,
  ClipboardCheck,
  FileText,
  ListChecks,
  MessageCircle,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatNumber } from "@/lib/utils";
import type { DashboardKpi } from "@/lib/dashboard/dashboardData";

const KPI_ICONS: Record<DashboardKpi["id"], LucideIcon> = {
  clients: Building2,
  collectes: ClipboardCheck,
  tasks: ListChecks,
  messages: MessageCircle,
  deadline: CalendarClock,
  documents: FileText,
};

const SUPPORT_TONE = {
  neutral: "text-muted-foreground",
  primary: "text-primary",
  warning: "text-foreground",
  destructive: "text-destructive",
  success: "text-foreground",
} as const;

interface KpiCardProps {
  kpi: DashboardKpi;
  loading?: boolean;
}

export function KpiCard({ kpi, loading = false }: KpiCardProps) {
  const Icon = KPI_ICONS[kpi.id];
  return (
    <Card className="min-w-0 shadow-none">
      <CardContent className="flex min-h-[7.5rem] items-start gap-3 p-3 min-[380px]:block sm:p-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1 min-[380px]:mt-3">
          {loading ? (
            <>
              <Skeleton className="h-7 w-12" />
              <Skeleton className="mt-2 h-4 w-24" />
              <Skeleton className="mt-2 h-3 w-28" />
            </>
          ) : (
            <>
              <p className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">
                {typeof kpi.value === "number" ? formatNumber(kpi.value) : kpi.value}
              </p>
              <p className="mt-0.5 text-sm font-medium leading-tight text-foreground">{kpi.label}</p>
              <p className={cn("mt-1 text-xs leading-tight", SUPPORT_TONE[kpi.tone ?? "neutral"])}>
                {kpi.supportingText}
              </p>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
