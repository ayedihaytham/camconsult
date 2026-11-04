import { describe, expect, it } from "vitest";
import { changesPossibles, coursMoyenConversions, repartitionConversion } from "./banqueConversion";
import type { MouvementBancaire } from "@/types";

// Mouvements synthétiques.
const mv = (id: string, dateOp: string, debit: number, credit: number, type: MouvementBancaire["type"], extra: Partial<MouvementBancaire> = {}): MouvementBancaire =>
  ({ id, compteId: "eur", dateOp, dateValeur: null, libelle: id, details: "", reference: "", numPiece: "", debit, credit, type, aRevoir: false, note: "", affecteClient: 0, reglementsClient: [], cours: null, reglementId: null, fournisseurCle: null, ...extra }) as MouvementBancaire;

const enc = mv("enc", "2026-02-10", 0, 30000, "encaissement_client");

describe("conversion d'un encaissement en devise", () => {
  it("propose les sorties de change du même compte, à la date de l'encaissement ou après, avec ce qui leur reste", () => {
    const mouvements = [
      enc,
      mv("avant", "2026-02-01", 10000, 0, "change"),
      mv("c1", "2026-02-12", 20000, 0, "change", { changeUtilise: 5000 }),
      mv("c2", "2026-03-01", 15000, 0, "change"),
      mv("plein", "2026-03-05", 8000, 0, "change", { changeUtilise: 8000 }),
      mv("autre", "2026-02-15", 9000, 0, "change", { compteId: "usd" }),
      mv("frais", "2026-02-15", 50, 0, "frais"),
    ];
    expect(changesPossibles(enc, mouvements).map((c) => [c.mouvement.id, c.reste])).toEqual([["c1", 15000], ["c2", 15000]]);
  });

  it("la part déjà donnée à cet encaissement redevient disponible quand on modifie la répartition", () => {
    const deja = { ...enc, conversions: [{ changeId: "c1", montant: 5000, dateOp: "2026-02-12", coursReel: 3.3 }] };
    const c1 = mv("c1", "2026-02-12", 20000, 0, "change", { changeUtilise: 5000 });
    expect(changesPossibles(deja, [deja, c1])[0].reste).toBe(20000);
  });

  it("répartit dans l'ordre des dates et dit ce qui reste non converti", () => {
    const c1 = { mouvement: mv("c1", "2026-02-12", 20000, 0, "change"), reste: 20000 };
    const c2 = { mouvement: mv("c2", "2026-03-01", 15000, 0, "change"), reste: 15000 };
    expect(repartitionConversion(enc, [c1, c2])).toEqual({ parts: [{ changeId: "c1", montant: 20000 }, { changeId: "c2", montant: 10000 }], nonConverti: 0 });
    expect(repartitionConversion(enc, [c1])).toEqual({ parts: [{ changeId: "c1", montant: 20000 }], nonConverti: 10000 });
    expect(repartitionConversion(enc, [])).toEqual({ parts: [], nonConverti: 30000 });
  });

  it("le cours moyen est pondéré par les parts ; il dit s'il est partiel (un change sans cours réel) ou inconnu", () => {
    expect(coursMoyenConversions([
      { changeId: "a", montant: 20000, dateOp: "2026-02-12", coursReel: 3.3 },
      { changeId: "b", montant: 10000, dateOp: "2026-03-01", coursReel: 3.4 },
    ])).toEqual({ cours: 3.3333, converti: 30000, partiel: false });
    expect(coursMoyenConversions([
      { changeId: "a", montant: 20000, dateOp: "2026-02-12", coursReel: 3.3 },
      { changeId: "b", montant: 10000, dateOp: "2026-03-01", coursReel: null },
    ])).toEqual({ cours: 3.3, converti: 30000, partiel: true });
    expect(coursMoyenConversions([{ changeId: "a", montant: 100, dateOp: "2026-02-12", coursReel: null }])).toEqual({ cours: null, converti: 100, partiel: true });
    expect(coursMoyenConversions([])).toEqual({ cours: null, converti: 0, partiel: false });
  });
});
