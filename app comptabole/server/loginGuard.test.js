import { describe, expect, it } from "vitest";
import { createLoginGuard, egalConstant } from "./loginGuard.js";

describe("protection contre la force brute", () => {
  it("bloque un compte après trop d'échecs puis le libère à la fin de la fenêtre", () => {
    let t = 0;
    const g = createLoginGuard({ maxParCompte: 3, fenetreMs: 60_000, maintenant: () => t });
    for (let i = 0; i < 3; i++) {
      expect(g.attente("1.2.3.4", "Alice")).toBe(0);
      g.echec("1.2.3.4", "alice");
    }
    expect(g.attente("1.2.3.4", "ALICE")).toBeGreaterThan(0);
    // Un autre compte depuis la même adresse reste possible tant que l'adresse n'est pas saturée.
    expect(g.attente("1.2.3.4", "bob")).toBe(0);
    t = 61_000;
    expect(g.attente("1.2.3.4", "alice")).toBe(0);
  });

  it("une connexion réussie remet le compteur du compte à zéro", () => {
    const g = createLoginGuard({ maxParCompte: 2 });
    g.echec("ip", "a");
    g.succes("ip", "a");
    g.echec("ip", "a");
    expect(g.attente("ip", "a")).toBe(0);
  });

  it("bloque une adresse qui essaie trop de comptes différents", () => {
    const g = createLoginGuard({ maxParAdresse: 4 });
    for (const id of ["a", "b", "c", "d"]) g.echec("ip", id);
    expect(g.attente("ip", "e")).toBeGreaterThan(0);
    expect(g.attente("autre-ip", "e")).toBe(0);
  });

  it("compare les mots de passe en temps constant", () => {
    expect(egalConstant("Secret123!", "Secret123!")).toBe(true);
    expect(egalConstant("Secret123!", "Secret123")).toBe(false);
    expect(egalConstant("", "x")).toBe(false);
  });
});
