import { describe, expect, it } from "vitest";
import { completerCours, coursAutoInitial, coursTndDeRepli, coursUsdDeRepli, montantCote } from "./coursStock";
import type { CoursChange, DeviseChange, StockLigne } from "@/types";

const devises: DeviseChange[] = [
  { code: "USD", libelle: "Dollar", unite: 1, ordre: 1 },
  { code: "EUR", libelle: "Euro", unite: 1, ordre: 2 },
  { code: "JPY", libelle: "Yen", unite: 1000, ordre: 3 },
];
const cours: CoursChange[] = [
  { devise: "USD", annee: 2026, mois: 3, cours: 3 },
  { devise: "EUR", annee: 2026, mois: 3, cours: 3.3 },
  { devise: "JPY", annee: 2026, mois: 3, cours: 20 },
];
const tables = { cours, devises };
const ligne = (montantDevise: number, montantTnd = 0): StockLigne => ({ designation: "P", quantite: 1, prixUnitaire: montantDevise, montantDevise, montantTnd });

const mouvement = (patch: Record<string, unknown> = {}) => ({
  achatDate: "2026-03-15" as string | null,
  achatDevise: "EUR",
  achatCours: 0,
  achatCoursUsd: 0,
  achatLignes: [ligne(1000)],
  venteDate: "2026-03-20" as string | null,
  venteDevise: "EUR",
  venteCours: 0,
  venteCoursUsd: 0,
  venteLignes: [ligne(1200)],
  douaneTauxChange: 0,
  ...patch,
});

describe("cours de repli", () => {
  it("dinars : le taux de la douane passe avant le cours moyen du mois", () => {
    expect(coursTndDeRepli("EUR", "2026-03-15", 3.25, tables)).toEqual({ valeur: 3.25, source: "douane" });
    expect(coursTndDeRepli("EUR", "2026-03-15", 0, tables)).toEqual({ valeur: 3.3, source: "moyen" });
  });

  it("dinars : rien pour le dinar, une devise sans cours ou une date sans mois enregistré", () => {
    expect(coursTndDeRepli("TND", "2026-03-15", 0, tables)).toBeNull();
    expect(coursTndDeRepli("GBP", "2026-03-15", 0, tables)).toBeNull();
    expect(coursTndDeRepli("EUR", "2026-04-15", 0, tables)).toBeNull();
  });

  it("dinars : une devise cotée par 1000 est ramenée à l'unité", () => {
    expect(coursTndDeRepli("JPY", "2026-03-15", 0, tables)?.valeur).toBe(0.02);
  });

  it("dollar : cours croisé = cours en dinars de la devise ÷ cours du dollar du même mois", () => {
    expect(coursUsdDeRepli("EUR", "2026-03-15", 3.3, tables)).toBe(1.1);
    expect(coursUsdDeRepli("EUR", "2026-03-15", 3.0, tables)).toBe(1);
  });

  it("dollar : 1 pour le dollar, rien pour le dinar, rien sans cours du dollar ni cours en dinars", () => {
    expect(coursUsdDeRepli("USD", "2026-03-15", 0, tables)).toBe(1);
    expect(coursUsdDeRepli("TND", "2026-03-15", 3.3, tables)).toBeNull();
    expect(coursUsdDeRepli("EUR", "2026-04-15", 3.3, tables)).toBeNull();
    expect(coursUsdDeRepli("EUR", "2026-03-15", 0, tables)).toBeNull();
  });
});

