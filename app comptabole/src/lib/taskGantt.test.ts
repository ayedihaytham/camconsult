import { describe, expect, it } from "vitest";
import { ganttBarPosition, ganttPeriod, moveGanttPeriod, taskHasPlan } from "./taskGantt";
import { task } from "./dashboard/dashboardFixtures.test-support";

describe("périodes Gantt", () => {
  it("ne déduit jamais une planification des dates d'activité", () => {
    expect(taskHasPlan(task("legacy"))).toBe(false);
    expect(ganttBarPosition(task("legacy"), "2026-10-01", 31)).toBeNull();
  });
  it("trace les jours inclusifs et coupe seulement la partie hors de la période", () => {
    const scheduled = { ...task("planned"), debutPrevu: "2026-09-28", finPrevue: "2026-10-03" };
    expect(ganttBarPosition(scheduled, "2026-10-01", 31)).toEqual({ startColumn: 1, endColumn: 4, continuesBefore: true, continuesAfter: false });
    expect(ganttBarPosition({ ...scheduled, debutPrevu: "2026-10-11", finPrevue: "2026-10-11" }, "2026-10-01", 31)).toMatchObject({ startColumn: 11, endColumn: 12 });
    expect(ganttBarPosition(scheduled, "2026-11-01", 30)).toBeNull();
  });
  it("navigue entre mois et semaines civiles, y compris les années bissextiles", () => {
    expect(ganttPeriod("2028-02-20", "month").days).toHaveLength(29);
    expect(ganttPeriod("2026-10-11", "week")).toMatchObject({ start: "2026-10-05", end: "2026-10-11" });
    expect(moveGanttPeriod("2026-12-01", "month", 1)).toBe("2027-01-01");
  });
});
