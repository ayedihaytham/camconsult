// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FileUploadDialog, type SuiviEnvoi } from "./FileUploadDialog";

beforeEach(() => {
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("FileUploadDialog : avancement de l'import", () => {
  it("affiche la barre et l'état de chaque fichier pendant l'envoi, puis se ferme", async () => {
    let suivi: SuiviEnvoi = () => undefined;
    let finir: (v: boolean) => void = () => undefined;
    const onSubmit = vi.fn((_f: unknown, s?: SuiviEnvoi) => {
      suivi = s ?? suivi;
      return new Promise<boolean>((r) => (finir = r));
    });
    const onOpenChange = vi.fn();
    render(<FileUploadDialog open onOpenChange={onOpenChange} destinationLabel="UBCI" onSubmit={onSubmit} />);
    const entree = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(entree, { target: { files: [new File(["a"], "a.pdf"), new File(["b"], "b.pdf")] } });
    fireEvent.click(screen.getByRole("button", { name: /Ajouter 2 fichiers/ }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("0");
    expect(screen.getByRole("button", { name: "Annuler" }).hasAttribute("disabled")).toBe(true);

    act(() => suivi(0, "cours"));
    expect(screen.getAllByLabelText("En cours").length).toBe(1);
    act(() => suivi(0, "ok"));
    act(() => suivi(1, "erreur"));
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("2");
    expect(screen.getByLabelText("Envoyé")).toBeTruthy();
    expect(screen.getByLabelText("Refusé")).toBeTruthy();

    await act(async () => finir(true));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});
