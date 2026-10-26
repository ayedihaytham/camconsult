import { describe, expect, it } from "vitest";
import { CONFIANCE_MINIMALE, ECHELLE_OCR, motsDeResultat, motsVersItems, type MotOcr } from "./ocrPdf";

const mot = (text: string, x0: number, y0: number, x1: number, y1: number, confidence = 90): MotOcr => ({ text, confidence, bbox: { x0, y0, x1, y1 } });

describe("reconnaissance de caractères : passage aux morceaux de texte d'un PDF", () => {
  it("convertit les pixels (origine en haut) en points (origine en bas) avec l'échelle de lecture", () => {
    const [item] = motsVersItems([mot("1 234,50", 250, 100, 500, 150)], ECHELLE_OCR, 842);
    expect(item).toEqual({ str: "1 234,50", x: 100, y: 842 - 60, w: 100, h: 20 });
  });

  it("écarte le bruit : texte vide et confiance trop faible", () => {
    const items = motsVersItems([mot("Solde", 0, 0, 50, 10), mot("   ", 0, 0, 5, 5), mot("~", 0, 0, 5, 5, CONFIANCE_MINIMALE - 1)], 1, 100);
    expect(items.map((i) => i.str)).toEqual(["Solde"]);
  });

  it("garde l'ordre vertical d'origine : une ligne plus basse sur l'image a un y plus petit", () => {
    const [haut, bas] = motsVersItems([mot("A", 0, 10, 10, 20), mot("B", 0, 200, 10, 210)], 1, 300);
    expect(haut.y).toBeGreaterThan(bas.y);
  });

  it("lit les mots à plat ou imbriqués dans les blocs, et un résultat vide sans erreur", () => {
    const m = mot("Total", 0, 0, 10, 10);
    expect(motsDeResultat({ words: [m] })).toEqual([m]);
    expect(motsDeResultat({ blocks: [{ paragraphs: [{ lines: [{ words: [m] }, { words: [m] }] }] }] })).toHaveLength(2);
    expect(motsDeResultat({ blocks: null })).toEqual([]);
    expect(motsDeResultat(undefined)).toEqual([]);
  });
});
