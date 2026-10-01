import { useId, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight, CalendarDays, ChevronLeft, ChevronRight, Files } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn, formatDate } from "@/lib/utils";
import {
  dashboardDateKey,
  transmissionRows,
  type DashboardDeadline,
} from "@/lib/dashboard/dashboardData";
import { WorkspaceLoading } from "./WorkspaceSection";

const monthLabel = (date: Date) =>
  new Intl.DateTimeFormat("fr-FR", { month: "short" }).format(date);

export function CollectionTransmissions({
  deadlines,
  now,
  loading,
  error,
}: {
  deadlines: DashboardDeadline[];
  now: Date;
  loading: boolean;
  error: boolean;
}) {
  const headingId = useId();
  const [selected, setSelected] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const today = dashboardDateKey(now);
  const dates = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now);
    date.setDate(now.getDate() + weekOffset * 7 + index);
    return date;
  });
  const rangeStart = dashboardDateKey(dates[0]);
  const rangeEnd = dashboardDateKey(dates[dates.length - 1]);
  const selectedDate = selected && selected >= rangeStart && selected <= rangeEnd ? selected : rangeStart;
  const rows = transmissionRows(deadlines, selectedDate);
  function changeWeek(offset: number) {
    const nextOffset = Math.max(0, weekOffset + offset);
    const date = new Date(now);
    date.setDate(now.getDate() + nextOffset * 7);
    setWeekOffset(nextOffset);
    setSelected(dashboardDateKey(date));
  }
  const first = dates[0];
  const last = dates[dates.length - 1];
  const sameYear = first.getFullYear() === last.getFullYear();
  const startLabel =
    sameYear && first.getMonth() === last.getMonth()
      ? first.getDate()
      : new Intl.DateTimeFormat("fr-FR", {
          day: "numeric",
          month: "long",
          year: sameYear ? undefined : "numeric",
        }).format(first);
  const rangeLabel = `${startLabel}–${new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(last)}`;
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    deadlines.forEach((item) =>
      map.set(item.echeance, (map.get(item.echeance) ?? 0) + 1),
    );
    return map;
  }, [deadlines]);
  const overdue = deadlines.filter((item) => item.bucket === "overdue").length;

  return (
    <section
      className="transmission-ledger"
      data-tour="dashboard-transmissions"
      aria-labelledby={headingId}
    >
      <header className="transmission-header flex flex-wrap items-start justify-between gap-x-5 gap-y-1">
        <div className="dashboard-section-identity min-w-0 flex-1">
          <Files className="dashboard-transmission-icon" aria-hidden="true" />
          <div className="min-w-0">
            <h2
              id={headingId}
              className="text-lg font-semibold tracking-tight text-primary"
            >
              Transmissions de collecte
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Dates limites des collectes uniquement. Les tâches n’ont pas
              d’échéance.
            </p>
          </div>
        </div>
        <div className="transmission-meta flex flex-wrap items-center gap-x-3 text-xs">
          {!loading && !error && overdue > 0 && (
            <Badge
              variant="destructive"
              className="dashboard-badge dashboard-badge--danger tabular-nums"
            >
              {overdue} en retard
            </Badge>
          )}
          <Link
            to="/?tab=deadlines"
            className="dashboard-navigation flex min-h-11 items-center gap-1.5 font-medium text-primary"
          >
            Échéances
            <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>
      </header>

      {loading ? (
        <WorkspaceLoading />
      ) : error ? (
        <p role="status" className="py-4 text-sm text-muted-foreground">
          Les transmissions sont indisponibles. Utilisez Réessayer pour
          recharger les collectes.
        </p>
      ) : (
        <>
          <p className="ledger-range" aria-live="polite">{rangeLabel}</p>
          <div className="ledger-navigation">
          <button type="button" className="ledger-navigation-control" aria-label="Sept jours précédents" disabled={weekOffset === 0} onClick={() => changeWeek(-1)}><ChevronLeft aria-hidden="true" /></button>
          <div
            data-tour="dashboard-deadline-strip"
            role="group"
            aria-label="Dates des collectes"
            className="ledger-ruler max-w-full overflow-x-auto"
          >
            <div className="ledger-ruler-track">
              {dates.map((date) => {
                const key = dashboardDateKey(date);
                const count = counts.get(key) ?? 0;
                const isToday = key === today;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelected(key)}
                    className={cn("ledger-day", isToday && "ledger-today")}
                    aria-pressed={selectedDate === key}
                    aria-current={isToday ? "date" : undefined}
                    aria-label={`${formatDate(key)}, ${count} collecte${count > 1 ? "s" : ""}`}
                  >
                    <span className="ledger-day-label">
                      {isToday
                        ? "Aujourd’hui"
                        : new Intl.DateTimeFormat("fr-FR", {
                            weekday: "short",
                          }).format(date)}
                    </span>
                    <time dateTime={key} className="ledger-date">
                      <span className="ledger-day-number">
                        {String(date.getDate()).padStart(2, "0")}
                      </span>
                      {(isToday || date.getDate() === 1) && (
                        <span className="ledger-month">{monthLabel(date)}</span>
                      )}
                    </time>
                    <span className="ledger-day-count">
                      {count > 0 ? (
                        <>
                          <span
                            className="ledger-count-mark"
                            aria-hidden="true"
                          />
                          {count} collecte{count > 1 ? "s" : ""}
                        </>
                      ) : (
                        <span aria-hidden="true">—</span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <button type="button" className="ledger-navigation-control" aria-label="Sept jours suivants" onClick={() => changeWeek(1)}><ChevronRight aria-hidden="true" /></button>
          </div>

          <div className="ledger-details">
            <div
              className="ledger-selected"
              aria-live="polite"
              aria-atomic="true"
            >
              <h3 className="flex flex-wrap items-baseline justify-between gap-2 text-sm font-semibold text-primary">
                <span className="flex items-center gap-2">
                  <CalendarDays className="size-4" aria-hidden="true" />
                  {selectedDate === today
                    ? "Aujourd’hui"
                    : formatDate(selectedDate)}
                </span>
                {rows.selected.length > 0 && (
                  <span className="text-xs font-normal tabular-nums text-muted-foreground">
                    {rows.selected.length} collecte
                    {rows.selected.length > 1 ? "s" : ""}
                  </span>
                )}
              </h3>
              {rows.selected.length ? (
                <TransmissionList deadlines={rows.selected} />
              ) : (
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {selectedDate === today
                    ? "Aucune transmission prévue aujourd’hui."
                    : "Aucune transmission prévue."}
                </p>
              )}
            </div>

            <div className="ledger-upcoming">
              <h3 className="mb-1 text-sm font-semibold text-primary">
                Prochaines transmissions
              </h3>
              {rows.upcoming.length > 0 ? (
                <TransmissionList deadlines={rows.upcoming} />
              ) : (
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Aucune prochaine échéance dans le périmètre affiché.
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function TransmissionList({ deadlines }: { deadlines: DashboardDeadline[] }) {
  return (
    <ul>
      {deadlines.map((item) => (
        <li key={item.id} className="border-b border-border last:border-b-0">
          <Link
            to={item.route}
            className="transmission-entry dashboard-navigation group"
          >
            <time dateTime={item.echeance} className="ledger-entry-date">
              <strong>{item.echeance.slice(8)}</strong>
              <span>{monthLabel(new Date(`${item.echeance}T00:00:00`))}</span>
            </time>
            <div className="min-w-0">
              <p className="break-words text-sm font-medium text-primary">
                {item.societeName}
              </p>
              <p className="ledger-entry-context mt-0.5 text-xs text-muted-foreground">
                {item.periode}
                <span aria-hidden="true"> · </span>
                <span
                  className={cn(
                    "dashboard-transmission-state",
                    item.statut === "a_corriger"
                      ? "dashboard-transmission-state--warning font-semibold text-warning"
                      : item.statut === "transmis"
                        ? "font-medium text-primary"
                        : "text-muted-foreground",
                  )}
                >
                  {item.statut === "transmis"
                    ? "Déjà transmis · à examiner"
                    : item.statut === "a_corriger"
                      ? "Corrections demandées"
                      : "Transmission attendue"}
                </span>
              </p>
            </div>
            <ArrowRight
              className="size-4 shrink-0 text-muted-foreground group-hover:text-primary"
              aria-hidden="true"
            />
          </Link>
        </li>
      ))}
    </ul>
  );
}
