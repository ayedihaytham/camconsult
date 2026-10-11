import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatDate } from "@/lib/utils";
import { dashboardDateKey, type DashboardDeadline } from "@/lib/dashboard/dashboardData";

interface Props {
  days: Date[];
  selected: string;
  today: string;
  deadlines: DashboardDeadline[];
  loading: boolean;
  error: boolean;
  onSelect: (key: string) => void;
  onMove: (amount: number) => void;
  onToday: () => void;
}

export function DashboardWeekSelector({ days, selected, today, deadlines, loading, error, onSelect, onMove, onToday }: Props) {
  const unavailable = loading || error;
  const counts = new Map<string, number>();
  if (!unavailable) for (const item of deadlines) counts.set(item.echeance, (counts.get(item.echeance) ?? 0) + 1);
  const first = days[0];
  const last = days[days.length - 1];
  const range = `${first.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} – ${last.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}`;

  return (
    <section className="admin-week" aria-label="Choisir la journée" data-tour="dashboard-deadline-strip">
      <header><div className="flex min-w-0 items-center gap-2"><CalendarDays className="size-4 shrink-0" aria-hidden="true" /><span>{range}</span></div><div className="flex items-center gap-1">
        <Button type="button" variant="outline" size="icon" className="size-11 sm:size-9" aria-label="Sept jours précédents" onClick={() => onMove(-1)}><ChevronLeft aria-hidden="true" /></Button>
        <Button type="button" variant="outline" className="h-11 px-2 text-xs sm:h-9" onClick={onToday}>Aujourd’hui</Button>
        <Button type="button" variant="outline" size="icon" className="size-11 sm:size-9" aria-label="Sept jours suivants" onClick={() => onMove(1)}><ChevronRight aria-hidden="true" /></Button>
      </div></header>
      <div className="admin-week-days" role="group" aria-label="Dates des collectes">
        {days.map((date) => {
          const key = dashboardDateKey(date);
          const count = counts.get(key) ?? 0;
          return <button key={key} type="button" aria-label={`${formatDate(key)}, ${unavailable ? loading ? "collectes en chargement" : "collectes indisponibles" : `${count} collecte${count > 1 ? "s" : ""}`}`}
            aria-current={key === today ? "date" : undefined} aria-pressed={key === selected} className={cn("admin-week-day", key === selected && "is-selected", key === today && "is-today")} onClick={() => onSelect(key)}>
            <span>{date.toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", "")}</span><strong>{date.getDate()}</strong>
            <span className="admin-week-count">{unavailable ? "—" : count}<span> collecte{count > 1 ? "s" : ""}</span></span>
          </button>;
        })}
      </div>
    </section>
  );
}
