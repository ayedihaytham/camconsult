import { describe, expect, it } from "vitest";
import { accepteEffort, champsByTypeFromClaude, coutEstime, corrigerTypeEtTiers, designeLaSociete, extraireJson, motsDistinctifs, nomSociete, typeParEmetteur } from "./claudeExtract.js";

const base = {
  type: "douane",
  confidence: "haute",
  date: "2024-03-12",
  numFacture: null,
  partie: null,
  lignes: null,
  devise: null,
  numDeclaration: "2024123456",
  typeDeclaration: "E",
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
      typeDeclaration: "E",
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

describe("nomSociete", () => {
  it("retire le code de classement qui précède la raison sociale", () => {
    expect(nomSociete("01-RUSPINA")).toBe("RUSPINA");
    expect(nomSociete("05-I CARGO LINE")).toBe("I CARGO LINE");
    expect(nomSociete("12 - ACME SARL")).toBe("ACME SARL");
  });
  it("garde un nom sans code et gère l'absence de nom", () => {
    expect(nomSociete("RUSPINA IMPORT EXPORT")).toBe("RUSPINA IMPORT EXPORT");
    expect(nomSociete("3M Tunisie")).toBe("3M Tunisie");
    expect(nomSociete("")).toBe("(non précisée)");
    expect(nomSociete(undefined)).toBe("(non précisée)");
  });
});

describe("achat ou vente d'après l'émetteur et le client", () => {
  const facture = (patch) => ({ type: "vente", confidence: "moyenne", partie: "RUSPINA IMPORT EXPORT", emetteur: null, client: null, ...patch });

  it("reconnaît le nom de la société malgré code, forme juridique et mots génériques", () => {
    expect(designeLaSociete("RUSPINA IMPORT EXPORT", "01-RUSPINA")).toBe(true);
    expect(designeLaSociete("Ruspina Import et Export SARL", "01-RUSPINA")).toBe(true);
    expect(designeLaSociete("SOTACIB KAIROUAN", "01-RUSPINA")).toBe(false);
    expect(designeLaSociete("ICARGOLINE SARL", "05-I CARGO LINE")).toBe(true);
    expect(designeLaSociete("", "01-RUSPINA")).toBe(false);
    expect(motsDistinctifs("STE DES CIMENTS D'ENFIDHA")).toEqual(["CIMENTS", "D", "ENFIDHA"]);
  });

  it("achat : l'émetteur est un fournisseur et la société est le client", () => {
    const cas = { emetteur: "SOTACIB KAIROUAN", client: "RUSPINA IMPORT EXPORT" };
    expect(typeParEmetteur(cas, "01-RUSPINA")).toBe("achat");
    const r = corrigerTypeEtTiers(facture(cas), "01-RUSPINA");
    expect(r.type).toBe("achat");
    expect(r.partie).toBe("SOTACIB KAIROUAN");
    expect(r.confidence).toBe("haute");
  });

  it("vente : la société est l'émetteur", () => {
    const r = corrigerTypeEtTiers(facture({ type: "achat", partie: "RUSPINA", emetteur: "RUSPINA IMPORT EXPORT", client: "GROUP BYOUT EZZ COMPANY" }), "01-RUSPINA");
    expect(r.type).toBe("vente");
    expect(r.partie).toBe("GROUP BYOUT EZZ COMPANY");
  });

  it("garde l'avis du modèle quand rien ne permet de trancher", () => {
    const sansNoms = facture({});
    expect(corrigerTypeEtTiers(sansNoms, "01-RUSPINA")).toBe(sansNoms);
    const tiers = facture({ emetteur: "ACME", client: "BETA" });
    expect(corrigerTypeEtTiers(tiers, "01-RUSPINA")).toBe(tiers);
  });

  it("ne touche pas une déclaration douanière", () => {
    const douane = facture({ type: "douane", emetteur: "RUSPINA", client: "X" });
    expect(corrigerTypeEtTiers(douane, "01-RUSPINA")).toBe(douane);
  });
});
