// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { ecrireBrouillon, effacerBrouillon, effacerTousLesBrouillons, lireBrouillon } from "./brouillons";

beforeEach(() => effacerTousLesBrouillons());

describe("brouillons", () => {
  it("garde une saisie et la rend telle quelle", () => {
    ecrireBrouillon("a", { rows: [{ x: 1 }], base: "b" });
    expect(lireBrouillon("a")).toEqual({ rows: [{ x: 1 }], base: "b" });
    expect(lireBrouillon("autre")).toBeNull();
  });

  it("survit à un rechargement de l'onglet (sessionStorage) et s'efface sur demande", () => {
    ecrireBrouillon("a", { v: 1 });
    expect(sessionStorage.getItem("camconsult:brouillon:a")).toContain('"v":1');
    effacerBrouillon("a");
    expect(lireBrouillon("a")).toBeNull();
    expect(sessionStorage.getItem("camconsult:brouillon:a")).toBeNull();
  });

  it("si le stockage est refusé, le brouillon reste en mémoire", () => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new DOMException("plein", "QuotaExceededError");
    };
    try {
      ecrireBrouillon("gros", { v: 2 });
      expect(lireBrouillon("gros")).toEqual({ v: 2 });
    } finally {
      Storage.prototype.setItem = set;
    }
  });

  it("à la déconnexion, tous les brouillons disparaissent, y compris ceux du stockage de l'onglet", () => {
    ecrireBrouillon("a", 1);
    ecrireBrouillon("b", 2);
    sessionStorage.setItem("autre-cle", "garde");
    effacerTousLesBrouillons();
    expect(lireBrouillon("a")).toBeNull();
    expect(lireBrouillon("b")).toBeNull();
    expect(sessionStorage.getItem("autre-cle")).toBe("garde");
  });
});
