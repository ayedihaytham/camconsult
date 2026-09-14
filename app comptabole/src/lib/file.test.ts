import { describe, it, expect } from "vitest";
import { fileExtension, formatFileSize } from "./file";

describe("fileExtension", () => {
  it("extrait l'extension en minuscules", () => {
    expect(fileExtension("Rapport.PDF")).toBe("pdf");
    expect(fileExtension("balance.2026.xlsx")).toBe("xlsx");
  });
  it("renvoie une chaîne vide sans extension", () => {
    expect(fileExtension("README")).toBe("");
  });
});

describe("formatFileSize", () => {
  it("formate les octets, Ko, Mo", () => {
    expect(formatFileSize(512)).toBe("512 o");
    expect(formatFileSize(1536)).toBe("1,5 Ko");
    expect(formatFileSize(5 * 1024 * 1024)).toBe("5 Mo");
  });
});
