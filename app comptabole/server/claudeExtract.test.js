import { describe, expect, it } from "vitest";
import { accepteEffort, champsByTypeFromClaude, coutEstime, extraireJson } from "./claudeExtract.js";

const base = {
  type: "douane",
  confidence: "haute",
  date: "2024-03-12",
  numFacture: null,
  partie: null,
  lignes: null,
  devise: null,
  numDeclaration: "2024123456",
  regime: "Mise à la consommation",
  tauxChange: 3.3412,
  valeurTnd: 125000.5,
  ptfn: 4200,
  exportateur: "ACME GmbH",
  importateur: "RUSPINA SARL",
};

describe("champsByTypeFromClaude", () => {
  it("renseigne les champs de la déclaration douanière", () => {
    expect(champsByTypeFromClaude(base).douane).toEqual({
      numDeclaration: "2024123456",
      date: "2024-03-12",
      regime: "Mise à la consommation",
      reference: "",
      tauxChange: 3.3412,
      valeurTnd: 125000.5,
      ptfn: 4200,
      exportateur: "ACME GmbH",
      importateur: "RUSPINA SARL",
    });
  });

  it("met des valeurs neutres quand la douane n'est pas lue", () => {
    const { douane } = champsByTypeFromClaude({
      ...base,
      tauxChange: null,
      valeurTnd: null,
      ptfn: null,
      exportateur: null,
      importateur: null,
    });
    expect(douane).toMatchObject({ tauxChange: 0, valeurTnd: 0, ptfn: 0, exportateur: "", importateur: "" });
  });

  it("alimente fournisseur et client avec la même partie", () => {
    const out = champsByTypeFromClaude({ ...base, type: "achat", partie: "ACME", lignes: [] });
    expect(out.achat.fournisseur).toBe("ACME");
    expect(out.vente.client).toBe("ACME");
  });
});

describe("extraireJson", () => {
  it("lit un JSON entouré de balises markdown", () => {
    const reponse = ["```json", '{"type":"achat"}', "```"].join(" ");
    expect(extraireJson(reponse)).toEqual({ type: "achat" });
  });
  it("renvoie null sans JSON exploitable", () => {
    expect(extraireJson("désolé")).toBeNull();
    expect(extraireJson("{ pas du json }")).toBeNull();
  });
});

describe("coutEstime", () => {
  it("calcule le coût selon le modèle", () => {
    expect(coutEstime("claude-sonnet-5-5", 1_000_000, 100_000)).toBe("$3.0000");
    expect(coutEstime("claude-haiku-4-5-20251001", 1_000_000, 0)).toBe("$1.0000");
  });
  it("signale un modèle sans tarif connu", () => {
    expect(coutEstime("autre-modele", 1000, 1000)).toBe("coût inconnu");
  });
});

describe("accepteEffort", () => {
  it("n'envoie pas effort à Haiku", () => {
    expect(accepteEffort("claude-haiku-4-5-20251001")).toBe(false);
    expect(accepteEffort("claude-sonnet-5-5")).toBe(true);
  });
});
