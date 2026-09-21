import { useNavigate } from "react-router-dom";
import { ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardEmptyState } from "@/components/dashboard/DashboardEmptyState";
import type { DashboardDeadline, DashboardTaskCounts } from "@/lib/dashboard/dashboardData";
import { cn, formatDate, formatNumber } from "@/lib/utils";

const ITEMS = [
  { key: "a_faire", label: "À faire", color: "bg-muted-foreground" },
  { key: "en_cours", label: "En cours", color: "bg-accent" },
  { key: "termine", label: "Terminées", color: "bg-success" },
] as const;

export function TaskStatusChart({ counts, nextDeadline }: { counts: DashboardTaskCounts; nextDeadline: DashboardDeadline | null }) {
  const navigate = useNavigate();
  const total = counts.a_faire + counts.en_cours + counts.termine;
  return (
    <aside className="min-w-0 self-start rounded-lg border border-accent/30 bg-accent/12 p-4 shadow-none">
      <header className="flex items-start justify-between gap-3 border-b border-accent/35 pb-3">
        <div>
          <h2 className="text-base font-semibold text-primary">Avancement des tâches</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Répartition du travail du cabinet</p>
        </div>
        <Button variant="link" size="sm" className="h-auto px-0" onClick={() => navigate("/taches")}>Voir les tâches</Button>
      </header>
      <div className="pt-4">
        {total === 0 ? (
          <DashboardEmptyState icon={ListChecks} title="Aucune tâche assignée" />
        ) : (
          <div aria-label={`${total} tâches au total`}>
            <div className="flex items-end justify-between gap-3">
              <div><p className="text-3xl font-semibold tabular-nums tracking-tight text-primary">{formatNumber(total)}</p><p className="text-xs text-muted-foreground">tâches au total</p></div>
              <p className="text-right text-xs text-muted-foreground">{formatNumber(counts.a_faire + counts.en_cours)} ouvertes</p>
            </div>
            <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-primary/15" role="img" aria-label="Répartition par statut">
              {ITEMS.map((item) => {
                const value = counts[item.key];
                return value > 0 ? <span key={item.key} className={cn("h-full", item.color)} style={{ width: `${(value / total) * 100}%` }} title={`${item.label} : ${value}`} /> : null;
              })}
            </div>
            <ul className="mt-4 grid grid-cols-3 gap-2">
              {ITEMS.map((item) => (
                <li key={item.key} className="min-w-0">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className={cn("size-2 shrink-0 rounded-full", item.color)} aria-hidden="true" /><span className="truncate">{item.label}</span></div>
                  <p className="mt-1 text-lg font-semibold tabular-nums">{formatNumber(counts[item.key])}</p>
                </li>
              ))}
            </ul>
            {nextDeadline ? (
              <div className="mt-4 border-t border-accent/35 pt-3">
                <p className="text-[0.67rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  {nextDeadline.daysFromToday < 0 ? "Échéance à régulariser" : "Prochaine échéance de collecte"}
                </p>
                <p className="mt-1 text-sm font-medium text-primary">{formatDate(nextDeadline.echeance)} · {nextDeadline.societeName}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{nextDeadline.periode} · {nextDeadline.badge}</p>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </aside>
  );
}
