import { describe, expect, it } from "vitest";
import { apiOuverte, cheminOuvert, lireModulesActifs, MODULES_PRODUCTION, moduleDeApi, moduleDuChemin } from "./modules.js";

describe("modules par environnement", () => {
  it("variable vide, absente ou « * » : tous les modules sont ouverts", () => {
    for (const v of [undefined, "", "  ", "*"]) expect(lireModulesActifs(v)).toBeNull();
    expect(cheminOuvert(null, "/facturation")).toBe(true);
    expect(apiOuverte(null, "/api/facturation")).toBe(true);
  });

  it("reconnaît le module d'une route et celui d'une adresse de l'API", () => {
    expect(moduleDuChemin("/")).toBe("tableau-de-bord");
    expect(moduleDuChemin("/stock/abc")).toBe("stock");
    expect(moduleDuChemin("/ma-souche")).toBe("souche-cheques");
    expect(moduleDuChemin("/login")).toBeNull();
    expect(moduleDeApi("/api/stock/mouvements")?.cle).toBe("stock");
    expect(moduleDeApi("/api/auth/login")).toBeNull();
  });

  it("production : seuls les modules validés sont ouverts", () => {
    const actifs = lireModulesActifs(MODULES_PRODUCTION.join(","));
    for (const ouvert of ["/", "/taches", "/messagerie", "/societes", "/collectes/12", "/structuration", "/stock", "/journal", "/cours-change", "/suivi-devise/x", "/employes", "/conversions", "/parametres", "/login", "/profil"])
      expect(cheminOuvert(actifs, ouvert), ouvert).toBe(true);
    for (const ferme of ["/facturation", "/honoraires", "/apurement/x", "/fournisseurs", "/banque", "/etat-swift", "/etats-financiers/1", "/bordereaux", "/souche-cheques", "/ma-souche", "/simulation-paie", "/grille-affectat"])
      expect(cheminOuvert(actifs, ferme), ferme).toBe(false);
  });

  it("production : l'API des modules fermés répond 403, sauf celle dont un module ouvert dépend", () => {
    const actifs = lireModulesActifs(MODULES_PRODUCTION.join(","));
    expect(apiOuverte(actifs, "/api/stock/synthese")).toBe(true);
    for (const fermee of ["/api/facturation", "/api/honoraires", "/api/apurement/achats", "/api/bordereaux", "/api/balances", "/api/souche-cheques", "/api/ttn"])
      expect(apiOuverte(actifs, fermee), fermee).toBe(false);
    // Stock → fournisseurs et banque ; Collectes → État SWIFT : leurs pages sont fermées, leur API reste lisible par ces modules.
    for (const dependance of ["/api/fournisseurs", "/api/banque", "/api/etat-swift"]) expect(apiOuverte(actifs, dependance), dependance).toBe(true);
    expect(cheminOuvert(actifs, "/fournisseurs")).toBe(false);
  });

  it("ignore les clés inconnues", () => {
    expect([...lireModulesActifs("stock, nimporte, journal")]).toEqual(["stock", "journal"]);
  });
});
