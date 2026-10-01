import { describe, expect, it, vi } from "vitest";
import { renameAffectatCode } from "./affectatCodeRename.js";

describe("cabinet AFFECTAT code rename", () => {
  it("moves balance, global and société-specific references before removing the old code", async () => {
    const query = vi.fn(async (sql) =>
      sql.startsWith("select")
        ? { rows: [{ code: "OLD", libelle: "Ancien", poste: "bilan.actif" }] }
        : { rows: [] },
    );

    await renameAffectatCode({ query }, "OLD", "NEW");

    const statements = query.mock.calls.map(([sql]) => sql);
    expect(statements).toHaveLength(6);
    expect(statements[1]).toContain("update balance_lignes");
    expect(statements[2]).toContain("update grille_comptes set");
    expect(statements[3]).toContain("update grille_comptes_societe set");
    expect(query.mock.calls[3][1]).toEqual(["OLD", "NEW"]);
    expect(statements[4]).toContain("on conflict (code) do nothing");
    expect(query.mock.calls[4][1]).toEqual(["NEW", "Ancien", "bilan.actif"]);
    expect(statements[5]).toContain("delete from grille_affectat_codes");
  });

  it("does not remove the old code when an override update fails in the transaction", async () => {
    const query = vi.fn(async (sql) => {
      if (sql.startsWith("select")) return { rows: [{ libelle: "Ancien", poste: "" }] };
      if (sql.startsWith("update grille_comptes_societe")) throw new Error("database failure");
      return { rows: [] };
    });

    await expect(renameAffectatCode({ query }, "OLD", "NEW")).rejects.toThrow("database failure");
    expect(query.mock.calls.some(([sql]) => sql.startsWith("delete from grille_affectat_codes"))).toBe(false);
  });
});
