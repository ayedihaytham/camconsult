import { describe, expect, it } from "vitest";
import { COLLECTE_TABS } from "./tabs";
import { editableRowColumns, parseRowDraft } from "./rowDraft";

describe("Collecte requested-table row fields", () => {
  it("uses real editable columns for every requested table", () => {
    expect(COLLECTE_TABS).toHaveLength(10);
    for (const def of COLLECTE_TABS) {
      const columns = editableRowColumns(def, 1);
      expect(columns.length).toBeGreaterThan(0);
      expect(columns.every((column) => def.columns.includes(column) && !column.computed)).toBe(true);
      expect(parseRowDraft(def, 1, {}).row).toBeNull();
      const first = columns[0];
      const value = first.type === "number" ? "125.5" : "Sample";
      expect(parseRowDraft(def, 1, { [first.key]: value }).row).toEqual(
        expect.objectContaining({ [first.key]: first.type === "number" ? 125.5 : value }),
      );
    }
  });

  it("allows only the opening balance in the first cash row", () => {
    const def = COLLECTE_TABS.find((tab) => tab.key === "etat_caisse")!;
    expect(editableRowColumns(def, 0).map((column) => column.key)).toEqual(["solde"]);
    expect(editableRowColumns(def, 1).some((column) => column.key === "solde")).toBe(false);
    expect(parseRowDraft(def, 0, {}).errors.solde).toBeTruthy();
  });
});
