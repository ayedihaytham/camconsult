import { describe, it, expect } from "vitest";
import { generatePassword, scorePassword } from "./password";

describe("generatePassword", () => {
  it("respecte la longueur demandée", () => {
    expect(generatePassword(14)).toHaveLength(14);
    expect(generatePassword(20)).toHaveLength(20);
  });

  it("contient au moins une majuscule, une minuscule, un chiffre et un symbole", () => {
    for (let i = 0; i < 20; i++) {
      const p = generatePassword();
      expect(p).toMatch(/[A-Z]/);
      expect(p).toMatch(/[a-z]/);
      expect(p).toMatch(/\d/);
      expect(p).toMatch(/[^A-Za-z0-9]/);
    }
  });
});

describe("scorePassword", () => {
  it("note faible un mot de passe court", () => {
    expect(scorePassword("abc").level).toBe("faible");
  });

  it("note excellent un mot de passe long et varié", () => {
    const r = scorePassword("Abcdef12!ghij");
    expect(r.score).toBe(4);
    expect(r.level).toBe("excellent");
  });

  it("progresse avec la complexité", () => {
    expect(scorePassword("aaaaaaaa").score).toBeLessThan(
      scorePassword("Aaaaaa1!").score,
    );
  });
});
