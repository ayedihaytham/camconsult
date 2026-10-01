import { describe, expect, it } from "vitest";
import { financialViewTour, getPageTour } from "./tourRegistry";

describe("guided tour route coverage", () => {
  it.each([
    "/", "/societes", "/employes", "/taches", "/collectes", "/collectes/1",
    "/stock", "/stock/1", "/etats-financiers", "/etats-financiers/1",
    "/etats-financiers/1/2", "/grille-affectat", "/bordereaux", "/honoraires",
    "/honoraires/1", "/souche-cheques", "/souche-cheques/1", "/suivi-devise",
    "/suivi-devise/1", "/suivi-devise/1/2", "/structuration", "/messagerie",
    "/conversions", "/journal", "/parametres",
  ])("has a page tour for %s", (path) => {
    const tour = getPageTour(path, null);
    expect(tour?.steps.length).toBeGreaterThanOrEqual(3);
    expect(tour?.version).toBeGreaterThan(0);
  });

  it("excludes authentication, print, and unknown routes", () => {
    expect(getPageTour("/login", null)).toBeNull();
    expect(getPageTour("/etats-financiers/1/imprimer", null)).toBeNull();
    expect(getPageTour("/etats-financiers/1/imprimer/actif", null)).toBeNull();
    expect(getPageTour("/unknown", null)).toBeNull();
  });

  it("reuses one statement tour configuration across formal views", () => {
    for (const view of ["actif", "passif", "resultat", "flux"]) {
      const tour = financialViewTour(view);
      expect(tour?.steps.map((step) => step.title)).toEqual(financialViewTour("actif")?.steps.map((step) => step.title));
    }
    expect(financialViewTour("exercices")).toBeNull();
  });
});
