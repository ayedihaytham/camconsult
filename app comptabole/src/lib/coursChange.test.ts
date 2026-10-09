import { describe, expect, it } from "vitest";
import type { CoursChange, DeviseChange } from "@/types";
import { anneeMois, anneesAvecCours, coursDuMois, coursParUnite, lireCoursCollés, moyenneAnnee } from "./coursChange";

const cours: CoursChange[] = [
  { devise: "EUR", annee: 2025, mois: 1, cours: 3.3167 },
  { devise: "EUR", annee: 2025, mois: 2, cours: 3.3128 },
  { devise: "USD", annee: 2025, mois: 1, cours: 3.2 },
  { devise: "EUR", annee: 2024, mois: 12, cours: 3.4 },
];
const devises: DeviseChange[] = [
  { code: "USD", libelle: "Dollar", unite: 1, ordre: 1 },
  { code: "EUR", libelle: "Euro", unite: 1, ordre: 2 },
  { code: "JPY", libelle: "Yen", unite: 1000, ordre: 3 },
];

describe("cours de change : mois d'une date", () => {
  it("lit l'année et le mois d'une date ISO ou française", () => {
    expect(anneeMois("2025-03-31")).toEqual({ annee: 2025, mois: 3 });
    expect(anneeMois("31/03/2025")).toEqual({ annee: 2025, mois: 3 });
    expect(anneeMois("5-1-2026")).toEqual({ annee: 2026, mois: 1 });
    expect(anneeMois("")).toBeNull();
    expect(anneeMois("2025-13-01")).toBeNull();
    expect(anneeMois(undefined)).toBeNull();
  });

  it("trouve le cours du mois de la date pour la devise, sans tenir compte de la casse", () => {
    expect(coursDuMois(cours, "eur", "2025-02-14")?.cours).toBe(3.3128);
    expect(coursDuMois(cours, "EUR", "2024-12-31")?.cours).toBe(3.4);
    expect(coursDuMois(cours, "EUR", "2025-03-01")).toBeUndefined();
    expect(coursDuMois(cours, "GBP", "2025-01-10")).toBeUndefined();
    expect(coursDuMois(cours, "EUR", "")).toBeUndefined();
  });

  it("ramène le cours à une unité (yen coté pour 1000)", () => {
    expect(coursParUnite({ devise: "JPY", annee: 2025, mois: 1, cours: 18.5199 }, devises)).toBe(0.0185199);
    expect(coursParUnite({ devise: "EUR", annee: 2025, mois: 1, cours: 3.3167 }, devises)).toBe(3.3167);
  });

  it("calcule la moyenne d'une année et liste les années", () => {
    expect(moyenneAnnee(cours, "EUR", 2025)).toBe(3.3148);
    expect(moyenneAnnee(cours, "EUR", 2023)).toBeUndefined();
    expect(anneesAvecCours(cours)).toEqual([2025, 2024]);
  });
});

describe("coller un tableau de cours", () => {
  const colle = [
    "Dollar des USA (USD) Unité:1\tLivre Sterling (GBP) Unité:1\tEURO (EUR) Unité:1",
    "31/01/2025\t3,2000\t3,9556\t3,3167",
    "28/02/2025\t3,1824\t3,9917\t3,3128",
    "31/12/2025\t2,9163\t3,9158\t3,4051",
  ].join("\n");

  it("lit une ligne par mois, dans l'ordre des devises de l'en-tête", () => {
    const r = lireCoursCollés(colle, ["USD", "GBP", "EUR"]);
    expect(r.devises).toEqual(["USD", "GBP", "EUR"]);
    expect(r.cours).toHaveLength(9);
    expect(r.cours.filter((c) => c.mois === 1)).toEqual([
      { devise: "USD", annee: 2025, mois: 1, cours: 3.2 },
      { devise: "GBP", annee: 2025, mois: 1, cours: 3.9556 },
      { devise: "EUR", annee: 2025, mois: 1, cours: 3.3167 },
    ]);
    expect(r.cours.find((c) => c.mois === 12 && c.devise === "EUR")?.cours).toBe(3.4051);
    expect(r.ignorees).toBe(0);
  });

  it("accepte des colonnes séparées par des espaces et un simple code de devise en en-tête", () => {
    const r = lireCoursCollés("USD  EUR\n31/03/2025  3,1038  3,3497", ["USD", "EUR"]);
    expect(r.cours).toEqual([
      { devise: "USD", annee: 2025, mois: 3, cours: 3.1038 },
      { devise: "EUR", annee: 2025, mois: 3, cours: 3.3497 },
    ]);
  });

  it("ignore les lignes sans valeur ou sans en-tête de devise", () => {
    expect(lireCoursCollés("31/01/2025 3,2", ["USD"]).cours).toEqual([]);
    const r = lireCoursCollés("USD\n31/01/2025\tabc\n31/02/2025\t3,2", ["USD"]);
    expect(r.cours).toEqual([{ devise: "USD", annee: 2025, mois: 2, cours: 3.2 }]);
    expect(r.ignorees).toBe(1);
  });

  it("signale les devises de l'en-tête qui ne sont pas encore connues", () => {
    const r = lireCoursCollés("Franc suisse (CHF)\n31/01/2025\t3,5", ["USD"]);
    expect(r.devises).toEqual(["CHF"]);
    expect(r.cours[0]).toMatchObject({ devise: "CHF", cours: 3.5 });
  });
});
