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
