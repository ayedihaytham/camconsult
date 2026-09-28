import { describe, expect, it } from "vitest";
import { FINANCIAL_VIEW_GROUPS, financialViewLabel } from "./FinancialViewNavigation";

describe("Financial Ledger view navigation", () => {
  it("keeps all twelve existing views grouped and discoverable", () => {
    const views = FINANCIAL_VIEW_GROUPS.flatMap((group) => group.views);
    expect(views).toHaveLength(12);
    expect(new Set(views.map((view) => view.value)).size).toBe(12);
    expect(views.map((view) => view.value)).toContain("exercices");
    expect(views.map((view) => view.value)).toContain("controle");
  });

  it("keeps the active view label available for the mobile selector trigger", () => {
    expect(financialViewLabel("synthese")).toBe("Synthèse AFFECTAT");
    expect(financialViewLabel("exercices")).toBe("Exercices");
  });
});
