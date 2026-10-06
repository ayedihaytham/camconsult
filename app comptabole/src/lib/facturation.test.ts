import { describe, expect, it } from "vitest";
import type { Facture } from "@/types";
import { ajouterJours, calculerTotaux, estEnRetard, htmlFacture } from "./facturation";

describe("calculerTotaux", () => {
  it("calcule HT, TVA et net à payer avec timbre", () => {
    const t = calculerTotaux(
      [
        { quantite: 2, montantHt: 500 },
        { quantite: 1, montantHt: 1200.5 },
      ],
      19,
      1,
    );
    expect(t).toEqual({ totalHt: 2200.5, tva: 418.095, netAPayer: 2619.595 });
  });

  it("n'applique que le timbre quand il n'y a aucune ligne, et gère la TVA à 0 %", () => {
    expect(calculerTotaux([], 19, 1)).toEqual({ totalHt: 0, tva: 0, netAPayer: 1 });
    expect(calculerTotaux([{ quantite: 1, montantHt: 100 }], 0, 1).netAPayer).toBe(101);
  });

  it("arrondit au millime", () => {
    const t = calculerTotaux([{ quantite: 3, montantHt: 33.3333 }], 19, 0);
    expect(t.totalHt).toBe(100);
    expect(Number.isInteger(t.tva * 1000)).toBe(true);
  });
});

describe("estEnRetard", () => {
  it("ne signale que les factures émises dont l'échéance est dépassée", () => {
    expect(estEnRetard({ statut: "emise", echeance: "2026-10-01" }, "2026-10-06")).toBe(true);
    expect(estEnRetard({ statut: "emise", echeance: "2026-10-06" }, "2026-10-06")).toBe(false);
    expect(estEnRetard({ statut: "payee", echeance: "2026-10-01" }, "2026-10-06")).toBe(false);
    expect(estEnRetard({ statut: "annulee", echeance: "2026-10-01" }, "2026-10-06")).toBe(false);
    expect(estEnRetard({ statut: "emise", echeance: null }, "2026-10-06")).toBe(false);
  });
});

describe("ajouterJours", () => {
  it("passe d'un mois à l'autre", () => {
    expect(ajouterJours("2026-10-06", 30)).toBe("2026-11-05");
    expect(ajouterJours("2026-12-20", 30)).toBe("2027-01-19");
  });
});

describe("htmlFacture", () => {
  const facture: Facture = {
    id: "1",
    societeId: "s",
    societeNom: "ACME <script>alert(1)</script>",
    numero: "2026-0001",
    dateEmission: "2026-10-06",
    echeance: "2026-11-05",
    tvaTaux: 19,
    timbre: 1,
    statut: "emise",
    payeLe: null,
    signeeLe: null,
    note: "",
    totalHt: 100,
    tva: 19,
    netAPayer: 120,
    creeLe: "2026-10-06T10:00:00Z",
    lignes: [{ ordre: 0, description: "Honoraires & frais", quantite: 1, montantHt: 100 }],
  };

  it("échappe le texte saisi et affiche les montants", () => {
    const html = htmlFacture(facture);
    expect(html).not.toContain("<script>alert(1)");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("Honoraires &amp; frais");
    expect(html).toContain("2026-0001");
    expect(html).toContain("06/10/2026");
    expect(html).toContain("120,000");
  });
});
