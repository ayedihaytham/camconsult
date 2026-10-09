import { describe, expect, it } from "vitest";
import { formatAmountInput, parseAmount, round3, sanitizeAmountInput } from "./amount";

describe("saisie des montants", () => {
  it("accepte la virgule et le point comme séparateur décimal", () => {
    expect(parseAmount(sanitizeAmountInput("12,345"))).toBe(12.345);
    expect(parseAmount(sanitizeAmountInput("12.345"))).toBe(12.345);
  });

  it("limite à 3 décimales et ne garde qu'un séparateur", () => {
    expect(sanitizeAmountInput("1,23456")).toBe("1.234");
    expect(sanitizeAmountInput("1.2.3")).toBe("1.23");
  });

  it("garde les états intermédiaires sans les transformer en 0 saisi", () => {
    expect(sanitizeAmountInput("12,")).toBe("12.");
    expect(parseAmount("12.")).toBe(12);
    expect(sanitizeAmountInput("-")).toBe("-");
    expect(parseAmount("-")).toBe(0);
  });

  it("retire les caractères non numériques et gère le signe", () => {
    expect(sanitizeAmountInput("abc1 2")).toBe("12");
    expect(sanitizeAmountInput("-5,5")).toBe("-5.5");
    expect(sanitizeAmountInput("-5,5", { allowNegative: false })).toBe("5.5");
    expect(sanitizeAmountInput("5-5")).toBe("55");
  });

  it("arrondit au millime et affiche avec la virgule", () => {
    expect(round3(0.1 + 0.2)).toBe(0.3);
    expect(round3(1.23456)).toBe(1.235);
    expect(formatAmountInput(1234.5)).toBe("1234,5");
    expect(formatAmountInput(0)).toBe("0");
    // Un cours garde ses 4 décimales ; sans précision, le millime reste la limite.
    expect(formatAmountInput(3.3167, 4)).toBe("3,3167");
    expect(formatAmountInput(3.3167)).toBe("3,317");
  });
});
