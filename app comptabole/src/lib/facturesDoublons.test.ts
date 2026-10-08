import { describe, expect, it } from "vitest";
import { cleNumero, doublonsFactures, doublonsStock, mouvementsAvecNumero, resumeDoublons } from "./facturesDoublons";

const m = (id: string, venteNumFacture: string, achatNumFacture: string, fournisseur = "SOTACIB") => ({ id, venteNumFacture, achatNumFacture, fournisseur });

describe("numéros de facture en doublon", () => {
  it("compare sans espaces, tirets ni casse", () => {
    expect(cleNumero("2023-001")).toBe("2023001");
    expect(cleNumero(" 2023 001 ")).toBe("2023001");
    expect(cleNumero("ab/12")).toBe("AB12");
  });

  it("repère un numéro de vente utilisé deux fois", () => {
    const d = doublonsStock([m("1", "202300002", "A1"), m("2", "202300003", "A2"), m("3", "2023-00002", "A3")]);
    expect([...d.vente.keys()].sort()).toEqual(["1", "3"]);
    expect(d.vente.get("1")).toEqual(["3"]);
    expect(d.achat.size).toBe(0);
  });

  it("repère un numéro d'achat répété pour le même fournisseur, pas pour deux fournisseurs", () => {
    const d = doublonsStock([
      m("1", "V1", "31000013", "SOTACIB"),
      m("2", "V2", "31000013", "SOTACIB"),
      m("3", "V3", "31000013", "ENFIDHA"),
    ]);
    expect([...d.achat.keys()].sort()).toEqual(["1", "2"]);
  });

  it("ignore les numéros vides", () => {
    const d = doublonsStock([m("1", "", ""), m("2", "", "")]);
    expect(d.vente.size).toBe(0);
    expect(d.achat.size).toBe(0);
    expect(doublonsFactures([{ id: "a", numero: "" }, { id: "b", numero: " " }]).size).toBe(0);
  });

  it("résume chaque numéro une seule fois avec le rang des mouvements", () => {
    const resume = resumeDoublons([m("1", "202300002", "A1"), m("2", "X", "A2"), m("3", "202300002", "A3"), m("4", "202300002", "A4")]);
    expect(resume).toEqual([{ type: "vente", numero: "202300002", rangs: [1, 3, 4] }]);
  });

  it("trouve les mouvements qui utilisent déjà un numéro, en excluant celui qu'on modifie", () => {
    const l = [m("1", "202300002", "A1"), m("2", "202300003", "A1", "ENFIDHA")];
    expect(mouvementsAvecNumero(l, "vente", "2023-00002", "", null).map((x) => x.id)).toEqual(["1"]);
    expect(mouvementsAvecNumero(l, "vente", "202300002", "", "1")).toEqual([]);
    expect(mouvementsAvecNumero(l, "achat", "A1", "SOTACIB", null).map((x) => x.id)).toEqual(["1"]);
    expect(mouvementsAvecNumero(l, "achat", "A1", "", null).map((x) => x.id)).toEqual(["1", "2"]);
    expect(mouvementsAvecNumero(l, "vente", "", "", null)).toEqual([]);
  });
});
