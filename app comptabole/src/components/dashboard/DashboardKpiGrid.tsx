import { KpiCard } from "@/components/dashboard/KpiCard";
import type { DashboardKpi } from "@/lib/dashboard/dashboardData";

interface DashboardKpiGridProps {
  kpis: DashboardKpi[];
  collectesLoading: boolean;
}

export function DashboardKpiGrid({ kpis, collectesLoading }: DashboardKpiGridProps) {
  return (
    <section
      aria-label="Indicateurs clés"
      className="grid min-w-0 grid-cols-1 gap-3 min-[380px]:grid-cols-2 xl:grid-cols-4"
    >
      {kpis.map((kpi) => (
        <KpiCard
          key={kpi.id}
          kpi={kpi}
          loading={collectesLoading && (kpi.id === "collectes" || kpi.id === "deadline")}
        />
      ))}
    </section>
  );
}
