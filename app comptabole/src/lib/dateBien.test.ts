import { afterEach, describe, expect, it } from "vitest";
import { dateCalendrier } from "./dateBien";

// Dates SYNTHÉTIQUES. Le fuseau est changé à l'exécution (Node le prend en compte) puis restauré.
const TZ_INITIAL = process.env.TZ;
afterEach(() => {
  if (TZ_INITIAL === undefined) delete process.env.TZ;
  else process.env.TZ = TZ_INITIAL;
});

describe.each(["UTC", "Africa/Tunis", "America/New_York", "Pacific/Auckland"])("dateCalendrier (fuseau %s)", (tz) => {
  const dans = (f: () => void) => {
    process.env.TZ = tz;
    f();
  };

  it("une vraie date de classeur (minuit local) garde son jour de calendrier, sans décalage à la veille", () =>
    dans(() => {
      expect(dateCalendrier(new Date(2026, 7, 31))).toBe("2026-08-31");
      expect(dateCalendrier(new Date(2026, 0, 1, 0, 0, 0))).toBe("2026-01-01");
      expect(dateCalendrier(new Date(2026, 11, 31, 23, 59, 59))).toBe("2026-12-31");
      expect(dateCalendrier(new Date(2026, 5, 15, 12, 0, 0))).toBe("2026-06-15");
    }));

  it("jours bissextiles et fins de mois", () =>
    dans(() => {
      expect(dateCalendrier(new Date(2028, 1, 29))).toBe("2028-02-29");
      expect(dateCalendrier("29/02/2028")).toBe("2028-02-29");
      expect(dateCalendrier("29/02/2027")).toBe("");
      expect(dateCalendrier("2027-02-29")).toBe("");
      expect(dateCalendrier("1900-02-29")).toBe("");
      expect(dateCalendrier("30/04/2026")).toBe("2026-04-30");
      expect(dateCalendrier("31/04/2026")).toBe("");
    }));

  it("chaînes : jj/mm/aaaa, jj/mm/aa, ISO ; le texte ISO n'est jamais décalé", () =>
    dans(() => {
      expect(dateCalendrier("5/3/2026")).toBe("2026-03-05");
      expect(dateCalendrier("05/03/26")).toBe("2026-03-05");
      expect(dateCalendrier(" 2026-01-01 ")).toBe("2026-01-01");
    }));

  it("valeurs invalides ou absentes : chaîne vide", () =>
    dans(() => {
      expect(dateCalendrier(new Date(Number.NaN))).toBe("");
      expect(dateCalendrier("")).toBe("");
      expect(dateCalendrier(null)).toBe("");
      expect(dateCalendrier(undefined)).toBe("");
      expect(dateCalendrier("n'importe quoi")).toBe("");
      expect(dateCalendrier("13/13/2026")).toBe("");
      expect(dateCalendrier("0/1/2026")).toBe("");
    }));
});

describe("dateCalendrier : ancien comportement démontré fautif", () => {
  it("toISOString() décale à la veille à l'est de UTC (c'est ce que l'ancien code faisait)", () => {
    process.env.TZ = "Africa/Tunis";
    const d = new Date(2026, 7, 31);
    expect(d.toISOString().slice(0, 10)).toBe("2026-08-30");
    expect(dateCalendrier(d)).toBe("2026-08-31");
  });
});

describe("ImportBiensDialog (vérification statique)", () => {
  it("utilise dateCalendrier et ne convertit plus les dates par toISOString()", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync(new URL("../pages/etatsFinanciers/ImportBiensDialog.tsx", import.meta.url), "utf-8");
    expect(source).toContain("dateCalendrier(");
    expect(source).not.toContain("toISOString");
  });
});
