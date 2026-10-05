import { describe, expect, it } from "vitest";
import { champsByTypeFromClaude, extraireJson } from "./claudeExtract.js";

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
    expect(extraireJson('```json
{"type":"achat"}
```')).toEqual({ type: "achat" });
  });
  it("renvoie null sans JSON exploitable", () => {
    expect(extraireJson("désolé")).toBeNull();
    expect(extraireJson("{ pas du json }")).toBeNull();
  });
});
