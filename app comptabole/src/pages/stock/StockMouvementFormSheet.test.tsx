// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StockMouvementFormSheet } from "./StockMouvementFormSheet";

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
