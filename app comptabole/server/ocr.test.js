import { afterEach, describe, expect, it, vi } from "vitest";
import { ExtractionUnavailableError, douaneCoherente, douaneIncomplete, extractDocument, extractPages, resumeImport } from "./ocr.js";

// Petite image PNG valide (1x1) — le contenu n'a pas d'importance : sans moteur,
// l'extraction doit refuser avant toute lecture.
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

describe("extraction sans moteur", () => {
  afterEach(() => vi.unstubAllEnvs());

  function sansMoteur() {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("RUSPINA_OCR_URL", "");
  }

  it("refuse l'import d'une pièce avec un message clair, sans lecture locale", async () => {
    sansMoteur();
    const err = await extractDocument(PNG, "achat", "CAM").catch((e) => e);
    expect(err).toBeInstanceOf(ExtractionUnavailableError);
    expect(err.code).toBe("EXTRACTION_UNAVAILABLE");
    expect(err.message).toMatch(/ANTHROPIC_API_KEY/);
  });

  it("refuse l'import d'un document complet", async () => {
    sansMoteur();
    await expect(extractPages(PNG, "CAM")).rejects.toBeInstanceOf(ExtractionUnavailableError);
  });

  it("refuse un type de fichier non pris en charge", async () => {
    sansMoteur();
    await expect(extractDocument("data:text/plain;base64,aGVsbG8=", "achat", "CAM")).rejects.toThrow(/non pris en charge/);
  });

  it("n'utilise pas le moteur RUSPINA quand il est désactivé", async () => {
    sansMoteur();
    vi.stubEnv("RUSPINA_OCR_URL", "http://ocr:8000");
    vi.stubEnv("RUSPINA_OCR_ENABLED", "false");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(extractDocument(PNG, "achat", "01-RUSPINA")).rejects.toBeInstanceOf(ExtractionUnavailableError);
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("n'utilise pas le moteur RUSPINA pour une autre société", async () => {
    sansMoteur();
    vi.stubEnv("RUSPINA_OCR_URL", "http://ocr:8000");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(extractDocument(PNG, "achat", "CAM")).rejects.toBeInstanceOf(ExtractionUnavailableError);
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe("cohérence d'une déclaration douanière", () => {
  const base = { numDeclaration: "447898", ptfn: 52000, tauxChange: 3.2842, valeurTnd: 170778.4 };

  it("accepte valeur = PTFN x taux", () => {
    expect(douaneCoherente(base)).toBe(true);
    expect(douaneIncomplete(base)).toBe(false);
  });
  it("détecte un chiffre mal lu", () => {
    expect(douaneCoherente({ ...base, tauxChange: 3.2755 })).toBe(false);
    expect(douaneIncomplete({ ...base, valeurTnd: 144115.4 })).toBe(true);
  });
  it("signale les champs manquants", () => {
    expect(douaneIncomplete({ ...base, ptfn: 0 })).toBe(true);
    expect(douaneIncomplete({ ...base, numDeclaration: "" })).toBe(true);
  });
});

describe("synthèse d'un import", () => {
  it("résume pages, durée, jetons et coût", () => {
    const ligne = resumeImport(3, 12_345, { appels: 5, entree: 22_050, sortie: 700, cout: 0.0356, coutInconnu: false });
    expect(ligne).toBe("[ocr] import terminé : 3 pages en 12.3 s — 5 appels, 22050 jetons entrée / 700 sortie, ≈ $0.0356");
  });

  it("signale l'absence d'appel au modèle ou un coût inconnu", () => {
    expect(resumeImport(1, 1000, { appels: 0, entree: 0, sortie: 0, cout: 0, coutInconnu: false })).toContain("aucun appel au modèle");
    expect(resumeImport(1, 1000, { appels: 1, entree: 1, sortie: 1, cout: 0, coutInconnu: true })).toContain("coût inconnu");
  });
});
