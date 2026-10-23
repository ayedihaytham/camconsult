import { describe, expect, it } from "vitest";
import { BAREMES, baremeApplicable } from "./baremes";
import { calculerSimulation, etapesCalcul, impotAnnuel, type EntreeSimulation } from "./calcul";
import { salaireDepuisNet } from "./inverse";
import { versMillimes } from "./saisie";

/**
 * Chiffres de référence de docs/simulation-paie.md (§4 à §6) : si le calcul change, ces tests échouent et le document doit être mis à jour.
 * Tous les montants sont en millimes.
 */
const b2026 = baremeApplicable("2026-10")!;
const b2022 = baremeApplicable("2022-06")!;

const A: EntreeSimulation = { base: 1_000_000, transport: 77_847, primes: 0, panier: 0, retenues: 0, enfants: 0, chefFamille: false };
const B: EntreeSimulation = { base: 2_500_000, transport: 77_847, primes: 200_000, panier: 60_000, retenues: 150_000, enfants: 2, chefFamille: true };
const C: EntreeSimulation = { ...A, base: 500_000, transport: 0 };
const E: EntreeSimulation = { ...A, base: 9_000_000, transport: 0 };

describe("barème applicable à un mois", () => {
  it("prend celui dont la date d'effet est la plus récente, au plus tard le dernier jour du mois", () => {
    expect(baremeApplicable("2026-10")?.annee).toBe(2026);
    expect(baremeApplicable("2026-01")?.annee).toBe(2026);
    expect(baremeApplicable("2025-12")?.annee).toBe(2025);
    expect(baremeApplicable("2024-06")?.annee).toBe(2024);
    expect(baremeApplicable("2023-01")?.annee).toBe(2023);
    expect(baremeApplicable("2022-01")?.annee).toBe(2022);
  });

  it("n'en trouve aucun avant 2022 ni pour un mois illisible", () => {
    expect(baremeApplicable("2021-12")).toBeUndefined();
    expect(baremeApplicable("")).toBeUndefined();
    expect(baremeApplicable("2026-13")).toBeUndefined();
    expect(baremeApplicable("octobre")).toBeUndefined();
  });

  it("porte les taux et les tranches des quatre barèmes fournis", () => {
    expect(BAREMES.map((b) => [b.annee, b.cnssSalarieBp, b.cnssPatronaleBp, b.cssBp, b.cssSeuilExoneration])).toEqual([
      [2022, 918, 1657, 100, null],
      [2023, 918, 1657, 50, 5_000_000],
      [2024, 918, 1657, 50, 5_000_000],
      [2025, 918, 1657, 50, 5_000_000],
      [2026, 968, 1707, 50, 5_000_000],
    ]);
    expect(BAREMES.find((b) => b.annee === 2024)?.tranches).toHaveLength(5);
    expect(BAREMES.find((b) => b.annee === 2025)?.tranches).toHaveLength(8);
  });
});

describe("impôt annuel : tranches, bornes basses incluses et hautes exclues", () => {
  it("applique chaque taux à la part de revenu de sa tranche, arrondi une seule fois", () => {
    expect(impotAnnuel(0, b2026)).toBe(0);
    expect(impotAnnuel(5_000_000, b2026)).toBe(0);
    expect(impotAnnuel(5_000_001, b2026)).toBe(0); // 0,15 millime arrondi
    expect(impotAnnuel(10_000_000, b2026)).toBe(750_000);
    expect(impotAnnuel(10_513_919, b2026)).toBe(878_480);
    expect(impotAnnuel(20_000_000, b2026)).toBe(750_000 + 2_500_000);
  });
});

