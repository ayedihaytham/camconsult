import { describe, expect, it } from "vitest";
import { statutSwift } from "./etatSwift.js";

describe("statut d'un virement SWIFT", () => {
  it("à justifier sans facture, en cours tant qu'il reste, justifié au montant exact, écart au dépassement", () => {
    expect(statutSwift(1000, 0, 0)).toBe("a_justifier");
    expect(statutSwift(1000, 400, 1)).toBe("en_cours");
    expect(statutSwift(1000.5, 1000.5, 2)).toBe("justifie");
    expect(statutSwift(1000, 1000.4, 2)).toBe("ecart");
  });
});
