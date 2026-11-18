import { describe, expect, it } from "vitest";
import { mosaique } from "./mosaique";

describe("mosaïque du portefeuille", () => {
  it("couvre toute la surface et donne à chaque tuile une aire proportionnelle à son poids", () => {
    const items = [{ id: "a", p: 6 }, { id: "b", p: 3 }, { id: "c", p: 2 }, { id: "d", p: 1 }];
    const tuiles = mosaique(items, (i) => i.p, 160, 90);
    expect(tuiles).toHaveLength(4);
    const aireTotale = tuiles.reduce((s, t) => s + t.w * t.h, 0);
    expect(aireTotale).toBeCloseTo(160 * 90, 4);
    for (const t of tuiles) expect((t.w * t.h) / aireTotale).toBeCloseTo(t.item.p / 12, 4);
    for (const t of tuiles) { expect(t.x).toBeGreaterThanOrEqual(-1e-9); expect(t.x + t.w).toBeLessThanOrEqual(160 + 1e-9); expect(t.y + t.h).toBeLessThanOrEqual(90 + 1e-9); }
  });
  it("renvoie une liste vide sans élément", () => {
    expect(mosaique([], () => 1, 100, 100)).toEqual([]);
  });
});
