import { describe, it, expect } from "vitest";
import { buildCsv } from "./export";

interface Row {
  nom: string;
  note: string;
}

describe("buildCsv", () => {
  const cols = [
    { header: "Nom", value: (r: Row) => r.nom },
    { header: "Note", value: (r: Row) => r.note },
  ];

  it("commence par un BOM UTF-8 et l'en-tête", () => {
    const csv = buildCsv<Row>([], cols);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain("Nom;Note");
  });

  it("échappe les valeurs contenant ; \" ou saut de ligne", () => {
    const csv = buildCsv<Row>(
      [{ nom: 'Dupont; "SARL"', note: "ligne1\nligne2" }],
      cols,
    );
    expect(csv).toContain('"Dupont; ""SARL"""');
    expect(csv).toContain('"ligne1\nligne2"');
  });

  it("sépare les lignes par un retour chariot", () => {
    const csv = buildCsv<Row>(
      [
        { nom: "A", note: "1" },
        { nom: "B", note: "2" },
      ],
      cols,
    );
    const lines = csv.split("\n");
    expect(lines).toHaveLength(3); // en-tête + 2 lignes
    expect(lines[1]).toBe("A;1");
  });
});

import { neutraliserFormule } from "./export";

describe("injection de formules dans le CSV exporté", () => {
  it.each(["=1+1", "=cmd|' /C calc'!A0", "+SUM(A1)", "@SUM(1)", "-2+3", "\tx", "\rx", "-cmd"])("neutralise %j", (v) => {
    expect(neutraliserFormule(v)).toBe("'" + v);
  });

  it("laisse intacts les textes ordinaires et les montants", () => {
    for (const v of ["Société A", "", "12,500", "-4 500,500", "+1.234,567", "0.3", "a=b", "x-y"]) expect(neutraliserFormule(v)).toBe(v);
  });

  it("buildCsv : un libellé hostile est neutralisé, un nombre négatif reste un nombre", () => {
    const csv = buildCsv([{ nom: "=HYPERLINK(\"http://x\")", montant: -4500.5 }], [
      { header: "Nom", value: (r: { nom: string; montant: number }) => r.nom },
      { header: "Montant", value: (r: { nom: string; montant: number }) => r.montant },
    ]);
    const ligne = csv.split("\n")[1];
    expect(ligne.startsWith("\"'=HYPERLINK")).toBe(true);
    expect(ligne.endsWith(";-4500.5")).toBe(true);
  });
});

describe("injection de formules : cas complémentaires de la revue", () => {
  it.each([" =1+1", "  +SUM(A1)", "\u0001=1", " =1".replace(" ", " "), "\t-2+3", "\r=1", "\n=1"])("neutralise %j (caractères avant le premier signe)", (v) => {
    expect(neutraliserFormule(v)).toBe("'" + v);
  });

  it("conserve les textes ordinaires, unicode, identifiants et montants, sans double préfixe", () => {
    for (const v of ["Société Ünïcode é", "日本語", "REF-2026-001", "a=b", "12-34", "-4 500,500", "-0.001", "+1.234,567", "1234.567", "'=déjà préfixé", "x@y.tn"]) {
      expect(neutraliserFormule(v)).toBe(v);
    }
    const une = neutraliserFormule("=1+1");
    expect(neutraliserFormule(une)).toBe(une);
  });

  it("buildCsv : guillemets, point-virgule, retours à la ligne et CR sont correctement protégés, et le préfixe précède la mise entre guillemets", () => {
    const cols = [{ header: "A", value: (r: { a: string }) => r.a }];
    const lignes = buildCsv([{ a: "=a;b" }, { a: 'dit "oui"' }, { a: "l1\r\nl2" }, { a: "l1\rl2" }], cols).split("\n");
    expect(lignes[1]).toBe("\"'=a;b\"");
    expect(lignes[2]).toBe('"dit ""oui"""');
    expect(buildCsv([{ a: "l1\rl2" }], cols)).toContain('"l1\rl2"');
  });

  it("les nombres (type number) ne sont jamais transformés en texte : négatifs, décimales, zéro", () => {
    const cols = [{ header: "M", value: (r: { m: number }) => r.m }];
    expect(buildCsv([{ m: -4500.5 }, { m: 0.001 }, { m: 0 }, { m: -0.3 }], cols).split("\n").slice(1)).toEqual(["-4500.5", "0.001", "0", "-0.3"]);
  });
});

describe("export XLSX : les chaînes saisies restent des cellules texte (jamais des formules)", () => {
  it("aoa_to_sheet écrit « =1+1 » comme texte, sans formule, et la relecture ne trouve aucune formule", async () => {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.aoa_to_sheet([["=1+1", "+SUM(A1)", "@x", "-2+3", -4500.5]]);
    for (const ref of ["A1", "B1", "C1", "D1"]) {
      expect(ws[ref].t).toBe("s");
      expect(ws[ref].f).toBeUndefined();
    }
    expect(ws.E1.t).toBe("n");
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "S");
    const relu = XLSX.read(XLSX.write(wb, { bookType: "xlsx", type: "array" }), { type: "array" });
    expect(relu.Sheets.S.A1.f).toBeUndefined();
    expect(relu.Sheets.S.A1.v).toBe("=1+1");
  });
});