describe("du brut au net : exemples de référence", () => {
  it("A : célibataire, base 1 000 + transport 77,847, barème 2026 (octobre 2026)", () => {
    const r = calculerSimulation(A, b2026);
    expect(r).toMatchObject({
      brut: 1_077_847, cnss: 104_336, netImposableMois: 973_511, annuel: 11_682_132, fraisPro: 1_168_213, deductions: 0,
      revenuImposable: 10_513_919, impotAnnuel: 878_480, irpp: 73_207, css: 4_381, net: 895_923, netAPayer: 895_923, chargesPatronales: 183_988,
    });
  });

  it("B : chef de famille, 2 enfants, panier non imposable, frais plafonnés, retenue sur le net", () => {
    const r = calculerSimulation(B, b2026);
    expect(r).toMatchObject({ brut: 2_837_847, cnss: 274_704, brutImposable: 2_777_847, fraisPro: 2_000_000, deductions: 500_000, revenuImposable: 27_537_716, irpp: 459_276, css: 11_474, net: 2_092_393, netAPayer: 1_942_393 });
  });

  it("C : bas revenu, CSS exonérée", () => {
    expect(calculerSimulation(C, b2026)).toMatchObject({ brut: 500_000, cnss: 48_400, revenuImposable: 4_877_280, irpp: 0, css: 0, net: 451_600, netAPayer: 451_600 });
  });

  it("D : le cas A avec le barème 2022 (CSS 1 % sans exonération)", () => {
    expect(calculerSimulation(A, b2022)).toMatchObject({ brut: 1_077_847, cnss: 98_946, revenuImposable: 10_572_131, irpp: 120_730, css: 8_810, net: 849_361 });
  });

  it("E : base 9 000, les huit tranches jusqu'à 40 %", () => {
    expect(calculerSimulation(E, b2026)).toMatchObject({ brut: 9_000_000, cnss: 871_200, revenuImposable: 95_545_600, irpp: 2_580_687, css: 39_811, net: 5_508_302, netAPayer: 5_508_302 });
  });

  it("plafonne à 4 enfants, ignore un nombre négatif ou illisible, et ne descend jamais sous un revenu imposable de zéro", () => {
    const quatre = calculerSimulation({ ...A, enfants: 4 }, b2026).deductions;
    expect(calculerSimulation({ ...A, enfants: 9 }, b2026).deductions).toBe(quatre);
    expect(quatre).toBe(400_000);
    expect(calculerSimulation({ ...A, enfants: -3 }, b2026).deductions).toBe(0);
    expect(calculerSimulation({ ...A, enfants: Number.NaN }, b2026).deductions).toBe(0);
    expect(calculerSimulation({ base: 0, transport: 0, primes: 0, panier: 0, retenues: 0, enfants: 4, chefFamille: true }, b2026).revenuImposable).toBe(0);
  });

  it("le déroulé donne les mêmes montants que le calcul, dans l'ordre du moteur", () => {
    const r = calculerSimulation(A, b2026);
    const etapes = etapesCalcul(A, b2026, r);
    expect(etapes.map((e) => e.cle)).toEqual(["brut", "cnss", "brutImposable", "netImposableMois", "annuel", "fraisPro", "deductions", "revenuImposable", "impotAnnuel", "irpp", "css", "net", "netAPayer", "chargesPatronales"]);
    expect(etapes.find((e) => e.cle === "irpp")?.montant).toBe(73_207);
    expect(etapes.find((e) => e.cle === "cnss")?.detail).toContain("9,68 %");
    expect(etapesCalcul(C, b2026, calculerSimulation(C, b2026)).find((e) => e.cle === "css")?.detail).toMatch(/exonérée/);
  });
});

describe("effet de falaise de la CSS au seuil d'exonération", () => {
  const seul: EntreeSimulation = { base: 0, transport: 0, primes: 0, panier: 0, retenues: 0, enfants: 0, chefFamille: false };
  it("le net baisse de 462,963 à 460,881 quand le salaire passe de 512,581 à 512,582", () => {
    expect(calculerSimulation({ ...seul, base: 512_581 }, b2026).netAPayer).toBe(462_963);
    expect(calculerSimulation({ ...seul, base: 512_582 }, b2026).netAPayer).toBe(460_881);
    expect(calculerSimulation({ ...seul, base: 512_581 }, b2026).css).toBe(0);
    expect(calculerSimulation({ ...seul, base: 512_582 }, b2026).css).toBeGreaterThan(2_000);
  });
});

describe("du net au brut", () => {
  const { base: _base, ...autresA } = A;
  const { base: _baseB, ...autresB } = B;
  void _base;
  void _baseB;

  it("net demandé 1 500,000 (cas A) : base 1 871,474, brut 1 949,321, écart 0", () => {
    const r = salaireDepuisNet(1_500_000, autresA, b2026)!;
    expect(r.base).toBe(1_871_474);
    expect(r.resultat.brut).toBe(1_949_321);
    expect(r.ecart).toBe(0);
  });

  it("net demandé 2 000,000 (cas B) : base 2 591,770, écart 0", () => {
    const r = salaireDepuisNet(2_000_000, autresB, b2026)!;
    expect(r.base).toBe(2_591_770);
    expect(r.ecart).toBe(0);
    expect(r.resultat.netAPayer).toBe(2_000_000);
  });

  it("à la falaise de la CSS, le résultat est exact mais pas toujours le plus petit (515,261 pour un net de 462,963)", () => {
    const seul = { transport: 0, primes: 0, panier: 0, retenues: 0, enfants: 0, chefFamille: false };
    const r = salaireDepuisNet(462_963, seul, b2026)!;
    expect(r.base).toBe(515_261);
    expect(r.ecart).toBe(0);
  });

  it("un net négatif ou hors de portée est inatteignable", () => {
    expect(salaireDepuisNet(-1, autresA, b2026)).toBeNull();
    expect(salaireDepuisNet(99_000_000_000, autresA, b2026)).toBeNull();
  });

  it("un net de zéro donne un salaire nul", () => {
    expect(salaireDepuisNet(0, { ...autresA, transport: 0 }, b2026)?.base).toBe(0);
  });
});

describe("saisie d'un montant en dinars", () => {
  it("accepte la virgule ou le point, les espaces, et vaut 0 si la saisie est illisible", () => {
    expect(versMillimes("1000")).toBe(1_000_000);
    expect(versMillimes("1 077,847")).toBe(1_077_847);
    expect(versMillimes("1077.847")).toBe(1_077_847);
    expect(versMillimes("0,5")).toBe(500);
    expect(versMillimes("77,8475")).toBe(77_848);
    expect(versMillimes("")).toBe(0);
    expect(versMillimes("abc")).toBe(0);
    expect(versMillimes("-12")).toBe(0);
  });
});
