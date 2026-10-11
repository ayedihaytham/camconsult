import { calendarDate, calendarDateKey } from "./dashboard/deadlineCalendar";
import { isPlanningDate } from "../../shared/taskPlanning.js";
import type { Tache } from "@/types";

export type GanttScale = "week" | "month";

export function taskHasPlan(task: Tache): task is Tache & { debutPrevu: string; finPrevue: string } {
  return isPlanningDate(task.debutPrevu) && isPlanningDate(task.finPrevue) && task.finPrevue! >= task.debutPrevu!;
}

export function ganttPeriod(cursor: string, scale: GanttScale) {
  const date = calendarDate(cursor);
  const start = scale === "month" ? new Date(date.getFullYear(), date.getMonth(), 1) : new Date(date.getFullYear(), date.getMonth(), date.getDate() - ((date.getDay() + 6) % 7));
  const count = scale === "month" ? new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate() : 7;
  const days = Array.from({ length: count }, (_, i) => {
    const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    return { key: calendarDateKey(day), date: day, weekend: day.getDay() === 0 || day.getDay() === 6 };
  });
  return { start: calendarDateKey(start), end: days[days.length - 1].key, days };
}

export function moveGanttPeriod(start: string, scale: GanttScale, amount: number) {
  const date = calendarDate(start);
  return calendarDateKey(scale === "month" ? new Date(date.getFullYear(), date.getMonth() + amount, 1) : new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount * 7));
}

/** Indices calendaires UTC pour compter les jours civils sans effet de l'heure d'été. */
function dayIndex(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getTime() / 86_400_000;
}

export function ganttBarPosition(task: Tache, start: string, dayCount: number) {
  if (!taskHasPlan(task)) return null;
  const first = dayIndex(task.debutPrevu) - dayIndex(start);
  const last = dayIndex(task.finPrevue) - dayIndex(start);
  if (last < 0 || first >= dayCount) return null;
  return { startColumn: Math.max(0, first) + 1, endColumn: Math.min(dayCount - 1, last) + 2, continuesBefore: first < 0, continuesAfter: last >= dayCount };
}
