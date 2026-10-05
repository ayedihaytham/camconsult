import { afterEach, describe, expect, it, vi } from "vitest";
import { ExtractionUnavailableError, extractDocument, extractPages } from "./ocr.js";

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
