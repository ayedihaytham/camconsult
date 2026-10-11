import { describe, expect, it } from "vitest";
import type { CoursChange } from "@/types";
import { nombreCoursManquants } from "./StockPage";

const devises = [{ code: "EUR" }, { code: "USD" }];
const cours = [{ devise: "EUR", annee: 2026, mois: 10, cours: 3.4 }, { devise: "USD", annee: 2026, mois: 9, cours: 3.1 }] as unknown as CoursChange[];

describe("cours de change du mois, à l'accueil du stock", () => {
  it("compte les devises dont le cours du mois courant n'est pas saisi", () => {
    expect(nombreCoursManquants(devises, cours, new Date(2026, 9, 11))).toBe(1);
    expect(nombreCoursManquants(devises, cours, new Date(2026, 8, 3))).toBe(1);
    expect(nombreCoursManquants(devises, cours, new Date(2026, 10, 1))).toBe(2);
    expect(nombreCoursManquants([], cours, new Date(2026, 9, 11))).toBe(0);
  });
});
