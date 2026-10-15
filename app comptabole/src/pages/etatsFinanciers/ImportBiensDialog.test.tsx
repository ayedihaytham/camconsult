// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ImportBiensDialog, messageIgnoreesDate, parseRows } from "./ImportBiensDialog";

// Données SYNTHÉTIQUES uniquement.
const contenu = vi.hoisted(() => ({ csv: "" }));
vi.mock("@/lib/fichierImport", () => ({
  lireTamponClasseur: async () => Array.from(new TextEncoder().encode(contenu.csv)) as unknown as ArrayBuffer, // tableau d'octets : évite les écarts d'ArrayBuffer entre domaines (jsdom)
  messageImport: (_e: unknown, defaut: string) => defaut,
}));
const { bulkAddBiens, fetchCategories } = vi.hoisted(() => ({ bulkAddBiens: vi.fn(async (_s: string, r: unknown[]) => r.length), fetchCategories: vi.fn(async () => undefined) }));
vi.mock("@/store/immobilisations", () => ({ useImmobilisations: (sel: (s: unknown) => unknown) => sel({ bulkAddBiens, fetchCategories }) }));

const ENTETE = ["Catégorie", "Libellé", "Date d'acquisition", "Coût", "Taux"];

describe("parseRows : lignes ignorées pour date d'acquisition invalide", () => {
  const ligne = (cat: string, date: unknown) => [cat, "Bien", date, 1000.5, 10];

  it("ligne valide : parsée comme avant (date AAAA-MM-JJ), aucune ligne ignorée", () => {
    const r = parseRows([ENTETE, ligne("Matériel", "31/08/2026")]);
    expect(r.ignoreesDate).toBe(0);
    expect(r.biens).toEqual([{ categorieNom: "Matériel", masse: "corporelle", libelle: "Bien", dateAcquisition: "2026-08-31", coutAcquisition: 1000.5, taux: 10 }]);
  });
  it("une date impossible ou illisible avec catégorie : comptée une fois, non importée", () => {
    const r = parseRows([ENTETE, ligne("Matériel", "31/02/2026")]);
    expect(r.biens).toHaveLength(0);
    expect(r.ignoreesDate).toBe(1);
  });
  it("plusieurs dates invalides : toutes comptées, chacune une fois (texte, absente, mois 13, année non bissextile)", () => {
    const r = parseRows([ENTETE, ligne("A", "n'importe quoi"), ligne("B", ""), ligne("C", "01/13/2026"), ligne("D", "29/02/2027")]);
    expect(r.ignoreesDate).toBe(4);
    expect(r.biens).toHaveLength(0);
  });
  it("mélange : les valides restent, les invalides sont comptées", () => {
    const r = parseRows([ENTETE, ligne("A", "29/02/2028"), ligne("B", "30/02/2028"), ligne("C", new Date(2026, 0, 1)), ligne("D", "x")]);
    expect(r.biens.map((b) => b.dateAcquisition)).toEqual(["2028-02-29", "2026-01-01"]);
    expect(r.ignoreesDate).toBe(2);
  });
  it("lignes vides, sans catégorie, et en-tête : jamais comptées", () => {
    const r = parseRows([ENTETE, [], ["", "", "", "", ""], ["", "Total", "", 5000, ""], ligne("  ", "31/02/2026"), ligne("A", "01/01/2026")]);
    expect(r.ignoreesDate).toBe(0);
    expect(r.biens).toHaveLength(1);
  });
  it("sans en-tête reconnu : rien d'importé, rien de compté", () => {
    expect(parseRows([["a", "b"], ["x", "31/02/2026"]])).toEqual({ biens: [], ignoreesDate: 0 });
  });
  it("le message utilise le nombre réel", () => {
    expect(messageIgnoreesDate(3)).toBe("3 ligne(s) ignorée(s) : date d’acquisition invalide.");
  });
});

describe("ImportBiensDialog : avertissement de l'aperçu", () => {
  beforeEach(() => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    bulkAddBiens.mockClear();
  });

  async function choisir(csv: string) {
    contenu.csv = csv;
    render(<ImportBiensDialog open onOpenChange={() => undefined} societeId="s1" />);
    const entree = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(entree, { target: { files: [new File(["x"], "biens.csv", { type: "text/csv" })] } });
  }
  // En-têtes sans accents : le décodage des CSV accentués par la bibliothèque est hors périmètre de cette PR.
  const entete = "Categorie,Libelle,Date d'acquisition,Cout,Taux\n";

  it("avec des lignes invalides : avertissement visible avant confirmation, nombre exact, biens reconnus inchangé", async () => {
    await choisir(entete + "Materiel,A,31/08/2026,100,10\nMobilier,B,31/02/2026,200,10\nMobilier,C,pas une date,300,10\n");
    const alerte = await screen.findByRole("alert");
    expect(alerte.textContent).toContain("2 ligne(s) ignorée(s) : date d’acquisition invalide.");
    expect(alerte.textContent).toContain("ne seront pas importées");
    expect(screen.getByText("bien(s) reconnu(s)", { exact: false }).textContent).toContain("1");
    expect(screen.getByRole("button", { name: /Importer 1 bien/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Importer 1 bien/ }));
    await waitFor(() => expect(bulkAddBiens).toHaveBeenCalledTimes(1));
    expect((bulkAddBiens.mock.calls[0] as unknown[])[1]).toHaveLength(1);
  });

  it("sans ligne invalide : aucun avertissement", async () => {
    await choisir(entete + "Materiel,A,31/08/2026,100,10\nMobilier,B,01/01/2026,200,10\n\n");
    await screen.findByText("bien(s) reconnu(s)", { exact: false });
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
