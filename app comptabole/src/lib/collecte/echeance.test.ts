import { describe, expect, it } from "vitest";
import { joursAvantEcheance, libelleEcheance } from "./echeance";

const maintenant = new Date(2026, 9, 22, 15, 30);

describe("échéance d'une collecte", () => {
  it("compte les jours calendaires, sans tenir compte de l'heure", () => {
    expect(joursAvantEcheance("2026-10-27", maintenant)).toBe(5);
    expect(joursAvantEcheance("2026-10-22", maintenant)).toBe(0);
    expect(joursAvantEcheance("2026-10-19", maintenant)).toBe(-3);
    expect(joursAvantEcheance("2026-10-27T10:00:00Z", maintenant)).toBe(5);
  });

  it("écrit l'échéance en clair et signale le retard", () => {
    expect(libelleEcheance("2026-10-27", maintenant)).toEqual({ texte: "dans 5 j", retard: false });
    expect(libelleEcheance("2026-10-22", maintenant)).toEqual({ texte: "Aujourd'hui", retard: false });
    expect(libelleEcheance("2026-10-19", maintenant)).toEqual({ texte: "Retard de 3 j", retard: true });
    expect(libelleEcheance(null, maintenant)).toBeNull();
  });
});
