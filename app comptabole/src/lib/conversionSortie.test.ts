import { describe, expect, it } from "vitest";
import { FORMATS_SORTIE, fichierConverti, nomSortie } from "./conversionSortie";
import type { PdfSheet } from "./pdfTables";

const feuilles: PdfSheet[] = [
  { name: "Balance", headerRow: true, rows: [["Compte", "Libellé", "Débit", "Crédit"], ["101000", "Capital", 0, 10000.5], ["411000", "Clients", 12345.678, 0]] },
  { name: "Détail", headerRow: true, rows: [["N°", "Montant"], ["1", 999999.999]] },
];

const octets = async (blob: Blob) => new Uint8Array(await blob.arrayBuffer());
const debut = async (blob: Blob, n: number) => String.fromCharCode(...(await octets(blob)).slice(0, n));

describe("fichier converti, dans le format choisi", () => {
  it("propose PDF, Excel et texte, avec leur extension", () => {
    expect(FORMATS_SORTIE.map((f) => f.valeur)).toEqual(["pdf", "xlsx", "txt"]);
    expect(nomSortie("Releve août", "pdf")).toBe("Releve août.pdf");
    expect(nomSortie("Releve août", "xlsx")).toBe("Releve août.xlsx");
    expect(nomSortie("Releve août", "txt")).toBe("Releve août.txt");
  });

  it("Excel : un classeur .xlsx (archive zip) avec une feuille par tableau", async () => {
    const { blob, nom } = await fichierConverti("xlsx", feuilles, "balance");
    expect(nom).toBe("balance.xlsx");
    expect(blob.type).toContain("spreadsheetml");
    expect(await debut(blob, 2)).toBe("PK");
    const XLSX = await import("xlsx");
    const lu = XLSX.read(await octets(blob), { type: "array" });
    expect(lu.SheetNames).toEqual(["Balance", "Détail"]);
    const lignes = XLSX.utils.sheet_to_json<unknown[]>(lu.Sheets["Balance"], { header: 1 });
    expect(lignes[2]).toEqual(["411000", "Clients", 12345.678, 0]);
  });

  it("PDF : un vrai document PDF", async () => {
    const { blob, nom } = await fichierConverti("pdf", feuilles, "balance", { unite: "feuille" });
    expect(nom).toBe("balance.pdf");
    expect(blob.type).toBe("application/pdf");
    expect(await debut(blob, 5)).toBe("%PDF-");
    expect(blob.size).toBeGreaterThan(1000);
  });

  it("texte : le contenu des tableaux, colonnes séparées par une tabulation", async () => {
    const { blob, nom } = await fichierConverti("txt", feuilles, "balance");
    expect(nom).toBe("balance.txt");
    const texte = await blob.text();
    expect(texte).toContain("Compte\tLibellé\tDébit\tCrédit");
    expect(texte).toContain("411000\tClients");
    expect(texte).toContain("999999");
  });

  it("refuse de convertir quand rien n'est retenu", async () => {
    for (const format of ["pdf", "xlsx", "txt"] as const) await expect(fichierConverti(format, [], "vide")).rejects.toThrow("Rien à convertir");
  });
});
