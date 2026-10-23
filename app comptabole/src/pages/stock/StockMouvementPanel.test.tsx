// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { StockLigne, StockMouvement } from "@/types";
import { StockMouvementPanel } from "./StockMouvementPanel";

afterEach(cleanup);

const ligne = (designation: string, quantite: number, prix: number, unite = "T"): StockLigne => ({ designation, quantite, prixUnitaire: prix, montantDevise: quantite * prix, montantTnd: quantite * prix * 3.3, unite });

const mouvement = (patch: Partial<StockMouvement> = {}): StockMouvement => ({
  id: "m2", societeId: "s", ordre: 2, natureMarchandise: "HOT WASHED PET FLAKES",
  achatDate: "2026-08-29", achatNumFacture: "260083", achatDocType: "", fournisseur: "GREEN RECYCLING SARL", achatDevise: "EUR", achatCours: 3.3, achatLignes: [ligne("HOT WASHED PET FLAKES", 61.305, 740)],
  venteDate: "2026-09-04", venteNumFacture: "2600086", venteDocType: "", client: "ENPLATER ALTA SEGARRA,SL", venteDevise: "EUR", venteCours: 3.3, venteLignes: [ligne("HOT WASHED PET FLAKES", 61.305, 950)],
  douaneNumDeclaration: "447898", douaneDate: "2026-09-07", douaneRegime: "", douaneTypeDeclaration: "E", douaneReference: "", douaneTauxChange: 3.2842, douaneValeurTnd: 170778.4, douanePtfn: 52000, douaneExportateur: "STE DES CIMENTS D'ENFIDHA", douaneImportateur: "RUSPINA IMP EXP",
  achatDocDataUrl: null, venteDocDataUrl: "data:application/pdf;base64,AAAA", douaneDocDataUrl: null, note: "", ecart: 0, ecartUnite: "T", ecartParDesignation: [], creeLe: "", majLe: "", ...patch,
});

function afficher(m: StockMouvement | null = mouvement(), extra: Partial<React.ComponentProps<typeof StockMouvementPanel>> = {}) {
  const actions = { onNaviguer: vi.fn(), onFermer: vi.fn(), onEdit: vi.fn(), onDelete: vi.fn(), onRetirerCote: vi.fn(), onClasser: vi.fn(), onPreview: vi.fn() };
  render(<StockMouvementPanel mouvement={m} position={2} total={5} classing={null} {...actions} {...extra} />);
  return actions;
}

