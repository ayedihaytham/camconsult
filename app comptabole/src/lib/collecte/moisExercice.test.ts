import { describe, expect, it } from "vitest";
import type { Collecte } from "@/types";
import { cleMois, moisDeCollecte, resumeMois, syntheseParMois } from "./moisExercice";

const c = (patch: Partial<Collecte>) => ({ periode: "", statut: "brouillon", echeance: null, creeLe: "2026-03-05T08:00:00Z", ...patch }) as Collecte;

describe("moisDeCollecte", () => {
  it("lit le mois dans la période, avec ou sans accent", () => {
    expect(moisDeCollecte(c({ periode: "Octobre 2026" }))).toEqual({ annee: 2026, mois: 9 });
    expect(moisDeCollecte(c({ periode: "Février 2026" }))).toEqual({ annee: 2026, mois: 1 });
    expect(moisDeCollecte(c({ periode: "2026-09" }))).toEqual({ annee: 2026, mois: 8 });
  });
  it("retombe sur la date de création quand la période n'est pas un mois", () => {
    expect(moisDeCollecte(c({ periode: "T3 2026" }))?.mois).toBe(2);
  });
});

describe("syntheseParMois", () => {
  const maintenant = new Date("2026-11-13T10:00:00");
  it("classe chaque mois : retard, en cours, validées ; ignore archives et autres années", () => {
    const s = syntheseParMois([
      c({ periode: "Septembre 2026", echeance: "2026-10-01" }),
      c({ periode: "Octobre 2026", statut: "transmis", echeance: "2026-12-01" }),
      c({ periode: "Août 2026", statut: "valide" }),
      c({ periode: "Juillet 2026", statut: "archive" }),
      c({ periode: "Mars 2025", statut: "valide" }),
    ], 2026, maintenant);
    expect(s[8].etat).toBe("retard");
    expect(s[9].etat).toBe("en_cours");
    expect(s[7].etat).toBe("validees");
    expect(s[6].etat).toBe("vide");
    expect(s[2].etat).toBe("vide");
  });
  it("décrit un mois et construit la clé de filtre", () => {
    expect(resumeMois({ etat: "retard", validees: 1, enCours: 0, enRetard: 2 })).toBe("2 en retard · 1 validée");
    expect(cleMois(2026, 9)).toBe("2026-10");
  });
});
