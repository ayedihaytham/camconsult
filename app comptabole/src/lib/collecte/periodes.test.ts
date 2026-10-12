import { describe, expect, it } from "vitest";
import { COLLECTE_TABS } from "@/lib/collecte/tabs";
import { periodeMois, periodesSuggerees, resumeTableaux } from "./periodes";

describe("périodes de collecte", () => {
  it("écrit un mois comme on le lit dans le registre", () => {
    expect(periodeMois(new Date(2026, 9, 11))).toBe("Octobre 2026");
  });

  it("propose le mois courant, le précédent, le trimestre et le dernier exercice", () => {
    expect(periodesSuggerees(new Date(2026, 9, 11))).toEqual(["Octobre 2026", "Septembre 2026", "T4 2026", "Exercice 2025"]);
    expect(periodesSuggerees(new Date(2026, 0, 5))).toEqual(["Janvier 2026", "Décembre 2025", "T1 2026", "Exercice 2025"]);
  });

  it("résume les tableaux demandés", () => {
    expect(resumeTableaux([])).toEqual([]);
    expect(resumeTableaux(["virements_recus", "virements_emis"])).toEqual(["Virements reçus", "Virements émis"]);
    expect(resumeTableaux(COLLECTE_TABS.map((tab) => tab.key))).toEqual(["Comptabilité complète"]);
    const cinq = COLLECTE_TABS.slice(0, 7).map((tab) => tab.key);
    const resume = resumeTableaux(cinq);
    expect(resume).toHaveLength(5);
    expect(resume[4]).toBe("+3");
  });
});