describe("panneau de détail d'un mouvement", () => {
  it("ne montre rien sans mouvement", () => {
    afficher(null);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("montre le rang, la marchandise, la situation et les deux factures avec tous leurs champs", () => {
    afficher();
    const panneau = within(screen.getByRole("dialog"));
    expect(panneau.getByText("Mouvement 2 sur 5")).toBeTruthy();
    expect(panneau.getByText("HOT WASHED PET FLAKES", { selector: "h2" })).toBeTruthy();
    expect(panneau.getByText("Soldé")).toBeTruthy();
    for (const titre of ["Vente", "Achat"]) expect(panneau.getByText(titre, { selector: "h3" })).toBeTruthy();
    for (const valeur of ["2600086", "ENPLATER ALTA SEGARRA,SL", "260083", "GREEN RECYCLING SARL"]) expect(panneau.getAllByText(valeur).length).toBeGreaterThan(0);
    for (const champ of ["N° facture", "Date", "Devise · cours", "Quantité", "Montant en devise", "Montant TND"]) expect(panneau.getAllByText(champ).length).toBeGreaterThanOrEqual(2);
    expect(panneau.getByText("Client")).toBeTruthy();
    expect(panneau.getByText("Fournisseur")).toBeTruthy();
    expect(panneau.getAllByText("HOT WASHED PET FLAKES").length).toBeGreaterThan(1);
  });

  it("garde la douane repliée avec « Afficher », et l'ouvre à la demande avec tous ses champs", () => {
    afficher();
    const details = document.querySelector("details") as HTMLDetailsElement;
    expect(details.open).toBe(false);
    expect(within(details).getByText("Afficher")).toBeTruthy();
    details.open = true;
    for (const champ of ["N° déclaration", "Taux de change", "Valeur en douane (TND)", "PTFN", "Exportateur", "Importateur"]) expect(within(details).getByText(champ)).toBeTruthy();
    expect(within(details).getByText("STE DES CIMENTS D'ENFIDHA")).toBeTruthy();
  });

  it("propose « + Ajouter » pour un côté absent et l'ouvre dans la fenêtre de modification", () => {
    const { onEdit } = afficher(mouvement({ achatLignes: [], achatNumFacture: "", fournisseur: "", achatDate: null, douaneNumDeclaration: "", douaneDate: null, douaneValeurTnd: 0, douanePtfn: 0, douaneExportateur: "", douaneImportateur: "", douaneTypeDeclaration: "", douaneTauxChange: 0, ecart: -61.305 }));
    expect(screen.getByText("Vendu sans achat")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "+ Ajouter la facture d'achat" }));
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Aucune déclaration douanière.")).toBeTruthy();
  });

  it("modifie, supprime le mouvement ou une seule facture", () => {
    const { onEdit, onDelete, onRetirerCote } = afficher();
    fireEvent.click(screen.getByRole("button", { name: "Modifier" }));
    fireEvent.click(screen.getByRole("button", { name: "Supprimer le mouvement" }));
    fireEvent.click(screen.getByRole("button", { name: "Supprimer la facture d'achat" }));
    fireEvent.click(screen.getByRole("button", { name: "Supprimer la facture de vente" }));
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: "m2" }));
    expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: "m2" }));
    expect(onRetirerCote).toHaveBeenCalledWith(expect.objectContaining({ id: "m2" }), "achat");
    expect(onRetirerCote).toHaveBeenCalledWith(expect.objectContaining({ id: "m2" }), "vente");
  });

  it("passe au mouvement précédent ou suivant, aux boutons comme aux flèches du clavier", () => {
    const { onNaviguer } = afficher();
    fireEvent.click(screen.getByRole("button", { name: "Mouvement suivant" }));
    fireEvent.click(screen.getByRole("button", { name: "Mouvement précédent" }));
    expect(onNaviguer).toHaveBeenNthCalledWith(1, 1);
    expect(onNaviguer).toHaveBeenNthCalledWith(2, -1);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "ArrowDown" });
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "ArrowUp" });
    expect(onNaviguer).toHaveBeenNthCalledWith(3, 1);
    expect(onNaviguer).toHaveBeenNthCalledWith(4, -1);
  });

  it("n'a pas de navigation quand il n'y a qu'un seul mouvement", () => {
    afficher(mouvement(), { total: 1, position: 1 });
    expect((screen.getByRole("button", { name: "Mouvement suivant" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("l'onglet Pièces n'offre que les documents joints et affiche le premier disponible", () => {
    afficher();
    fireEvent.click(screen.getByRole("tab", { name: "Pièces" }));
    const groupe = within(screen.getByRole("group", { name: "Pièce à afficher" }));
    expect((groupe.getByRole("button", { name: "Vente" }) as HTMLButtonElement).disabled).toBe(false);
    expect((groupe.getByRole("button", { name: "Achat" }) as HTMLButtonElement).disabled).toBe(true);
    expect((groupe.getByRole("button", { name: "Douane" }) as HTMLButtonElement).disabled).toBe(true);
    expect(groupe.getByRole("button", { name: "Vente" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("sans aucune pièce, l'onglet Pièces le dit", () => {
    afficher(mouvement({ venteDocDataUrl: null }));
    fireEvent.click(screen.getByRole("tab", { name: "Pièces" }));
    expect(screen.getByText(/Aucune pièce jointe à ce mouvement/)).toBeTruthy();
  });
});
