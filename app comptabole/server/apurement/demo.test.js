import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { parseBcd } from "./bcd.js";
import { parseWorkbook } from "./imports.js";
const fixture = (name) =>
  readFileSync(new URL(`../../public/apurement-demo/${name}`, import.meta.url));
it("ships both Excel examples with the documented exact totals, text identifiers and fiscal identity", async () => {
  for (const ext of ["xls", "xlsx"]) {
    const p = await parseWorkbook(fixture(`achats-valides.${ext}`), ext);
    expect(p.rows).toHaveLength(3);
    expect(p.rows.every((r) => !r.errors.length)).toBe(true);
    expect(p.rows[0].bcNumero).toBe("000001");
    expect(p.profil.matriculeFiscal).toBe("1111111AB000");
    expect(p.rows.reduce((s, r) => s + BigInt(r.montantHtMillimes), 0n)).toBe(
      2734567n,
    );
    expect(
      p.rows.reduce((s, r) => s + BigInt(r.tvaSuspendueMillimes), 0n),
    ).toBe(519568n);
  }
});
it("ships a partial-date and monetary precision exercise without silently changing source values", async () => {
  const p = await parseWorkbook(fixture("achats-exceptions.xlsx"), "xlsx");
  expect(p.rows[0]).toMatchObject({
    dateFacture: null,
    datePrecision: "month",
    dateBrute: "07/2026",
  });
  expect(p.rows[1].tvaSuspendueMillimes).toBe("190001");
  expect(p.rows[2].errors.length).toBeGreaterThan(0);
  const update = await parseWorkbook(
    fixture("achats-mise-a-jour.xlsx"),
    "xlsx",
  );
  expect(update.rows[0]).toMatchObject({
    numeroFacture: "DEMO-IMP-001",
    montantHtMillimes: "1100000",
    tvaSuspendueMillimes: "209000",
  });
});
it("ships consistent BCD and +13 millime exercises, never an official artifact", () => {
  const valid = parseBcd(fixture("BCD_TEST_NON_OFFICIEL_T3_2026.txt"));
  const delta = parseBcd(fixture("BCD_TEST_ECART_013.txt"));
  expect(valid.rows).toHaveLength(3);
  expect(valid.warnings).toEqual([]);
  expect(valid.totals).toMatchObject({ ht: "2734567", tva: "519568" });
  expect(delta.warnings).toContainEqual(
    expect.objectContaining({ code: "BCD_ECART_PIED", tva: "13" }),
  );
  expect(delta.totals.tva).toBe(valid.totals.tva);
  expect(
    fixture("MANUEL_RECETTE.md").equals(
      readFileSync(
        new URL("../../docs/apurement/MANUEL_RECETTE.md", import.meta.url),
      ),
    ),
  ).toBe(true);
});
