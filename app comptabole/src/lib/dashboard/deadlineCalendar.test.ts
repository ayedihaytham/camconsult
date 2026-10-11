import { describe, expect, it } from "vitest";
import { calendarDate, calendarDateKey, deadlineCalendarDays, shiftCalendarMonth } from "./deadlineCalendar";

describe("calendrier des échéances", () => {
  it("garde les dates civiles locales, sans décalage UTC", () => {
    const date = calendarDate("2026-10-11");
    expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([2026, 9, 11]);
    expect(calendarDateKey(date)).toBe("2026-10-11");
  });

  it("affiche tous les jours du mois entre des semaines commençant le lundi", () => {
    const days = deadlineCalendarDays(new Date(2026, 9, 11));
    expect(days).toHaveLength(42);
    expect(days[0].date.getDay()).toBe(1);
    expect(days.at(-1)?.date.getDay()).toBe(0);
    expect(days.filter((day) => day.inMonth)).toHaveLength(31);
    expect(days[0].key).toBe("2026-09-28");
    expect(days.at(-1)?.key).toBe("2026-11-08");
  });

  it("gère les années bissextiles et le changement d'année", () => {
    expect(deadlineCalendarDays(new Date(2028, 1, 1)).filter((day) => day.inMonth)).toHaveLength(29);
    expect(calendarDateKey(shiftCalendarMonth(new Date(2026, 11, 31), 1))).toBe("2027-01-31");
    expect(calendarDateKey(shiftCalendarMonth(new Date(2026, 0, 31), 1))).toBe("2026-02-28");
  });
});