describe("complétion des cours d'une facture", () => {
  it("sans cours ni douane : cours moyen du mois (dinars) et cours croisé (dollar), montants en dinars recalculés", () => {
    const auto = coursAutoInitial();
    const r = completerCours(mouvement(), "achat", auto, tables);
    expect(r.achatCours).toBe(3.3);
    expect(r.achatCoursUsd).toBe(1.1);
    expect(r.achatLignes[0].montantTnd).toBe(3300);
    expect(r.venteCours).toBe(0); // l'autre côté n'est pas touché
  });

  it("avec un taux de douane : il passe avant le cours moyen du mois", () => {
    const r = completerCours(mouvement({ douaneTauxChange: 3.24 }), "vente", coursAutoInitial(), tables);
    expect(r.venteCours).toBe(3.24);
    expect(r.venteCoursUsd).toBe(1.08);
  });

  it("un cours saisi sur la facture n'est jamais remplacé, ni par la douane ni par le cours du mois ; le dollar suit s'il est automatique", () => {
    const auto = { ...coursAutoInitial(), achat: false };
    const r = completerCours(mouvement({ achatCours: 3.6, douaneTauxChange: 3.24 }), "achat", auto, tables);
    expect(r.achatCours).toBe(3.6);
    expect(r.achatCoursUsd).toBe(1.2); // 3,6 ÷ 3
  });

  it("un cours du dollar saisi à la main est gardé", () => {
    const auto = { ...coursAutoInitial(), achat: false, achatUsd: false };
    const r = completerCours(mouvement({ achatCours: 3.6, achatCoursUsd: 1.5 }), "achat", auto, tables);
    expect(r.achatCoursUsd).toBe(1.5);
  });

  it("un cours automatique est mis à jour quand la date change de mois, tant que personne ne l'a saisi", () => {
    const auto = coursAutoInitial();
    const mars = completerCours(mouvement(), "achat", auto, tables);
    const autre = [...cours, { devise: "EUR", annee: 2026, mois: 4, cours: 3.5 }, { devise: "USD", annee: 2026, mois: 4, cours: 3.1 }];
    const avril = completerCours({ ...mars, achatDate: "2026-04-02" }, "achat", auto, { cours: autre, devises });
    expect(avril.achatCours).toBe(3.5);
    expect(avril.achatCoursUsd).toBeCloseTo(1.129032, 6);
  });

  it("dinar : aucun cours", () => {
    const r = completerCours(mouvement({ achatDevise: "TND" }), "achat", coursAutoInitial(), tables);
    expect(r.achatCours).toBe(0);
    expect(r.achatCoursUsd).toBe(0);
  });
});

describe("montants dans la monnaie choisie", () => {
  it("dinars : somme des montants en dinars ; dollars : montant en devise × cours du dollar", () => {
    const lignes = [ligne(1000, 3300), ligne(500, 1650)];
    expect(montantCote(lignes, 1.1, "TND")).toBe(4950);
    expect(montantCote(lignes, 1.1, "USD")).toBe(1650);
    expect(montantCote(lignes, undefined, "USD")).toBe(0);
  });
});

describe("cours en dollars saisis dans « Cours de change »", () => {
  const coursUsd: CoursChange[] = [{ devise: "EUR", annee: 2026, mois: 3, cours: 1.0842 }];

  it("le cours en dollars du mois passe avant le cours croisé calculé", () => {
    expect(coursUsdDeRepli("EUR", "2026-03-15", 3.3, { ...tables, coursUsd })).toBe(1.0842);
    expect(coursUsdDeRepli("EUR", "2026-03-15", 3.3, tables)).toBe(1.1);
  });

  it("sans cours en dollars pour ce mois, on retombe sur le cours croisé", () => {
    expect(coursUsdDeRepli("EUR", "2026-04-15", 3.3, { ...tables, coursUsd })).toBeNull();
    expect(coursUsdDeRepli("EUR", "2026-03-15", 3.3, { cours, devises, coursUsd: [] })).toBe(1.1);
  });

  it("complète la facture avec le cours en dollars saisi, sans dépendre du cours en dinars", () => {
    const r = completerCours(mouvement(), "achat", coursAutoInitial(), { ...tables, coursUsd });
    expect(r.achatCoursUsd).toBe(1.0842);
    expect(r.achatCours).toBe(3.3);
  });

  it("une devise cotée par 1000 est ramenée à l'unité, comme en dinars", () => {
    const jpy: CoursChange[] = [{ devise: "JPY", annee: 2026, mois: 3, cours: 6.5 }];
    expect(coursUsdDeRepli("JPY", "2026-03-15", 0, { ...tables, coursUsd: jpy })).toBe(0.0065);
  });
});
