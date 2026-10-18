// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { CollecteFull } from "@/types";

const magasin = vi.hoisted(() => ({ saveLignes: vi.fn() }));
vi.mock("@/store/collectes", () => ({ useCollectes: (sel: (s: typeof magasin) => unknown) => sel(magasin) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// La lecture réelle du PDF est testée dans grandLivre.test.ts : ici on fournit directement le tableau reconstruit d'un grand-livre.
const livre = vi.hoisted(() => ({
  pages: [
    [
      ["I CARGO LINE", "Grand-livre des comptes"],
      ["Date C.j N° pièce", "Libellé écriture", "Mouvement débit", "Mouvement crédit", "Solde"],
      ["461000 COMPTES D'ATTENTE"],
      ["010126 RAN 5", "SOLDE ANTERIEURE", "", "1 000,000", ""],
      ["060126 ZITO 3", "REG CHQ N°4001511 BATTERIE", "820,000", "", ""],
      ["300126 BTK 169", "ENC CHQ N°8431", "", "2 680,089", ""],
      ["020226 BTK 2", "VIR ETRANGER", "", "6 208,274", ""],
      ["030226 BTK 9", "FRAIS DIVERS", "10,000", "", ""],
    ],
  ] as string[][][],
}));
vi.mock("@/lib/pdfToTables", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/pdfToTables")>()),
  lireFichierPdf: vi.fn(async () => [[]]),
  nombreDeCaracteres: () => 10,
  reconstruireTableau: () => livre.pages[0],
}));

import { ImportGrandLivreDialog } from "./ImportGrandLivreDialog";

const collecte = (over: Partial<CollecteFull> = {}) =>
  ({ id: "c1", devise: "TND", onglets: ["etat_cheques_emis", "bordereaux_remise_cheques", "virements_recus"], lignes: [], sections: [], notes: [], fichiers: [], ...over }) as unknown as CollecteFull;

async function ouvrir(props: Partial<Parameters<typeof ImportGrandLivreDialog>[0]> = {}) {
  render(<ImportGrandLivreDialog open onOpenChange={vi.fn()} collecte={collecte()} editableTab={() => true} brouillonOuvert={false} {...props} />);
  const entree = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(entree, { target: { files: [new File(["x"], "461.pdf", { type: "application/pdf" })] } });
  await screen.findByText("461.pdf — choisir un autre fichier");
}

beforeEach(() => magasin.saveLignes.mockReset().mockResolvedValue(undefined));
afterEach(cleanup);

describe("ImportGrandLivreDialog", () => {
  it("range chaque écriture dans son tableau avec son sens précis, et met à part le solde antérieur et ce qui n'est pas classable", async () => {
    await ouvrir();
    expect(screen.getByText("Règlement par chèque")).toBeTruthy();
    expect(screen.getByText("Chèque encaissé")).toBeTruthy();
    expect(screen.getByText("Virement de l'étranger")).toBeTruthy();
    expect(screen.getByText("Solde antérieur : à justifier")).toBeTruthy();
    expect(screen.getByText("À classer à la main")).toBeTruthy();
    // chèques émis -> état tenu par le cabinet, jamais la souche
    expect(screen.getAllByText("État des chèques émis").length).toBeGreaterThan(0);
    expect(screen.queryByText("Souche de chèques")).toBeNull();
    expect(screen.getByRole("button", { name: "Importer 3 lignes" })).toBeTruthy();
  });

  it("signale le solde antérieur à justifier avec le reste en fin de période", async () => {
    await ouvrir();
    expect(screen.getByText(/Solde antérieur à justifier : 1 000,000 TND/)).toBeTruthy();
    // 1 000 + 8 888,363 reçus - 830 payés
    expect(screen.getByText(/9 058,363 TND/)).toBeTruthy();
  });

  it("importe à la suite des lignes existantes et enregistre chaque tableau concerné", async () => {
    const existante = { id: "l1", onglet: "etat_cheques_emis", ordre: 0, data: { num_cheque: "1", montant: 5, observations: "" } };
    await ouvrir({ collecte: collecte({ lignes: [existante] }) });
    fireEvent.click(screen.getByRole("button", { name: "Importer 3 lignes" }));
    await waitFor(() => expect(magasin.saveLignes).toHaveBeenCalledTimes(3));
    const appels = Object.fromEntries(magasin.saveLignes.mock.calls.map(([, onglet, lignes]) => [onglet, lignes]));
    expect(Object.keys(appels).sort()).toEqual(["bordereaux_remise_cheques", "etat_cheques_emis", "virements_recus"]);
    expect(appels.etat_cheques_emis).toHaveLength(2);
    expect(appels.etat_cheques_emis[0].data.num_cheque).toBe("1");
    expect(appels.etat_cheques_emis[1].data).toMatchObject({ num_cheque: "4001511", beneficiaire: "BATTERIE", montant: 820, observations: "Règlement par chèque · GL 461000 · ZITO · p.3" });
    expect(appels.bordereaux_remise_cheques[0].data).toMatchObject({ num_cheque: "8431", montant_cheque: 2680.089 });
  });

  it("ne propose pas deux fois une écriture déjà importée", async () => {
    const dejaLa = { id: "l1", onglet: "etat_cheques_emis", ordre: 0, data: { num_cheque: "4001511", montant: 820, observations: "Règlement par chèque · GL 461000 · ZITO · p.3" } };
    await ouvrir({ collecte: collecte({ lignes: [dejaLa] }) });
    expect(screen.getByText("Déjà dans le tableau")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Importer 2 lignes" })).toBeTruthy();
  });

  it("la sélection de l'utilisateur survit au rendu du parent (qui recrée editableTab à chaque fois)", async () => {
    const props = { onOpenChange: vi.fn(), collecte: collecte(), brouillonOuvert: false };
    const { rerender } = render(<ImportGrandLivreDialog open {...props} editableTab={() => true} />);
    fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [new File(["x"], "461.pdf", { type: "application/pdf" })] } });
    await screen.findByText("461.pdf — choisir un autre fichier");
    expect(screen.getByRole("button", { name: "Importer 3 lignes" })).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox", { name: /Écriture 169/ }));
    expect(screen.getByRole("button", { name: "Importer 2 lignes" })).toBeTruthy();
    rerender(<ImportGrandLivreDialog open {...props} editableTab={() => true} />);
    expect(screen.getByRole("button", { name: "Importer 2 lignes" })).toBeTruthy();
  });

  it("un tableau non demandé ou fermé n'est pas importé, et les autres le sont", async () => {
    await ouvrir({ collecte: collecte({ onglets: ["etat_cheques_emis"] }), editableTab: (o) => o !== "etat_cheques_emis" });
    expect(screen.getByText("Tableau fermé à la modification")).toBeTruthy();
    expect(screen.getAllByText("Tableau non demandé dans cette collecte").length).toBe(2);
    expect(screen.getByRole("button", { name: "Importer 0 ligne" }).hasAttribute("disabled")).toBe(true);
  });

  it("un tableau ouvert avec des modifications non enregistrées bloque l'import", async () => {
    await ouvrir({ brouillonOuvert: true });
    expect(screen.getByRole("alert").textContent).toMatch(/Enregistrez-le d'abord/);
    expect(screen.getByRole("button", { name: "Importer 3 lignes" }).hasAttribute("disabled")).toBe(true);
  });

  it("si l'enregistrement d'un tableau échoue, les autres sont tout de même enregistrés et la fenêtre reste ouverte", async () => {
    magasin.saveLignes.mockImplementation(async (_id: string, onglet: string) => {
      if (onglet === "virements_recus") throw new Error("refus");
    });
    const fermer = vi.fn();
    await ouvrir({ onOpenChange: fermer });
    fireEvent.click(screen.getByRole("button", { name: "Importer 3 lignes" }));
    await waitFor(() => expect(magasin.saveLignes).toHaveBeenCalledTimes(3));
    expect(fermer).not.toHaveBeenCalledWith(false);
  });
});
