import { describe, it, expect } from "vitest";
import { parseTnd, formatTnd, calculateVat, totals } from "./amounts.js";
import { invoiceSchema, checkVersion } from "./domain.js";
import { isCabinet, isManager, scope } from "./permissions.js";
describe("Apurement exact arithmetic and guards", () => {
  it("round-trips bigint amounts without Number loss", () => {
    for (const v of [
      "0",
      "1",
      "999",
      "1444800",
      "9007199254740993",
      "9223372036854775807",
    ])
      expect(parseTnd(formatTnd(v))).toBe(v);
    expect(calculateVat("1444800", 1900)).toBe("274512");
    expect(calculateVat("5", 1000)).toBe("1");
  });
  it("rejects ambiguous precision, signs, overflow and numeric JSON money", () => {
    for (const v of [
      "1.0001",
      "1,000.00",
      "-1",
      "1e3",
      100,
      "9223372036854776",
    ])
      expect(() => parseTnd(v)).toThrow();
  });
  it("shows detail and aggregate discrepancy", () => {
    expect(
      totals([
        {
          montant_ht_millimes: "1000",
          taux_tva_bps: 1900,
          tva_suspendue_millimes: "203",
        },
      ]).ecart,
    ).toBe("13");
  });
  it("never authorizes company-side staff, limits collaborators and approval", () => {
    expect(isCabinet({ role: "employe", poste: "societe_employe" })).toBe(
      false,
    );
    expect(isCabinet({ role: "employe", poste: "collaborateur" })).toBe(true);
    expect(isManager({ poste: "collaborateur" })).toBe(false);
    expect(() =>
      scope({ poste: "collaborateur", societeIds: ["a"] }, "b"),
    ).toThrow();
    expect(() => checkVersion({ version: 2 }, 1)).toThrow();
  });
  it("rejects incomplete dates promoted to complete, credit money and unjustified VAT", () => {
    const valid = {
      societeId: "00000000-0000-4000-8000-000000000001",
      fournisseurId: "00000000-0000-4000-8000-000000000002",
      numeroFacture: "0001",
      dateFacture: "2026-02-28",
      datePrecision: "day",
      montantHtMillimes: "1000",
      tauxTvaBps: 1900,
      annee: 2026,
      trimestre: "T1",
    };
    expect(invoiceSchema.safeParse(valid).success).toBe(true);
    for (const patch of [
      { dateFacture: "2026-02-30" },
      { datePrecision: "month", dateBrute: "02/2026" },
      { montantHtMillimes: "-1000" },
      { tvaMode: "manuel", tvaSuspendueMillimes: "191" },
      { bcId: ["00000000-0000-4000-8000-000000000003"] },
    ])
      expect(invoiceSchema.safeParse({ ...valid, ...patch }).success).toBe(
        false,
      );
  });
});
