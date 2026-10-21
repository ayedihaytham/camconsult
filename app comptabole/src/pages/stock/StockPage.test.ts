import { describe, expect, it } from "vitest";
import { etatCours, ilYA, listerSocietes } from "./StockPage";

describe("état des cours de change d'une société, à l'accueil du stock", () => {
  it("ne dit rien d'une société sans mouvement en devise", () => {
    expect(etatCours(undefined)).toEqual({ label: "—", tone: "none" });
    expect(etatCours({ enDevise: 0, coursManquants: 0 })).toEqual({ label: "—", tone: "none" });
  });

  it("signale les cours à saisir, sinon « Saisi »", () => {
    expect(etatCours({ enDevise: 3, coursManquants: 2 })).toEqual({ label: "2 à saisir", tone: "warn" });
    expect(etatCours({ enDevise: 3, coursManquants: 0 })).toEqual({ label: "Saisi", tone: "ok" });
  });
});

describe("liste des sociétés : recherche, filtre et tri", () => {
  const soc = (id: string, raisonSociale: string, rne = "") => ({ id, raisonSociale, theme: "PME" as const, rne });
  const societes = [soc("a", "05-I CARGO LINE", "1778030H"), soc("b", "CAM", "1464720L"), soc("c", "12-PETRA", "1898113C")];
  const base = { enDevise: 0, coursManquants: 0, alertes: 0 };
  const synthese = {
    a: { ...base, mouvements: 0, dernierLe: null, valeur: 0 },
    b: { ...base, mouvements: 2, dernierLe: "2026-10-21T08:00:00Z", valeur: 5000, enDevise: 2 },
    c: { ...base, mouvements: 5, dernierLe: "2026-09-01T08:00:00Z", valeur: 1200, enDevise: 1, coursManquants: 1 },
  };
  const noms = (l: { raisonSociale: string }[]) => l.map((x) => x.raisonSociale);
  const defaut = { recherche: "", filtre: "toutes" as const, tri: "societe" as const, sens: 1 as const };

  it("trie par société dans l'ordre des numéros, puis en sens inverse", () => {
    expect(noms(listerSocietes(societes, synthese, defaut))).toEqual(["05-I CARGO LINE", "12-PETRA", "CAM"]);
    expect(noms(listerSocietes(societes, synthese, { ...defaut, sens: -1 }))).toEqual(["CAM", "12-PETRA", "05-I CARGO LINE"]);
  });

  it("filtre les sociétés avec ou sans mouvement", () => {
    expect(noms(listerSocietes(societes, synthese, { ...defaut, filtre: "avec" }))).toEqual(["12-PETRA", "CAM"]);
    expect(noms(listerSocietes(societes, synthese, { ...defaut, filtre: "sans" }))).toEqual(["05-I CARGO LINE"]);
  });

  it("recherche dans le nom, le thème et le matricule, sans tenir compte de la casse", () => {
    expect(noms(listerSocietes(societes, synthese, { ...defaut, recherche: "cam" }))).toEqual(["CAM"]);
    expect(noms(listerSocietes(societes, synthese, { ...defaut, recherche: "1898113c" }))).toEqual(["12-PETRA"]);
    expect(noms(listerSocietes(societes, synthese, { ...defaut, recherche: "zzz" }))).toEqual([]);
  });

  it("trie par mouvements, valeur, dernier mouvement et état des cours", () => {
    expect(noms(listerSocietes(societes, synthese, { ...defaut, tri: "mouvements", sens: -1 }))).toEqual(["12-PETRA", "CAM", "05-I CARGO LINE"]);
    expect(noms(listerSocietes(societes, synthese, { ...defaut, tri: "valeur", sens: -1 }))[0]).toBe("CAM");
    expect(noms(listerSocietes(societes, synthese, { ...defaut, tri: "dernier", sens: -1 }))[0]).toBe("CAM");
    // cours : sans devise, puis saisi, puis à saisir
    expect(noms(listerSocietes(societes, synthese, { ...defaut, tri: "cours" }))).toEqual(["05-I CARGO LINE", "CAM", "12-PETRA"]);
  });

  it("une société absente de la synthèse compte comme sans mouvement", () => {
    expect(noms(listerSocietes(societes, {}, { ...defaut, filtre: "sans" }))).toHaveLength(3);
  });
});

describe("ancienneté du dernier mouvement", () => {
  const maintenant = new Date(2026, 9, 21, 15, 0, 0);
  it("dit aujourd'hui, hier, puis des jours, des mois, des ans", () => {
    expect(ilYA(new Date(2026, 9, 21, 8).toISOString(), maintenant)).toBe("aujourd'hui");
    expect(ilYA(new Date(2026, 9, 20, 8).toISOString(), maintenant)).toBe("hier");
    expect(ilYA(new Date(2026, 9, 16, 8).toISOString(), maintenant)).toBe("il y a 5 jours");
    expect(ilYA(new Date(2026, 6, 21, 8).toISOString(), maintenant)).toBe("il y a 3 mois");
    expect(ilYA(new Date(2024, 9, 21, 8).toISOString(), maintenant)).toBe("il y a 2 ans");
  });
});
