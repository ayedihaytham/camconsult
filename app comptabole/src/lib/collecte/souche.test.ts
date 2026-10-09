import { describe, expect, it } from "vitest";
import { lignesSouchePourEtat } from "./souche";

const ligne = (onglet: string, ordre: number, data: Record<string, unknown>) => ({ id: `${onglet}${ordre}`, onglet, ordre, data });

describe("reprise de la souche de chèques dans l'état des chèques émis", () => {
  const souche = [
    ligne("souche_cheques", 0, { date: "2026-01-06", num_cheque: "4001", beneficiaire: "A", montant: 820 }),
    ligne("souche_cheques", 1, { date: "2026-01-07", num_cheque: "4002", beneficiaire: "B", montant: 100 }),
    ligne("souche_cheques", 2, { date: "2026-01-08", num_cheque: "", beneficiaire: "C", montant: 50 }),
  ];

  it("reprend toutes les lignes de la souche quand l'état est vide, dans l'ordre", () => {
    expect(lignesSouchePourEtat({ lignes: souche }).map((r) => r.beneficiaire)).toEqual(["A", "B", "C"]);
  });

  it("ne reprend pas ce que l'état contient déjà (même n° de chèque, ou même date, bénéficiaire et montant)", () => {
    const etat = [
      ligne("etat_cheques_emis", 0, { date: "2026-02-01", num_cheque: " 4001 ", beneficiaire: "A (corrigé)", montant: 820 }),
      ligne("etat_cheques_emis", 1, { date: "2026-01-08", num_cheque: "", beneficiaire: "c", montant: 50 }),
    ];
    expect(lignesSouchePourEtat({ lignes: [...souche, ...etat] }).map((r) => r.num_cheque)).toEqual(["4002"]);
  });

  it("ne reprend rien quand tout est déjà là, et copie les lignes sans les lier à la souche", () => {
    const etat = souche.map((l, i) => ligne("etat_cheques_emis", i, l.data));
    expect(lignesSouchePourEtat({ lignes: [...souche, ...etat] })).toEqual([]);
    const reprise = lignesSouchePourEtat({ lignes: souche });
    reprise[0].beneficiaire = "modifié";
    expect(souche[0].data.beneficiaire).toBe("A");
  });
});
