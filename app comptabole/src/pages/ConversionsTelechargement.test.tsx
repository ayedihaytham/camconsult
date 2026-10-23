// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { PdfTextItem } from "@/lib/pdfToTables";
import { ConversionsPage } from "./ConversionsPage";

const { download } = vi.hoisted(() => ({ download: vi.fn() }));

vi.mock("@/lib/export", async (original) => ({ ...(await original<typeof import("@/lib/export")>()), download }));
vi.mock("@/lib/fichierImport", async (original) => ({ ...(await original<typeof import("@/lib/fichierImport")>()), lireTamponClasseur: vi.fn(async () => new ArrayBuffer(8)) }));
vi.mock("@/lib/classeurFeuilles", () => ({
  feuillesDeClasseur: vi.fn(async () => [
    { name: "Balance", headerRow: true, rows: [["Compte", "Libellé", "Débit", "Crédit"], ["101000", "Capital", 0, 10000.5], ["411000", "Clients", 12345.678, 0], ["512000", "Banque", 999999.999, 0]] },
  ]),
}));

// Un petit tableau de trois lignes et trois colonnes, comme le lirait pdf.js.
const texte = (str: string, x: number, y: number): PdfTextItem => ({ str, x, y, w: 70, h: 10 });
const PAGES: PdfTextItem[][] = [
  [
    texte("Compte", 50, 700), texte("Libellé", 200, 700), texte("Montant", 350, 700),
    texte("101000", 50, 680), texte("Capital", 200, 680), texte("10 000,500", 350, 680),
    texte("411000", 50, 660), texte("Clients", 200, 660), texte("12 345,678", 350, 660),
    texte("512000", 50, 640), texte("Banque", 200, 640), texte("999 999,999", 350, 640),
  ],
];
vi.mock("@/lib/pdfToTables", async (original) => ({ ...(await original<typeof import("@/lib/pdfToTables")>()), lireFichierPdf: vi.fn(async () => PAGES) }));

function afficher() {
  render(
    <MemoryRouter>
      <ConversionsPage />
    </MemoryRouter>,
  );
}
const deposer = (...noms: string[]) => {
  const entree = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(entree, { target: { files: noms.map((n) => new File(["x"], n)) } });
};
/** Octets d'un Blob (le Blob de jsdom n'a pas arrayBuffer). */
const octets = (blob: Blob) =>
  new Promise<Uint8Array>((resolve) => {
    const lecteur = new FileReader();
    lecteur.onload = () => resolve(new Uint8Array(lecteur.result as ArrayBuffer));
    lecteur.readAsArrayBuffer(blob);
  });
const dernierAppel = () => download.mock.calls[download.mock.calls.length - 1] as [Blob, string];

