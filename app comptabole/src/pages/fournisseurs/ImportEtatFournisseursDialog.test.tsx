// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { FactureFournisseur } from "@/types";
import { ImportEtatFournisseursDialog } from "./ImportEtatFournisseursDialog";

const { lireClasseurExcel } = vi.hoisted(() => ({ lireClasseurExcel: vi.fn() }));
vi.mock("@/lib/classeurExcel", () => ({ lireClasseurExcel }));

const ENTETE = ["N° FACT PROF", "DATE PROF", "QTE PROF", "DESIGNATION", "MONT PROF", "N° FACT ACHAT", "QTE FACT", "P.U", "MONT FACT", "DATE TRANSF / CHQ", "MODE DE RGLT", "N° RS", "RS", "MONT VIRMT TND", "BQ", "FACT VENTE N°"];
const feuille = {
  nom: "ENFIDHA ",
  fusions: [],
  rows: [
    ["ENFIDHA"],
    [],
    ENTETE,
    ["P1", new Date(2026, 0, 8), 400, "CEM", 72000, "6608001609", 200, 180, 36000, new Date(2026, 3, 10), "CHQ N°9200013", "2600034", 360, 35640, "ALBARAKA", "2026038"],
    [null, null, null, null, null, "6608001611", 200, 180, 36000, new Date(2026, 3, 14), "VIREMENT", "2600035", 360, 35640, "BTL", "2026039"],
    [null, null, null, null, null, "9999999", 100, 180, 18000, new Date(2026, 3, 20), "CHQ N°9200014", "2600036", 180, 17820, "BTL", "2026040"],
  ],
};

const suivi = { numProforma: "", dateProforma: null, montantProforma: 0, qteProforma: 0, etatProforma: "", numTitre: "", etatChargement: "", vuPasse: "" };
const stock = (id: string, numFacture: string): FactureFournisseur => ({
  id, fournisseur: "ENFIDHA", fournisseurCle: "enfidha", numFacture, date: "2026-04-07", devise: "TND", cours: 0, quantite: 200, designation: "CEM",
  prixUnitaire: 180, montant: 36000, montantTnd: 0, venteNumFacture: "", douaneNumDeclaration: "", suivi,
});

function ouvrir(factures: FactureFournisseur[], bilan = { crees: 2, ignores: 0, refuses: [], suivisMaj: 2 }) {
  const onImporter = vi.fn().mockResolvedValue(bilan);
  render(<ImportEtatFournisseursDialog open onOpenChange={vi.fn()} societeId="s1" factures={factures} onImporter={onImporter} />);
  return { onImporter };
}

async function choisirFichier() {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [new File(["x"], "etat.xlsx")] } });
  await screen.findByRole("region", { name: "Feuille ENFIDHA" });
}

describe("import d'un état fournisseur", () => {
  afterEach(() => {
    cleanup();
    lireClasseurExcel.mockReset();
  });

  it("rapproche les factures du classeur du stock, et propose les règlements dont toutes les factures sont connues", async () => {
    lireClasseurExcel.mockResolvedValue([feuille]);
    ouvrir([stock("a", "6608001609"), stock("b", "6608001611")]);
    await choisirFichier();
    const f = screen.getByRole("region", { name: "Feuille ENFIDHA" });
    expect(f.textContent).toContain("2/3 factures retrouvées");
    expect(f.textContent).toContain("2/3 règlements importables");
    // La facture 9999999 est absente du stock : son règlement est incomplet et non importable.
    expect(within(f).getByText("Incomplet")).toBeTruthy();
    expect(f.textContent).toMatch(/absente de la gestion de stock : 9999999/);
    const boites = within(f).getAllByRole("checkbox") as HTMLInputElement[];
    expect(boites.map((b) => [b.getAttribute("aria-checked"), b.hasAttribute("disabled")])).toEqual([["true", false], ["true", false], ["false", true]]);
  });

  it("envoie les règlements cochés avec leurs factures, la retenue et le suivi de la proforma", async () => {
    lireClasseurExcel.mockResolvedValue([feuille]);
    const { onImporter } = ouvrir([stock("a", "6608001609"), stock("b", "6608001611")]);
    await choisirFichier();
    fireEvent.click(screen.getByRole("button", { name: "Importer 2 règlements" }));
    await waitFor(() => expect(onImporter).toHaveBeenCalledTimes(1));
    const envoi = onImporter.mock.calls[0][0];
    expect(envoi.societeId).toBe("s1");
    expect(envoi.reglements).toEqual([
      expect.objectContaining({ fournisseurCle: "enfidha", dateReglement: "2026-04-10", mode: "cheque", reference: "9200013", banque: "AL BARAKA", devise: "TND", rsNumero: "2600034", rsMontant: 360, rsTaux: 1, affectations: [{ mouvementId: "a", montant: 36000 }] }),
      expect.objectContaining({ mode: "virement", banque: "BTL", rsNumero: "2600035", affectations: [{ mouvementId: "b", montant: 36000 }] }),
    ]);
    // Seule la première ligne porte une proforma : la seconde n'a rien à reprendre (la fusion de cellules est testée sur le vrai classeur).
    expect(envoi.suivis.map((s: { mouvementId: string }) => s.mouvementId)).toEqual(["a"]);
    expect(envoi.suivis[0]).toMatchObject({ numProforma: "P1", qteProforma: 400, montantProforma: 72000, dateProforma: "2026-01-08" });
    // Après l'import, un bilan est affiché.
    expect(await screen.findByText("Import terminé")).toBeTruthy();
    expect(screen.getByText(/2 règlements créés/)).toBeTruthy();
  });

  it("n'envoie que les règlements restés cochés, et pas le suivi quand on le décoche", async () => {
    lireClasseurExcel.mockResolvedValue([feuille]);
    const { onImporter } = ouvrir([stock("a", "6608001609"), stock("b", "6608001611")]);
    await choisirFichier();
    const f = screen.getByRole("region", { name: "Feuille ENFIDHA" });
    fireEvent.click(within(f).getAllByRole("checkbox")[1]);
    fireEvent.click(screen.getByLabelText(/Reprendre aussi la proforma/));
    fireEvent.click(screen.getByRole("button", { name: "Importer 1 règlement" }));
    await waitFor(() => expect(onImporter).toHaveBeenCalled());
    const envoi = onImporter.mock.calls[0][0];
    expect(envoi.reglements).toHaveLength(1);
    expect(envoi.reglements[0].reference).toBe("9200013");
    expect(envoi.suivis).toEqual([]);
  });

  it("prévient quand aucune facture du classeur n'est dans le stock", async () => {
    lireClasseurExcel.mockResolvedValue([feuille]);
    ouvrir([]);
    await choisirFichier();
    expect(screen.getByRole("alert").textContent).toMatch(/Aucune facture du classeur n'a été retrouvée/);
    expect((screen.getByRole("button", { name: /^Importer/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("refuse un fichier qui n'est pas un état fournisseur", async () => {
    lireClasseurExcel.mockResolvedValue([{ nom: "Feuille1", fusions: [], rows: [["a", "b"], [1, 2]] }]);
    ouvrir([]);
    fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [new File(["x"], "autre.xlsx")] } });
    expect(await screen.findByText(/Aucun état fournisseur reconnu/)).toBeTruthy();
  });
});
