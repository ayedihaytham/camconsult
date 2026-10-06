import { describe, expect, it } from "vitest";
import { alleger, estImageDataUrl, poidsMo, tailleReduite } from "./image";

describe("estImageDataUrl", () => {
  it("reconnaît les images et pas les PDF", () => {
    expect(estImageDataUrl("data:image/png;base64,AAAA")).toBe(true);
    expect(estImageDataUrl("data:image/jpeg;base64,AAAA")).toBe(true);
    expect(estImageDataUrl("data:application/pdf;base64,AAAA")).toBe(false);
    expect(estImageDataUrl(null)).toBe(false);
    expect(estImageDataUrl("")).toBe(false);
  });
});

describe("tailleReduite", () => {
  it("ramène le plus grand côté à la limite en gardant les proportions", () => {
    expect(tailleReduite(3600, 1800, 1800)).toEqual({ largeur: 1800, hauteur: 900 });
    expect(tailleReduite(1000, 4000, 2000)).toEqual({ largeur: 500, hauteur: 2000 });
  });

  it("n'agrandit jamais une petite image", () => {
    expect(tailleReduite(800, 600, 1800)).toEqual({ largeur: 800, hauteur: 600 });
  });
});

describe("alleger", () => {
  it("laisse un PDF intact", async () => {
    const pdf = "data:application/pdf;base64,JVBERi0=";
    expect(await alleger(pdf)).toBe(pdf);
  });

  it("renvoie l'original sans navigateur pour dessiner (environnement de test)", async () => {
    const png = "data:image/png;base64,iVBORw0KGgo=";
    expect(await alleger(png)).toBe(png);
  });
});

describe("poidsMo", () => {
  it("convertit une taille en Mo", () => {
    expect(poidsMo("x".repeat(1_048_576))).toBe(1);
  });
});
