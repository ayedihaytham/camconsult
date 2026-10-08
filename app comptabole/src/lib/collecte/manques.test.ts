import { describe, expect, it } from "vitest";
import { computeManques } from "./manques";
import type { CollecteFull } from "@/types";

const collecte = (lignes: Record<string, unknown>[]) =>
  ({
    id: "c", onglets: ["bordereaux_remise_cheques"], sections: [], notes: [], fichiers: [],
    lignes: lignes.map((data, ordre) => ({ id: `l${ordre}`, onglet: "bordereaux_remise_cheques", ordre, data })),
  }) as unknown as CollecteFull;

const cases = (c: CollecteFull) => computeManques(c).map((m) => `${(m.ordre ?? 0) + 1}:${m.col}`);

describe("cases à compléter d'un bordereau de remise", () => {
  const complete = { date_remise: "2026-10-08", num_bordereau: "255558", banque: "BNK", num_cheque: "1", client_emetteur: "X", date_valeur: "2026-10-09", observations: "ok" };

  it("demande le montant du bordereau sur la première ligne seulement", () => {
    const c = collecte([{ ...complete, montant_cheque: 30000 }, { ...complete, montant_cheque: 20000 }, { ...complete, montant_cheque: 10000 }]);
    expect(cases(c)).toEqual(["1:montant"]);
  });

  it("n'exige pas le montant du bordereau sur les lignes suivantes, mais bien le montant de chaque chèque", () => {
    const c = collecte([{ ...complete, montant: 60000, montant_cheque: 30000 }, { ...complete }, { ...complete, montant_cheque: "" }]);
    expect(cases(c)).toEqual(["2:montant_cheque", "3:montant_cheque"]);
  });

  it("demande le montant sur la première ligne de chaque bordereau", () => {
    const c = collecte([{ ...complete, montant: 100, montant_cheque: 100 }, { ...complete, num_bordereau: "255559", montant_cheque: 50 }]);
    expect(cases(c)).toEqual(["2:montant"]);
  });
});
