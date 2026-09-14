import { describe, it, expect } from "vitest";
import { defaultPermissions, nextSocieteCode } from "./data";
import type { Societe } from "@/types";

describe("defaultPermissions", () => {
  it("donne tous les droits au Comptable", () => {
    const c = defaultPermissions("Comptable");
    expect(Object.values(c).every(Boolean)).toBe(true);
  });

  it("limite le Stagiaire à la lecture + messagerie", () => {
    const s = defaultPermissions("Stagiaire");
    expect(s.consulterDossiers).toBe(true);
    expect(s.messagerie).toBe(true);
    expect(s.deposerFichiers).toBe(false);
    expect(s.supprimer).toBe(false);
    expect(s.modifierSocietes).toBe(false);
  });

  it("autorise l'Assistant à déposer mais pas à supprimer", () => {
    const a = defaultPermissions("Assistant");
    expect(a.deposerFichiers).toBe(true);
    expect(a.supprimer).toBe(false);
  });
});

describe("nextSocieteCode", () => {
  it("part de CLI-0001 sur une liste vide", () => {
    expect(nextSocieteCode([])).toBe("CLI-0001");
  });

  it("incrémente le plus grand code existant", () => {
    expect(
      nextSocieteCode([
        { code: "CLI-0007" } as Societe,
        { code: "CLI-0003" } as Societe,
      ]),
    ).toBe("CLI-0008");
  });
});
