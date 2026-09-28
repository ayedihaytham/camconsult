import { describe, expect, it } from "vitest";
import { parseBalanceAmount, parseBalanceRows } from "./importBalance";

describe("parseBalanceAmount", () => {
  it.each([
    [1234.56, 1234.56],
    ["1234.56", 1234.56],
    ["1234,56", 1234.56],
    ["1 234,56", 1234.56],
    ["1\u00a0234,56", 1234.56],
    ["1.234,56", 1234.56],
    ["1,234.56", 1234.56],
    ["", 0],
  ])("parses %s without changing its amount", (input, expected) => {
    expect(parseBalanceAmount(input)).toEqual({ ok: true, value: expected });
  });

  it.each(["12,3,4", "abc", "1.234.56", "1,234", "1.234", "Infinity"]) (
    "rejects malformed or ambiguous value %s",
    (input) => {
      expect(parseBalanceAmount(input)).toEqual({ ok: false, value: null, raw: input });
    },
  );

  it("keeps invalid amount cells unresolved in the preview row", () => {
    const parsed = parseBalanceRows([
      ["Compte", "Libellé", "Débit", "Crédit"],
      ["411000", "Client", "1.234.56", "abc"],
    ]);

    expect(parsed.headerFound).toBe(true);
    expect(parsed.rows[0]).toMatchObject({
      compte: "411000",
      debitRaw: "1.234.56",
      creditRaw: "abc",
      amountErrors: {
        debit: "Montant Débit invalide ou ambigu.",
        credit: "Montant Crédit invalide ou ambigu.",
      },
    });
  });
});
