import { describe, expect, it } from "vitest";
import {
  FINANCE_SCENARIOS,
  balanceTotals,
  buildBalanceLines,
  financeSeedUuid,
} from "./financeSeedData.js";

describe("development finance fixtures", () => {
  it("provides varied company/exercise coverage with 20–40 lines each", () => {
    expect(FINANCE_SCENARIOS).toHaveLength(7);
    expect(new Set(FINANCE_SCENARIOS.map((item) => `${item.code}/${item.exercice}`)).size).toBe(7);
    for (const scenario of FINANCE_SCENARIOS) {
      expect(buildBalanceLines(scenario).length).toBeGreaterThanOrEqual(20);
      expect(buildBalanceLines(scenario).length).toBeLessThanOrEqual(40);
    }
  });

  it("balances ordinary exercises and isolates the deliberate discrepancy", () => {
    for (const scenario of FINANCE_SCENARIOS) {
      const { debit, credit } = balanceTotals(buildBalanceLines(scenario));
      expect(debit - credit).toBe(scenario.code === "DEV-005" ? 750 : 0);
    }
  });

  it("keeps unmapped lines and the override scenario limited to Carthage", () => {
    for (const scenario of FINANCE_SCENARIOS) {
      const lines = buildBalanceLines(scenario);
      expect(lines.filter((line) => line.affectat === "")).toHaveLength(scenario.code === "DEV-003" ? 2 : 0);
      expect(lines.find((line) => line.compte === "629100")?.affectat).toBe(scenario.code === "DEV-003" ? "CH09" : "CH05");
    }
  });

  it("varies real amounts deterministically across exercises", () => {
    const atlas = FINANCE_SCENARIOS.filter((item) => item.code === "DEV-001");
    const sales = atlas.map((scenario) => buildBalanceLines(scenario).find((line) => line.compte === "701000")?.credit);
    expect(sales[0]).toBeLessThan(sales[1]);
    expect(sales[1]).toBeLessThan(sales[2]);
    expect(buildBalanceLines(atlas[1])).toEqual(buildBalanceLines(atlas[1]));
    expect(financeSeedUuid("a1000000", 1)).toBe("a1000000-0000-4000-8000-000000000001");
  });
});
