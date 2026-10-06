import { describe, expect, it } from "vitest";
import { z } from "zod/v4";
import { accepteEffort, champsByTypeFromClaude, ExtractionSchema, avecMesure, corrigerQuantiteLigne, uniteNormalisee, completerReponse, enregistrerMesure, coutNombre, coutEstime, corrigerTypeEtTiers, designeLaSociete, extraireJson, motsDistinctifs, nomSociete, typeParEmetteur } from "./claudeExtract.js";

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

describe("schéma de sortie", () => {
  it("complète une réponse partielle avec des valeurs vides, sans null", () => {
    const r = completerReponse({ type: "achat", confidence: "haute", date: null, lignes: [{ designation: "CEM", quantite: 5 }] });
    expect(r.date).toBe("");
    expect(r.emetteur).toBe("");
    expect(r.tauxChange).toBe(0);
    expect(r.lignes).toEqual([{ designation: "CEM", quantite: 5, prixUnitaire: 0, montantDevise: 0, unite: "" }]);
    expect(Object.values(r).includes(null)).toBe(false);
  });

  it("ne plante pas sur une réponse absente", () => {
    expect(completerReponse(null)).toBeNull();
  });
});

describe("limite de l'API sur le schéma de sortie", () => {
  it("n'utilise aucun type union (l'API en refuse plus de 16 : erreur 400 sinon)", () => {
    const json = JSON.stringify(z.toJSONSchema(ExtractionSchema));
    expect(json).not.toContain("anyOf");
    expect(json).not.toContain('"null"');
  });
});

describe("mesure d'un import", () => {
  it("donne le coût en nombre, ou null sans tarif connu", () => {
    expect(coutNombre("claude-haiku-4-5-20251001", 1_000_000, 0)).toBe(1);
    expect(coutNombre("autre-modele", 10, 10)).toBeNull();
  });

  it("renvoie la valeur de la fonction et une mesure vide quand rien n'est appelé", async () => {
    const { valeur, mesure } = await avecMesure(async () => 42);
    expect(valeur).toBe(42);
    expect(mesure).toEqual({ appels: 0, entree: 0, sortie: 0, cout: 0, coutInconnu: false });
  });
});

describe("addition des appels d'un import", () => {
  it("additionne des appels lancés en parallèle, sans mélanger deux imports", async () => {
    const lire = async (entree, ms) => {
      await new Promise((r) => setTimeout(r, ms));
      enregistrerMesure("claude-haiku-4-5-20251001", entree, 100);
    };
    const [a, b] = await Promise.all([
      avecMesure(() => Promise.all([lire(1000, 5), lire(2000, 1), lire(3000, 3)])),
      avecMesure(() => lire(500, 2)),
    ]);
    expect(a.mesure.appels).toBe(3);
    expect(a.mesure.entree).toBe(6000);
    expect(a.mesure.sortie).toBe(300);
    expect(a.mesure.cout).toBeCloseTo((6000 * 1 + 300 * 5) / 1e6, 8);
    expect(b.mesure.appels).toBe(1);
    expect(b.mesure.entree).toBe(500);
  });

  it("ignore les appels faits hors d'un import", () => {
    expect(() => enregistrerMesure("claude-haiku-4-5-20251001", 10, 10)).not.toThrow();
  });
});

describe("quantité vérifiée par quantité x prix = montant", () => {
  const ligne = (quantite, prixUnitaire, montantDevise) => ({ designation: "CIMENT", quantite, prixUnitaire, montantDevise, unite: "T" });

  it("laisse une ligne cohérente", () => {
    expect(corrigerQuantiteLigne(ligne(370, 110, 40700)).quantite).toBe(370);
    expect(corrigerQuantiteLigne(ligne(1000, 44, 44000)).quantite).toBe(1000);
  });

  it("corrige « 370.000 » lu 370000 (facteur 1000 en trop)", () => {
    expect(corrigerQuantiteLigne(ligne(370000, 110, 40700)).quantite).toBe(370);
  });

  it("corrige « 1.000 » lu 1 (facteur 1000 manquant)", () => {
    expect(corrigerQuantiteLigne(ligne(1, 44, 44000)).quantite).toBe(1000);
  });

  it("ne devine rien sans prix ou sans montant, ni quand aucun facteur ne convient", () => {
    expect(corrigerQuantiteLigne(ligne(370000, 0, 40700)).quantite).toBe(370000);
    expect(corrigerQuantiteLigne(ligne(5, 110, 40700)).quantite).toBe(5);
  });
});

describe("unité de la quantité", () => {
  it("normalise tonnes et kilos", () => {
    for (const t of ["T", "To", "MT", "tonnes", "Tonne", "Ton."]) expect(uniteNormalisee(t)).toBe("T");
    for (const k of ["KG", "kgs", "Kilos", "kilogramme"]) expect(uniteNormalisee(k)).toBe("KG");
    for (const autre of ["", "sacs", null, undefined, "pcs"]) expect(uniteNormalisee(autre)).toBe("");
  });

  it("transmet l'unité et corrige la quantité dans les champs de la facture", () => {
    const out = {
      type: "vente", date: "", numFacture: "", partie: "", devise: "EUR",
      lignes: [{ designation: "CEMENT", quantite: 370000, prixUnitaire: 110, montantDevise: 40700, unite: "To" }],
    };
    const [l] = champsByTypeFromClaude(out).vente.lignes;
    expect(l.quantite).toBe(370);
    expect(l.unite).toBe("T");
  });
});
