import { describe, expect, it } from "vitest";
import { normaliserMatriculeFiscal, validerMatriculeFiscal } from "./mf.js";

// Identifiants synthétiques (formes de l'exemple TTN) ; aucun matricule réel.
describe("matricule fiscal", () => {
  it.each(["0736202XAM000", "0914089JAM000", "1234567ABM000", "7654321KAP001", "0000001HDC000", "1234567BNE002"])("accepte %s", (mf) => {
    expect(validerMatriculeFiscal(mf)).toEqual({ ok: true, normalise: mf, erreur: "" });
  });

  it("normalise sans deviner : majuscules, espaces et séparateurs retirés", () => {
    expect(normaliserMatriculeFiscal(" 0736202x am 000 ")).toBe("0736202XAM000");
    expect(normaliserMatriculeFiscal("0736202-XAM/000")).toBe("0736202XAM000");
    expect(normaliserMatriculeFiscal(null)).toBe("");
    expect(validerMatriculeFiscal(" 0736202xam000 ").ok).toBe(true);
  });

  it("refuse l'absence, avec un message", () => {
    expect(validerMatriculeFiscal("").erreur).toMatch(/absent/);
    expect(validerMatriculeFiscal(undefined).ok).toBe(false);
  });

  it("refuse un matricule de 12 caractères (6 chiffres) en suggérant le zéro manquant, sans le corriger", () => {
    const r = validerMatriculeFiscal("005910DAM000");
    expect(r.ok).toBe(false);
    expect(r.normalise).toBe("005910DAM000");
    expect(r.erreur).toMatch(/13 caractères.*12 trouvés.*zéro/);
  });

  it.each([
    ["073620XXAM000", /7 premiers caractères/], // 6 chiffres puis lettres, 13 caractères
    ["0736202IAM000", /lettre clé/], // I exclue
    ["0736202OAM000", /lettre clé/],
    ["0736202UAM000", /lettre clé/],
    ["0736202XFM000", /code TVA/], // F absent du schéma
    ["0736202XAZ000", /code catégorie/],
    ["0736202XAM00A", /établissement/],
    ["0736202XAM0000", /13 caractères/],
  ])("refuse %s", (mf, motif) => {
    const r = validerMatriculeFiscal(mf);
    expect(r.ok).toBe(false);
    expect(r.erreur).toMatch(motif);
  });
});
