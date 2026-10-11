import { describe, expect, it } from "vitest";
import { etatCours } from "./StockPage";

describe("état des cours de change d'une société, à l'accueil du stock", () => {
  it("ne dit rien d'une société sans mouvement en devise", () => {
    expect(etatCours(undefined)).toEqual({ label: "—", tone: "none" });
    expect(etatCours({ enDevise: 0, coursManquants: 0 })).toEqual({ label: "—", tone: "none" });
  });

  it("signale les cours à saisir, sinon « Saisi »", () => {
    expect(etatCours({ enDevise: 3, coursManquants: 2 })).toEqual({ label: "2 à saisir", tone: "warn" });
    expect(etatCours({ enDevise: 3, coursManquants: 0 })).toEqual({ label: "Saisi", tone: "ok" });
  });
});