describe("téléchargement du fichier converti : PDF, Excel ou texte, quel que soit le sens", () => {
  beforeEach(() => {
    download.mockClear();
    URL.createObjectURL = vi.fn(() => "blob:test");
    URL.revokeObjectURL = vi.fn();
  });
  afterEach(cleanup);

  it("Excel vers PDF : le fichier converti se télécharge aussi en Excel et en texte, en plus du PDF", async () => {
    afficher();
    deposer("balance.xlsx");
    const excel = await screen.findByRole("button", { name: "Télécharger l'Excel" });
    expect(screen.getByRole("button", { name: "Télécharger le PDF" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Texte (.txt)" })).toBeTruthy();

    fireEvent.click(excel);
    await waitFor(() => expect(download).toHaveBeenCalledTimes(1));
    const [blob, nom] = dernierAppel();
    expect(nom).toBe("balance.xlsx");
    expect(blob.type).toContain("spreadsheetml");

    fireEvent.click(screen.getByRole("button", { name: "Texte (.txt)" }));
    await waitFor(() => expect(download).toHaveBeenCalledTimes(2));
    expect(dernierAppel()[1]).toBe("balance.txt");
  });

  it("PDF vers Excel : le fichier converti se télécharge aussi en PDF, en plus de l'Excel et du texte", async () => {
    afficher();
    fireEvent.click(screen.getByRole("button", { name: "PDF vers Excel" }));
    deposer("releve.pdf");
    const pdf = await screen.findByRole("button", { name: "Télécharger le PDF" });
    expect(screen.getByRole("button", { name: "Télécharger l'Excel" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Texte brut (.txt)" })).toBeTruthy();

    fireEvent.click(pdf);
    await waitFor(() => expect(download).toHaveBeenCalledTimes(1));
    const [blob, nom] = dernierAppel();
    expect(nom).toBe("releve.pdf");
    expect(blob.type).toBe("application/pdf");
    expect(new TextDecoder().decode((await octets(blob)).slice(0, 5))).toBe("%PDF-");

    fireEvent.click(screen.getByRole("button", { name: "Télécharger l'Excel" }));
    await waitFor(() => expect(download).toHaveBeenCalledTimes(2));
    expect(dernierAppel()[1]).toBe("releve.xlsx");
  });

  it("« Tout télécharger » prend le format choisi pour tous les fichiers convertis", async () => {
    afficher();
    fireEvent.click(screen.getByRole("button", { name: "PDF vers Excel" }));
    deposer("a.pdf", "b.pdf");
    await screen.findAllByRole("button", { name: "Télécharger le PDF" });
    await waitFor(() => expect((screen.getByRole("button", { name: "Tout télécharger" }) as HTMLButtonElement).disabled).toBe(false));
    const format = screen.getByRole("combobox", { name: "Format du téléchargement groupé" }) as HTMLSelectElement;
    expect(within(format).getAllByRole("option").map((o) => o.textContent)).toEqual(["Excel", "PDF", "Texte brut (.txt)"]);
    fireEvent.change(format, { target: { value: "txt" } });
    fireEvent.click(screen.getByRole("button", { name: "Tout télécharger" }));
    await waitFor(() => expect(download).toHaveBeenCalledTimes(2));
    expect(download.mock.calls.map((c) => (c as [Blob, string])[1]).sort()).toEqual(["a.txt", "b.txt"]);
  });

  it("Excel vers PDF : « Tout télécharger » propose PDF, Excel et texte", async () => {
    afficher();
    deposer("a.xlsx", "b.xlsx");
    await screen.findAllByRole("button", { name: "Télécharger l'Excel" });
    await waitFor(() => expect((screen.getByRole("button", { name: "Tout télécharger" }) as HTMLButtonElement).disabled).toBe(false));
    const format = screen.getByRole("combobox", { name: "Format du téléchargement groupé" }) as HTMLSelectElement;
    expect(within(format).getAllByRole("option").map((o) => o.textContent)).toEqual(["PDF", "Excel", "Texte (.txt)"]);
    fireEvent.change(format, { target: { value: "xlsx" } });
    fireEvent.click(screen.getByRole("button", { name: "Tout télécharger" }));
    await waitFor(() => expect(download).toHaveBeenCalledTimes(2));
    expect(download.mock.calls.map((c) => (c as [Blob, string])[1]).sort()).toEqual(["a.xlsx", "b.xlsx"]);
  });

  it("le fichier affiché se télécharge aussi depuis l'aperçu, sans descendre jusqu'à la file", async () => {
    afficher();
    fireEvent.click(screen.getByRole("button", { name: "PDF vers Excel" }));
    deposer("releve.pdf");
    const barre = await screen.findByRole("group", { name: "Télécharger le fichier affiché" });
    for (const nom of ["Télécharger l'Excel affiché", "Télécharger le PDF affiché", "Télécharger les écritures affichées", "Télécharger le texte brut affiché"]) {
      expect(within(barre).getByRole("button", { name: nom })).toBeTruthy();
    }
    fireEvent.click(within(barre).getByRole("button", { name: "Télécharger le texte brut affiché" }));
    await waitFor(() => expect(download).toHaveBeenCalledTimes(1));
    expect(dernierAppel()[1]).toBe("releve.txt");
  });
});
