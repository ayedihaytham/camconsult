// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { TAB_BY_KEY } from "@/lib/collecte/tabs";
import { lireTextePdf } from "@/lib/pdfToTables";
import { CollecteGrid, type CollecteGridHandle } from "./CollecteGrid";
import { ImportDocumentDialog } from "./ImportDocumentDialog";

const { lireFichierPdf } = vi.hoisted(() => ({ lireFichierPdf: vi.fn() }));
vi.mock("@/lib/pdfToTables", async (original) => ({ ...(await original<typeof import("@/lib/pdfToTables")>()), lireFichierPdf }));

const PDF = "samples/461.pdf";

beforeEach(() => {
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
});
afterEach(() => {
  cleanup();
  lireFichierPdf.mockReset();
  vi.unstubAllGlobals();
});

async function pagesDuGrandLivre() {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  return lireTextePdf(pdfjs as never, new Uint8Array(readFileSync(PDF)).buffer as ArrayBuffer);
}

async function choisir(nom = "461.pdf") {
  fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [new File(["x"], nom, { type: "application/pdf" })] } });
}

describe.skipIf(!existsSync(PDF))("import du grand-livre 461 dans un tableau de la collecte", () => {
  it("propose les chèques émis dans la souche de chèques, avec le contrôle des totaux du document", async () => {
    lireFichierPdf.mockResolvedValue(await pagesDuGrandLivre());
    const onAjouter = vi.fn();
    render(<ImportDocumentDialog open onOpenChange={vi.fn()} def={TAB_BY_KEY.souche_cheques} devise="TND" onAjouter={onAjouter} />);
    await choisir();
    expect(await screen.findByText(/Totaux du document retrouvés/)).toBeTruthy();
    expect(screen.getByText(/I CARGO LINE/)).toBeTruthy();
    expect(screen.getAllByRole("checkbox").length).toBe(28); // 27 lignes + « tout sélectionner »
    expect(screen.getByText("ADEL EDHAWTHI")).toBeTruthy();
    expect(screen.getByText(/Autres écritures du document.*chèques encaissés/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Ajouter 27 lignes" }));
    expect(onAjouter).toHaveBeenCalledTimes(1);
    expect(onAjouter.mock.calls[0][0]).toHaveLength(27);
    expect(onAjouter.mock.calls[0][0][0]).toMatchObject({ date: "2026-01-06", num_cheque: "4001511", beneficiaire: "BATTERIE QODS AUT", compte_bancaire: "ZITO", montant: 820 });
  });

  it("n'ajoute que les lignes cochées", async () => {
    lireFichierPdf.mockResolvedValue(await pagesDuGrandLivre());
    const onAjouter = vi.fn();
    render(<ImportDocumentDialog open onOpenChange={vi.fn()} def={TAB_BY_KEY.bordereaux_remise_cheques} devise="TND" onAjouter={onAjouter} />);
    await choisir();
    await screen.findByText(/Totaux du document retrouvés/);
    fireEvent.click(screen.getByLabelText("Tout sélectionner"));
    expect(screen.getByRole("button", { name: "Ajouter 0 ligne" }).hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByLabelText("Ligne 1"));
    fireEvent.click(screen.getByLabelText("Ligne 3"));
    fireEvent.click(screen.getByRole("button", { name: "Ajouter 2 lignes" }));
    expect(onAjouter.mock.calls[0][0].map((r: { num_cheque: string }) => r.num_cheque)).toEqual(["8431", "4001351"]);
  });

  it("alimente les virements reçus avec l'émetteur lu après le motif", async () => {
    lireFichierPdf.mockResolvedValue(await pagesDuGrandLivre());
    const onAjouter = vi.fn();
    render(<ImportDocumentDialog open onOpenChange={vi.fn()} def={TAB_BY_KEY.virements_recus} devise="TND" onAjouter={onAjouter} />);
    await choisir();
    await screen.findByText(/Totaux du document retrouvés/);
    expect(screen.getByText("SO FOR TRADE")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ajouter 5 lignes" }));
    expect(onAjouter.mock.calls[0][0]).toHaveLength(5);
  });

  it("ajoute les lignes importées au tableau de la collecte, à enregistrer ensuite", async () => {
    lireFichierPdf.mockResolvedValue(await pagesDuGrandLivre());
    const ref = createRef<CollecteGridHandle>();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<CollecteGrid ref={ref} def={TAB_BY_KEY.souche_cheques} lignes={[]} readOnly={false} devise="TND" onSave={onSave} />);
    expect(ref.current?.isDirty()).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Importer un document" }));
    await choisir();
    await screen.findByText(/Totaux du document retrouvés/);
    fireEvent.click(screen.getByRole("button", { name: "Ajouter 27 lignes" }));
    expect(document.querySelectorAll("tbody tr[data-row]")).toHaveLength(27);
    expect(ref.current?.isDirty()).toBe(true);
    expect(onSave).not.toHaveBeenCalled();
  });
});

describe("import de document : cas limites", () => {
  it("refuse un document qui n'est pas un grand-livre", async () => {
    lireFichierPdf.mockResolvedValue([[{ str: "Facture", x: 10, y: 700, w: 40, h: 10 }, { str: "1000", x: 300, y: 700, w: 20, h: 10 }]]);
    render(<ImportDocumentDialog open onOpenChange={vi.fn()} def={TAB_BY_KEY.souche_cheques} devise="TND" onAjouter={vi.fn()} />);
    await choisir("facture.pdf");
    expect(await screen.findByText(/Document non reconnu/)).toBeTruthy();
  });

  it("refuse un PDF scanné, sans texte", async () => {
    lireFichierPdf.mockResolvedValue([[]]);
    render(<ImportDocumentDialog open onOpenChange={vi.fn()} def={TAB_BY_KEY.souche_cheques} devise="TND" onAjouter={vi.fn()} />);
    await choisir("scan.pdf");
    expect(await screen.findByText(/PDF scanné/)).toBeTruthy();
  });

  it("n'est pas proposé pour un tableau qu'un grand-livre ne peut pas alimenter", () => {
    render(<CollecteGrid def={TAB_BY_KEY.etat_caisse} lignes={[]} readOnly={false} devise="TND" onSave={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Importer un document" })).toBeNull();
  });

  it("n'est pas proposé en lecture seule", async () => {
    render(<CollecteGrid def={TAB_BY_KEY.souche_cheques} lignes={[]} readOnly devise="TND" onSave={vi.fn()} />);
    await waitFor(() => expect(screen.queryByRole("button", { name: "Importer un document" })).toBeNull());
  });
});
