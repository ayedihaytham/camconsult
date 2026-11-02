import { describe, expect, it } from "vitest";
import { effectifs, fichesAffichees, ficheChoisie, partSoldee, soldeDuParDevise } from "./suiviDeviseListe";
import type { SuiviDeviseResume } from "@/store/suiviDevise";

const fiche = (id: string, client: string, patch: Partial<SuiviDeviseResume> = {}): SuiviDeviseResume => ({
  id, societeId: "s", client, exercice: "2026", devise: "EUR", note: "", soldeOuverture: 0, creeLe: "", majLe: "", totalVentes: 1000, solde: 1000, ...patch,
});

const liste = [
  fiche("a", "GROUP BYOUT EZZ COMPANY", { exercice: "2023", totalVentes: 40700, solde: 40700 }),
  fiche("b", "SOUMOUD AL ABRAJ COMPANY", { exercice: "2023", totalVentes: 46000, solde: 46000 }),
  fiche("c", "RUSPINA IMPORT/EXPORT", { totalVentes: 81466, solde: 21466, stockAReprendre: 1 }),
  fiche("d", "AL KHALIJ GROUP", { totalVentes: 26920, solde: 0 }),
  fiche("e", "ACME USD", { devise: "USD", totalVentes: 500, solde: 500 }),
];

describe("registre des fiches du suivi client devise", () => {
  it("les chiffres du haut : fiches, avec solde dû, soldées, à reprendre du stock", () => {
    expect(effectifs(liste)).toEqual({ toutes: 5, du: 4, soldees: 1, stock: 1 });
  });

  it("le filtre puis la recherche (client, exercice ou devise, sans casse)", () => {
    expect(fichesAffichees(liste, "du", "").map((f) => f.id)).toEqual(["a", "b", "c", "e"]);
    expect(fichesAffichees(liste, "soldees", "").map((f) => f.id)).toEqual(["d"]);
    expect(fichesAffichees(liste, "stock", "").map((f) => f.id)).toEqual(["c"]);
    expect(fichesAffichees(liste, "toutes", "2023").map((f) => f.id)).toEqual(["a", "b"]);
    expect(fichesAffichees(liste, "toutes", "usd").map((f) => f.id)).toEqual(["e"]);
    expect(fichesAffichees(liste, "du", "khalij")).toEqual([]);
    expect(fichesAffichees(liste, "toutes", "  ruspina ").map((f) => f.id)).toEqual(["c"]);
  });

  it("la fiche choisie reste celle de l'utilisateur tant qu'elle est affichée ; sinon la première avec un solde dû, sinon la première", () => {
    expect(ficheChoisie(liste, "c")).toBe("c");
    expect(ficheChoisie(fichesAffichees(liste, "du", ""), "d")).toBe("a");
    expect(ficheChoisie(fichesAffichees(liste, "soldees", ""), null)).toBe("d");
    expect(ficheChoisie([], "a")).toBeNull();
    expect(ficheChoisie([liste[3], liste[0]], null)).toBe("a");
  });

  it("la part soldée : tout ce qui est déduit du total des ventes, bornée à 0–100 ; rien sans vente", () => {
    expect(partSoldee({ totalVentes: 81466, solde: 21466 })).toBe(74);
    expect(partSoldee({ totalVentes: 1000, solde: 1000 })).toBe(0);
    expect(partSoldee({ totalVentes: 1000, solde: 0 })).toBe(100);
    expect(partSoldee({ totalVentes: 1000, solde: -50 })).toBe(100);
    expect(partSoldee({ totalVentes: 1000, solde: 1500 })).toBe(0);
    expect(partSoldee({ totalVentes: 0, solde: 0 })).toBeNull();
  });

  it("le solde dû total est donné par devise (elles ne s'additionnent pas), la plus importante d'abord", () => {
    expect(soldeDuParDevise(liste)).toEqual([{ devise: "EUR", montant: 108166 }, { devise: "USD", montant: 500 }]);
    expect(soldeDuParDevise([liste[3]])).toEqual([]);
  });
});
