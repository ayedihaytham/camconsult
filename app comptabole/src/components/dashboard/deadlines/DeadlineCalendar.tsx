import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusDot } from "@/components/ledger/StatusDot";
import { cn } from "@/lib/utils";
import { calendarDate, calendarDateKey, deadlineCalendarDays, shiftCalendarMonth } from "@/lib/dashboard/deadlineCalendar";
import type { DashboardDeadline } from "@/lib/dashboard/dashboardData";

const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const fullDate = (date: Date) => date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

export function DeadlineCalendar({ deadlines, now }: { deadlines: DashboardDeadline[]; now: Date }) {
  const titleId = useId();
  const today = calendarDateKey(now);
  const [selected, setSelected] = useState(today);
  const [month, setMonth] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const calendarRef = useRef<HTMLDivElement>(null);
  const focusRequested = useRef(false);
  const days = deadlineCalendarDays(month);
  const byDate = useMemo(() => {
    const map = new Map<string, DashboardDeadline[]>();
    for (const deadline of deadlines) map.set(deadline.echeance, [...(map.get(deadline.echeance) ?? []), deadline]);
    return map;
  }, [deadlines]);
  const selectedItems = byDate.get(selected) ?? [];
  const monthKey = calendarDateKey(month).slice(0, 7);
  const monthCount = deadlines.filter((item) => item.echeance.startsWith(monthKey)).length;
  const next = deadlines.find((item) => item.echeance >= today);
  const overdue = deadlines.filter((item) => item.echeance < today);

  useEffect(() => {
    if (!focusRequested.current) return;
    calendarRef.current?.querySelector<HTMLButtonElement>(`[data-date="${selected}"]`)?.focus();
    focusRequested.current = false;
  }, [selected, month]);

  function choose(key: string, focus = false) {
    const date = calendarDate(key);
    focusRequested.current = focus;
    setSelected(key);
    setMonth(new Date(date.getFullYear(), date.getMonth(), 1));
  }

  function moveMonth(amount: number) {
    const date = shiftCalendarMonth(calendarDate(selected), amount);
    choose(calendarDateKey(date));
  }

  function keyboard(event: KeyboardEvent<HTMLButtonElement>, date: Date) {
    const steps: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, Home: -((date.getDay() + 6) % 7), End: 6 - ((date.getDay() + 6) % 7) };
    if (event.key === "PageUp" || event.key === "PageDown") {
      event.preventDefault();
      choose(calendarDateKey(shiftCalendarMonth(date, event.key === "PageUp" ? -1 : 1)), true);
    } else if (event.key in steps) {
      event.preventDefault();
      choose(calendarDateKey(new Date(date.getFullYear(), date.getMonth(), date.getDate() + steps[event.key])), true);
    }
  }

  return (
    <div className="deadline-calendar-layout">
      <section className="deadline-calendar" aria-labelledby={titleId}>
        <header className="deadline-calendar-toolbar">
          <div>
            <h3 id={titleId} aria-live="polite">{month.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}</h3>
            <p>{monthCount} échéance{monthCount > 1 ? "s" : ""} ce mois</p>
          </div>
          <div className="flex items-center gap-1">
            <Button type="button" variant="outline" size="icon" className="size-11 sm:size-9" aria-label="Mois précédent" onClick={() => moveMonth(-1)}><ChevronLeft aria-hidden="true" /></Button>
            <Button type="button" variant="outline" className="h-11 px-3 text-xs sm:h-9" onClick={() => choose(today)}>Aujourd’hui</Button>
            <Button type="button" variant="outline" size="icon" className="size-11 sm:size-9" aria-label="Mois suivant" onClick={() => moveMonth(1)}><ChevronRight aria-hidden="true" /></Button>
          </div>
        </header>
        <div className="deadline-calendar-weekdays" aria-hidden="true">{WEEKDAYS.map((day) => <span key={day}>{day}</span>)}</div>
        <div ref={calendarRef} className="deadline-calendar-grid" role="group" aria-label="Calendrier des échéances">
          {days.map((day) => {
            const items = byDate.get(day.key) ?? [];
            const late = items.length > 0 && day.key < today;
            return (
              <button key={day.key} type="button" data-date={day.key} tabIndex={day.key === selected ? 0 : -1}
                aria-label={`${fullDate(day.date)}, ${items.length} échéance${items.length > 1 ? "s" : ""}`}
                aria-pressed={selected === day.key} aria-current={today === day.key ? "date" : undefined}
                className={cn("deadline-calendar-day", !day.inMonth && "is-outside", selected === day.key && "is-selected", today === day.key && "is-today", late && "is-overdue")}
                onClick={() => choose(day.key)} onKeyDown={(event) => keyboard(event, day.date)}>
                <span className="deadline-calendar-number">{day.date.getDate()}</span>
                {items.length > 0 && <><span className="deadline-calendar-count"><span aria-hidden="true" />{items.length}<span className="deadline-calendar-count-label"> collecte{items.length > 1 ? "s" : ""}</span></span><span className="deadline-calendar-company">{items[0].societeName}{items.length > 1 ? ` +${items.length - 1}` : ""}</span></>}
              </button>
            );
          })}
        </div>
        <p className="deadline-calendar-help">Sélectionnez une date pour voir les collectes. Les flèches du clavier déplacent la sélection.</p>
      </section>
      <aside className="deadline-calendar-detail" aria-labelledby={`${titleId}-selected`}>
        <div className="deadline-calendar-detail-heading"><CalendarDays className="size-4" aria-hidden="true" /><h3 id={`${titleId}-selected`}>{fullDate(calendarDate(selected))}</h3></div>
        <p className="deadline-calendar-detail-count" aria-live="polite">{selectedItems.length} collecte{selectedItems.length > 1 ? "s" : ""} à cette date</p>
        {selectedItems.length ? <ul className="deadline-calendar-events">{selectedItems.map((item) => <li key={item.id}><Link to={item.route}>
          <div className="min-w-0"><strong>{item.societeName}</strong><p>{item.periode}</p><StatusDot className="mt-2 text-xs" tone={item.bucket === "overdue" ? "destructive" : item.bucket === "today" ? "warning" : "primary"} label={item.statut === "transmis" ? "Déjà transmis · à examiner" : item.badge} /></div><ArrowUpRight className="size-4 shrink-0" aria-hidden="true" />
        </Link></li>)}</ul> : <p className="deadline-calendar-empty">{deadlines.length === 0 ? "Aucune échéance à suivre." : "Aucune collecte prévue à cette date."}</p>}
        <div className="deadline-calendar-shortcuts">
          {next && <Button type="button" variant="outline" className="h-auto min-h-11 justify-between whitespace-normal text-left text-xs" onClick={() => choose(next.echeance)}>Prochaine échéance<ChevronRight className="size-4 shrink-0" aria-hidden="true" /></Button>}
          {overdue.length > 0 && <Button type="button" variant="outline" className="h-auto min-h-11 justify-between whitespace-normal text-left text-xs" onClick={() => choose(overdue[0].echeance)}>{overdue.length} échéance{overdue.length > 1 ? "s" : ""} en retard<ChevronRight className="size-4 shrink-0" aria-hidden="true" /></Button>}
        </div>
      </aside>
    </div>
  );
}
