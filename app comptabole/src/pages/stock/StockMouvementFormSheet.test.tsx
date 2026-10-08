// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { StockMouvementInput } from "@/store/stock";
import { useStock } from "@/store/stock";
import type { StockMouvement } from "@/types";
import { StockMouvementFormSheet, avecTauxDouane } from "./StockMouvementFormSheet";

function ouvrir(onSubmit = vi.fn().mockResolvedValue(undefined)) {
  const onOpenChange = vi.fn();
  render(<StockMouvementFormSheet open onOpenChange={onOpenChange} societeId="s1" onSubmit={onSubmit} />);
  return { onOpenChange, onSubmit };
}

const saisir = () =>
  fireEvent.change(screen.getByPlaceholderText("Ex. HOT WASHED PET FLAKES"), { target: { value: "CIMENT" } });

describe("fenêtre du mouvement de stock", () => {
  afterEach(cleanup);

  it("se ferme directement quand rien n'a été saisi", () => {
    const { onOpenChange } = ouvrir();
    fireEvent.click(screen.getByText("Annuler"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("demande confirmation avant d'abandonner une saisie, sans rien perdre", async () => {
    const { onOpenChange } = ouvrir();
    saisir();
    fireEvent.click(screen.getByText("Annuler"));
    expect(await screen.findByText("Abandonner ce mouvement ?")).toBeTruthy();
    expect(onOpenChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("Continuer la saisie"));
    await waitFor(() => expect(screen.queryByText("Abandonner ce mouvement ?")).toBeNull());
    expect((screen.getByPlaceholderText("Ex. HOT WASHED PET FLAKES") as HTMLInputElement).value).toBe("CIMENT");
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("n'est pas fermée par la touche Échap quand une saisie existe", async () => {
    const { onOpenChange } = ouvrir();
    saisir();
    fireEvent.keyDown(screen.getByPlaceholderText("Ex. HOT WASHED PET FLAKES"), { key: "Escape" });
    expect(await screen.findByText("Abandonner ce mouvement ?")).toBeTruthy();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("reste ouverte avec les données si l'enregistrement échoue", async () => {
    const { onOpenChange, onSubmit } = ouvrir(vi.fn().mockRejectedValue(new Error("échec")));
    saisir();
    fireEvent.click(screen.getByText("Enregistrer le mouvement"));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText("Enregistrer le mouvement")).toBeTruthy());
    expect(onOpenChange).not.toHaveBeenCalled();
    expect((screen.getByPlaceholderText("Ex. HOT WASHED PET FLAKES") as HTMLInputElement).value).toBe("CIMENT");
  });

  it("se ferme seulement une fois le mouvement réellement enregistré", async () => {
    let terminer: () => void = () => {};
    const attente = new Promise<void>((resolve) => {
      terminer = resolve;
    });
    const { onOpenChange } = ouvrir(vi.fn().mockReturnValue(attente));
    saisir();
    fireEvent.click(screen.getByText("Enregistrer le mouvement"));
    expect(await screen.findByText("Enregistrement…")).toBeTruthy();
    expect(onOpenChange).not.toHaveBeenCalled();

    terminer();
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});

describe("n° de facture en doublon", () => {
  afterEach(() => {
    cleanup();
    useStock.setState({ list: [] });
  });
  const existant = { id: "m1", venteNumFacture: "202300002", achatNumFacture: "A-1", fournisseur: "SOTACIB" } as StockMouvement;

  it("alerte, puis demande confirmation avant d'enregistrer un numéro déjà utilisé", async () => {
    useStock.setState({ list: [existant] });
    const { onSubmit } = ouvrir();
    saisir();
    fireEvent.change(screen.getAllByLabelText("N° Facture")[1], { target: { value: "2023-00002" } });
    expect((await screen.findByRole("alert")).textContent).toMatch(/déjà utilisé dans le mouvement n° 1/);

    fireEvent.click(screen.getByText("Enregistrer le mouvement"));
    expect(await screen.findByText("Numéro de facture déjà utilisé")).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("Enregistrer quand même"));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
  });

  it("n'alerte pas pour un numéro inédit", async () => {
    useStock.setState({ list: [existant] });
    const { onSubmit } = ouvrir();
    saisir();
    fireEvent.change(screen.getAllByLabelText("N° Facture")[1], { target: { value: "202300099" } });
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.click(screen.getByText("Enregistrer le mouvement"));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(screen.queryByText("Numéro de facture déjà utilisé")).toBeNull();
  });
});

describe("taux de change de la douane", () => {
  const ligne = (montantDevise: number) => ({ designation: "CIMENT", quantite: 1, prixUnitaire: montantDevise, montantDevise, montantTnd: 0 });
  const base = (patch: Partial<StockMouvementInput>) =>
    ({
      douaneTauxChange: 0,
      achatCours: 0,
      venteCours: 0,
      achatLignes: [ligne(1000)],
      venteLignes: [ligne(2000)],
      ...patch,
    }) as StockMouvementInput;

  it("s'applique aux cours de l'achat et de la vente quand ils sont vides, et recalcule les dinars", () => {
    const r = avecTauxDouane(base({}), 3.2842);
    expect(r.douaneTauxChange).toBe(3.2842);
    expect(r.achatCours).toBe(3.2842);
    expect(r.venteCours).toBe(3.2842);
    expect(r.achatLignes[0].montantTnd).toBe(3284.2);
    expect(r.venteLignes[0].montantTnd).toBe(6568.4);
  });

  it("suit une correction du taux quand les cours suivaient déjà l'ancien taux", () => {
    const r = avecTauxDouane(base({ douaneTauxChange: 3.2, achatCours: 3.2, venteCours: 3.2 }), 3.3);
    expect(r.achatCours).toBe(3.3);
    expect(r.venteCours).toBe(3.3);
  });

  it("respecte un cours saisi à la main avec une autre valeur", () => {
    const r = avecTauxDouane(base({ douaneTauxChange: 3.2, achatCours: 3.5, venteCours: 0 }), 3.3);
    expect(r.achatCours).toBe(3.5);
    expect(r.venteCours).toBe(3.3);
  });

  it("ne touche pas aux cours quand le taux est effacé", () => {
    const r = avecTauxDouane(base({ douaneTauxChange: 3.2, achatCours: 3.2, venteCours: 3.2 }), 0);
    expect(r.douaneTauxChange).toBe(0);
    expect(r.achatCours).toBe(3.2);
    expect(r.venteCours).toBe(3.2);
  });
});
