import { describe, expect, it } from "vitest";
import { isPlanningDate, taskPlanningError } from "./taskPlanning.js";

describe("dates prévues des tâches", () => {
  it("laisse les tâches existantes non planifiées et accepte un intervalle inclusif", () => {
    expect(taskPlanningError(null, null)).toBeNull();
    expect(taskPlanningError(undefined, undefined)).toBeNull();
    expect(taskPlanningError("", "")).toBeNull();
    expect(taskPlanningError("2026-10-11", "2026-10-11")).toBeNull();
  });
  it("refuse les dates impossibles, timestamps et périodes inversées ou incomplètes", () => {
    expect(isPlanningDate("2026-02-29")).toBe(false);
    expect(isPlanningDate("2028-02-29")).toBe(true);
    expect(isPlanningDate("2026-10-11T00:00:00Z")).toBe(false);
    expect(isPlanningDate("0000-01-01")).toBe(false);
    expect(taskPlanningError("2026-10-11", null)).not.toBeNull();
    expect(taskPlanningError("2026-10-12", "2026-10-11")).not.toBeNull();
  });
});
