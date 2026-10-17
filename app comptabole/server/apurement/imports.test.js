import { describe, it, expect } from "vitest";
import XLSX from "xlsx";
import { exportBcdTest, parseBcd, officialBcd } from "./bcd.js";
import { parseWorkbook, validateWorkbook } from "./imports.js";
const snapshot = {
  annee: 2026,
  trimestre: "T3",
  profil: {
    matriculeFiscal: "1234567AB000",
    raisonSociale: "SYNTHETIQUE",
    activite: "INDUSTRIE",
    ville: "TUNIS",
    rue: "RUE TEST",
    numero: "1",
    codePostal: "1000",
  },
  lignes: Array.from({ length: 206 }, (_, i) => ({
    id: `test-${i}`,
    date_precision: "day",
    date_bc: "2026-07-01",
    date_facture: "2026-07-15",
    bc_numero: String(39 + (i % 6)).padStart(13, "0"),
    autorisation_numero: "AUT-TEST",
    matricule_fiscal_normalise: `765432${i % 4}ABC000`,
    raison_sociale: `FOURNISSEUR ${i % 4}`,
    numero_facture: `F-${i}`,
    montant_ht_millimes: i === 205 ? "13745327387" : "1000000",
    tva_suspendue_millimes: i === 205 ? "2611612191" : "190000",
    taux_tva_bps: 1900,
    objet: "ACHAT",
  })),
};
describe("Observed BCD, provisional export and bounded Excel", () => {
  it("round-trips 206 synthetic details with exact widths and totals", () => {
    const bytes = exportBcdTest(snapshot),
      p = parseBcd(bytes);
    expect(p.rows).toHaveLength(206);
    expect(p.totals.ht).toBe("13950327387");
    expect(p.totals.tva).toBe("2650562191");
    expect(new Set(p.rows.map((r) => r.bcNumero)).size).toBe(6);
    expect(new Set(p.rows.map((r) => r.fournisseurMf)).size).toBe(4);
    expect(
      bytes
        .toString()
        .trimEnd()
        .split("\r\n")
        .map((l) => l.length),
    ).toEqual([220, ...Array(206).fill(521), 198]);
  });
  it("flags +13 millime footer discrepancy without correction", () => {
    const lines = exportBcdTest(snapshot).toString().trimEnd().split("\r\n");
    const f = lines.at(-1);
    lines[lines.length - 1] = f.slice(0, 183) + "2650562204".padStart(15, "0");
    const p = parseBcd(Buffer.from(lines.join("\r\n")));
    expect(p.warnings[0].tva).toBe("13");
    expect(p.totals.tva).toBe("2650562191");
  });
  it("rejects duplicate sequence, noise, partial dates, non-ASCII and official output", () => {
    const bytes = exportBcdTest(snapshot);
    expect(() =>
      parseBcd(Buffer.concat([bytes, Buffer.from("noise")])),
    ).toThrow();
    const lines = bytes.toString().trimEnd().split("\r\n");
    lines[2] = lines[2].slice(0, 20) + "000001" + lines[2].slice(26);
    expect(() => parseBcd(Buffer.from(lines.join("\r\n")))).toThrow();
    expect(() =>
      exportBcdTest({
        ...snapshot,
        lignes: [{ ...snapshot.lignes[0], date_precision: "month" }],
      }),
    ).toThrow();
    expect(() => officialBcd()).toThrow();
    expect(() =>
      exportBcdTest({
        ...snapshot,
        profil: { ...snapshot.profil, raisonSociale: "DÉMO" },
      }),
    ).toThrow();
    const flag = process.env.APUREMENT_OFFICIAL_BCD_ENABLED;
    process.env.APUREMENT_OFFICIAL_BCD_ENABLED = "true";
    try {
      expect(() => officialBcd()).toThrow(/profil officiel signé/);
    } finally {
      if (flag === undefined) delete process.env.APUREMENT_OFFICIAL_BCD_ENABLED;
      else process.env.APUREMENT_OFFICIAL_BCD_ENABLED = flag;
    }
  });
  it("preserves month-only dates and leading zeros without executing macros", async () => {
    const w = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      w,
      XLSX.utils.aoa_to_sheet([
        [
          "Autorisation",
          "Numero BC",
          "Date BC",
          "Numero Facture",
          "Date facture",
          "MF",
          "Raison sociale",
          "Prix HT",
          "TVA",
          "Objet",
        ],
        [
          "AUT-TEST",
          "000039",
          "01/07/2026",
          "000128",
          "07/2026",
          "TEST-MF",
          "SYNTHETIQUE",
          "1444.800",
          "274.512",
          "ACHAT",
        ],
      ]),
      "Factures",
    );
    for (const type of ["xls", "xlsx"]) {
      const bytes = XLSX.write(w, {
        type: "buffer",
        bookType: type === "xls" ? "biff8" : "xlsx",
      });
      const p = await parseWorkbook(bytes, type);
      expect(p.rows[0].numeroFacture).toBe("000128");
      expect(p.rows[0].dateFacture).toBeNull();
      expect(p.rows[0].datePrecision).toBe("month");
      expect(p.rows[0].montantHtMillimes).toBe("1444800");
    }
  });
  it("rejects false formats and inflated ZIP before parsing", () => {
    expect(() =>
      validateWorkbook(Buffer.from("fake workbook"), "xls"),
    ).toThrow();
    expect(() => validateWorkbook(Buffer.alloc(10485761), "xlsx")).toThrow();
  });
  it("rejects imprecise numeric Excel money while preserving the same amount stored as text", async () => {
    const w = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      w,
      XLSX.utils.aoa_to_sheet([
        [
          "Autorisation",
          "Numero BC",
          "Date BC",
          "Numero Facture",
          "Date facture",
          "MF",
          "Raison sociale",
          "Prix HT",
          "TVA",
          "Objet",
        ],
        [
          "A",
          "B",
          "01/07/2026",
          "N-1",
          "15/07/2026",
          "TEST-MF",
          "SYNTHETIQUE",
          9007199254741.001,
          "0.000",
          "ACHAT",
        ],
        [
          "A",
          "B",
          "01/07/2026",
          "N-2",
          "15/07/2026",
          "TEST-MF",
          "SYNTHETIQUE",
          "9007199254741.001",
          "0.000",
          "ACHAT",
        ],
      ]),
      "Factures",
    );
    const p = await parseWorkbook(
      XLSX.write(w, { type: "buffer", bookType: "xlsx" }),
      "xlsx",
    );
    expect(
      p.rows[0].errors.some((e) => e.includes("garantir les millimes")),
    ).toBe(true);
    expect(p.rows[1].errors).toEqual([]);
    expect(p.rows[1].montantHtMillimes).toBe("9007199254741001");
  });
});
