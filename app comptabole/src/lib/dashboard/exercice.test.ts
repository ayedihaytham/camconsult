import { describe, expect, it } from "vitest";
import { dureeAvantCloture, exerciceDuJour } from "./exercice";

describe("exercice du jour", () => {
  it("compte les jours avant la clôture du 31 décembre", () => {
    expect(exerciceDuJour(new Date(2026, 10, 19)).joursRestants).toBe(42);
    expect(exerciceDuJour(new Date(2026, 11, 31)).joursRestants).toBe(0);
  });
  it("donne la part écoulée de l'exercice", () => {
    expect(exerciceDuJour(new Date(2026, 0, 1)).pourcent).toBe(0);
    expect(exerciceDuJour(new Date(2026, 11, 31)).pourcent).toBe(100);
    expect(exerciceDuJour(new Date(2026, 6, 2)).pourcent).toBeGreaterThan(49);
  });
  it("écrit la durée en toutes lettres", () => {
    expect(dureeAvantCloture(42)).toBe("dans 42 jours");
    expect(dureeAvantCloture(1)).toBe("demain");
    expect(dureeAvantCloture(0)).toBe("aujourd'hui");
  });
});
