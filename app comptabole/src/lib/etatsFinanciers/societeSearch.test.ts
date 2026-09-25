import { describe, expect, it } from "vitest";
import { filterFinancialSocietes, searchFinancialSocietes } from "./societeSearch";
import type { Societe } from "@/types";

const rows = [
  { raisonSociale: "Cabinet Étoile", code: "CC-014", rne: "B123456", theme: "PME", statut: "actif" },
  { raisonSociale: "Atlas Conseil", code: "CC-021", rne: "A987654", theme: "Association", statut: "en_attente" },
] as Societe[];

describe("searchFinancialSocietes", () => {
  it("matches raison sociale accent-insensitively", () => {
    expect(searchFinancialSocietes(rows, "etoile")).toEqual([rows[0]]);
  });

  it("matches code and RNE", () => {
    expect(searchFinancialSocietes(rows, "cc-021")).toEqual([rows[1]]);
    expect(searchFinancialSocietes(rows, "B123")).toEqual([rows[0]]);
  });

  it("matches structure and readable status labels case-insensitively", () => {
    expect(searchFinancialSocietes(rows, "  association  ")).toEqual([rows[1]]);
    expect(searchFinancialSocietes(rows, "EN ATTENTE")).toEqual([rows[1]]);
  });

  it("returns the authorized input unchanged for an empty query", () => {
    expect(searchFinancialSocietes(rows, "  ")).toBe(rows);
  });
});

describe("filterFinancialSocietes", () => {
  it("applies search before status and structure filters", () => {
    expect(filterFinancialSocietes(rows, {
      query: "  atlas ",
      statut: "en_attente",
      theme: "Association",
    })).toEqual([rows[1]]);
  });

  it("returns no rows when search and filters do not match the same société", () => {
    expect(filterFinancialSocietes(rows, {
      query: "atlas",
      statut: "actif",
      theme: "all",
    })).toEqual([]);
  });
});
