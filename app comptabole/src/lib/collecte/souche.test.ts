import { describe, expect, it } from "vitest";
import { lignesSouchePourEtat, plageNumeros } from "./souche";

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

describe("plage de numéros d'une souche", () => {
  it("crée un numéro par chèque, du premier au dernier inclus", () => {
    expect(plageNumeros("4001001", "4001005")).toEqual({ ok: true, numeros: ["4001001", "4001002", "4001003", "4001004", "4001005"] });
    expect(plageNumeros(" 12 ", "12")).toEqual({ ok: true, numeros: ["12"] });
  });

  it("garde les zéros de tête et un préfixe commun", () => {
    expect(plageNumeros("0098", "0101")).toEqual({ ok: true, numeros: ["0098", "0099", "0100", "0101"] });
    expect(plageNumeros("CH12", "CH14")).toEqual({ ok: true, numeros: ["CH12", "CH13", "CH14"] });
  });

  it("refuse une plage vide, inversée, sans chiffres, de préfixes différents ou trop grande", () => {
    const erreur = (d: string, f: string) => {
      const r = plageNumeros(d, f);
      return r.ok ? null : r.erreur;
    };
    expect(erreur("", "5")).toMatch(/premier et le dernier/);
    expect(erreur("10", "9")).toMatch(/supérieur ou égal/);
    expect(erreur("abc", "abd")).toMatch(/chiffres/);
    expect(erreur("A1", "B3")).toMatch(/même début/);
    expect(erreur("1", "100000")).toMatch(/Au plus 500/);
  });
});
