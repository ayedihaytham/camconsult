import { useEffect, useRef, useState, type CSSProperties } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaskActionsMenu } from "./TaskActionsMenu";
import { TaskStatusBadge } from "./TaskStatusBadge";
import { formatDate } from "@/lib/utils";
import { calendarDateKey } from "@/lib/dashboard/deadlineCalendar";
import { ganttBarPosition, ganttPeriod, moveGanttPeriod, taskHasPlan, type GanttScale } from "@/lib/taskGantt";
import type { PresentedTask, TaskPresentationActions } from "./taskTypes";
import type { Tache } from "@/types";

interface Props extends TaskPresentationActions {
  tasks: PresentedTask[];
  canEditTask: (task: Tache) => boolean;
  now?: Date;
}

export function TaskGanttView({ tasks, canEditTask, now = new Date(), ...actions }: Props) {
  const today = calendarDateKey(now);
  const [cursor, setCursor] = useState(today);
  const [scale, setScale] = useState<GanttScale>("month");
  const scrollRef = useRef<HTMLDivElement>(null);
  const period = ganttPeriod(cursor, scale);
  const scheduled = tasks.filter((item) => taskHasPlan(item.task)).sort((a, b) => a.task.debutPrevu!.localeCompare(b.task.debutPrevu!) || a.task.titre.localeCompare(b.task.titre, "fr"));
  const unscheduled = tasks.filter((item) => !taskHasPlan(item.task));
  const dayWidth = scale === "month" ? 34 : 96;
  const trackStyle = { "--gantt-days": period.days.length, "--gantt-day-width": `${dayWidth}px`, "--gantt-timeline-width": `${period.days.length * dayWidth}px` } as CSSProperties;
  const title = scale === "month" ? period.days[0].date.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }) : `${formatDate(period.start)} – ${formatDate(period.end)}`;
  const editable = (item: PresentedTask) => canEditTask(item.task) && !actions.pendingTaskIds.has(item.task.id);
  function revealDate(key: string) {
    const area = scrollRef.current;
    const index = period.days.findIndex((day) => day.key === key);
    if (!area || index < 0) return;
    const labelWidth = area.querySelector<HTMLElement>(".tasks-gantt-identity")?.getBoundingClientRect().width ?? 0;
    area.scrollLeft = Math.max(0, index * dayWidth - (area.clientWidth - labelWidth) / 2 + dayWidth / 2);
  }
  useEffect(() => { revealDate(cursor); }, [cursor, scale, scheduled.length]);

  return (
    <section className="tasks-gantt" data-tour="tasks-gantt" aria-label="Gantt des tâches">
      <header className="tasks-gantt-toolbar">
        <div><h2>Planning des tâches</h2><p>{scheduled.length} planifiée{scheduled.length > 1 ? "s" : ""} · {unscheduled.length} non planifiée{unscheduled.length > 1 ? "s" : ""}</p></div>
        <div className="tasks-gantt-controls">
          <div role="group" aria-label="Échelle du Gantt" className="task-view-options">{(["week", "month"] as const).map((value) => <Button key={value} type="button" variant="ghost" className="h-9 px-3 text-xs" aria-pressed={scale === value} onClick={() => setScale(value)}>{value === "week" ? "Semaine" : "Mois"}</Button>)}</div>
          <Button type="button" variant="outline" size="icon" className="size-9" aria-label="Période précédente" onClick={() => setCursor(moveGanttPeriod(period.start, scale, -1))}><ChevronLeft aria-hidden="true" /></Button>
          <Button type="button" variant="outline" className="h-9 px-3 text-xs" onClick={() => { setCursor(today); revealDate(today); }}>Aujourd’hui</Button>
          <Button type="button" variant="outline" size="icon" className="size-9" aria-label="Période suivante" onClick={() => setCursor(moveGanttPeriod(period.start, scale, 1))}><ChevronRight aria-hidden="true" /></Button>
        </div>
      </header>
      <div className="tasks-gantt-period"><span className="capitalize" aria-live="polite">{title}</span><span>Durées prévues · les statuts indiquent l’avancement</span></div>
      {scheduled.length ? <div ref={scrollRef} className="tasks-gantt-scroll" style={trackStyle} tabIndex={0} aria-label="Planning défilant horizontalement">
        <div className="tasks-gantt-canvas">
          <div className="tasks-gantt-axis"><div className="tasks-gantt-identity tasks-gantt-axis-title">Tâche / collaborateur</div><div className="tasks-gantt-day-track">{period.days.map((day) => <time key={day.key} dateTime={day.key} className={`tasks-gantt-day ${day.weekend ? "is-weekend" : ""} ${day.key === today ? "is-today" : ""}`} aria-label={day.key === today ? "Aujourd’hui" : undefined}><span>{day.date.toLocaleDateString("fr-FR", { weekday: "narrow" })}</span><strong>{day.date.getDate()}</strong></time>)}</div></div>
          {scheduled.map((item) => {
            const bar = ganttBarPosition(item.task, period.start, period.days.length);
            const label = `${item.task.titre} · du ${formatDate(item.task.debutPrevu!)} au ${formatDate(item.task.finPrevue!)}`;
            return <div key={item.task.id} className="tasks-gantt-row">
              <div className="tasks-gantt-identity">
                <div className="min-w-0 flex-1"><strong title={item.task.titre}>{item.task.titre}</strong><p>{item.societeName} · {item.assigneeName}</p><p>{formatDate(item.task.debutPrevu!)} – {formatDate(item.task.finPrevue!)}</p><TaskStatusBadge status={item.columnId} />
                  {!bar && <Button type="button" variant="ghost" size="sm" className="tasks-gantt-outside" aria-label={`Afficher sa période : ${item.task.titre}`} onClick={() => setCursor(item.task.debutPrevu!)}>Afficher sa période<ChevronRight className="size-3 shrink-0" aria-hidden="true" /></Button>}
                </div>
                <TaskActionsMenu task={item.task} {...actions} isPending={actions.pendingTaskIds.has(item.task.id)} />
              </div>
              <div className="tasks-gantt-row-track">
                <div className="tasks-gantt-gridlines" aria-hidden="true">{period.days.map((day) => <span key={day.key} className={`${day.weekend ? "is-weekend" : ""} ${day.key === today ? "is-today" : ""}`} />)}</div>
                {bar ? <div className={`tasks-gantt-bar task-plan--${item.columnId} ${bar.continuesBefore ? "continues-before" : ""} ${bar.continuesAfter ? "continues-after" : ""}`} style={{ gridColumn: `${bar.startColumn} / ${bar.endColumn}` }}>
                  {editable(item) ? <button type="button" aria-label={`Modifier la planification : ${label}`} title={label} onClick={() => actions.onEdit(item.task)}><span>{formatDate(item.task.debutPrevu!).slice(0, 5)} – {formatDate(item.task.finPrevue!).slice(0, 5)}</span><Pencil className="size-3" aria-hidden="true" /></button> : <span title={label} aria-label={label}>{formatDate(item.task.debutPrevu!).slice(0, 5)} – {formatDate(item.task.finPrevue!).slice(0, 5)}</span>}
                </div> : null}
              </div>
            </div>;
          })}
        </div>
      </div> : <p className="tasks-gantt-empty">Aucune tâche planifiée. Ajoutez un début et une fin prévus à une tâche pour la placer dans le Gantt.</p>}
      {unscheduled.length > 0 && <section className="tasks-gantt-unscheduled" aria-label="Tâches non planifiées"><header><h3>Non planifiées <span>{unscheduled.length}</span></h3><p>Ces tâches restent disponibles dans Kanban et Liste.</p></header><ul>{unscheduled.map((item) => <li key={item.task.id}>
        <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" /><div className="min-w-0 flex-1"><strong>{item.task.titre}</strong><p>{item.societeName} · {item.assigneeName}</p></div><TaskStatusBadge status={item.columnId} />
        {editable(item) && <Button type="button" variant="outline" size="sm" className="h-9 text-xs" aria-label={`Planifier : ${item.task.titre}`} onClick={() => actions.onEdit(item.task)}>Planifier</Button>}
        <TaskActionsMenu task={item.task} {...actions} isPending={actions.pendingTaskIds.has(item.task.id)} />
      </li>)}</ul></section>}
    </section>
  );
}
