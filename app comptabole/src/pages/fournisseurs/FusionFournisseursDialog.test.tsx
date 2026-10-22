// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FusionFournisseursDialog } from "./FusionFournisseursDialog";
import type { RecapFournisseur } from "@/lib/fournisseurs";

const recap = (cle: string, nom: string, nbFactures = 1): RecapFournisseur => ({ cle, nom, nbFactures, nbImpayees: 0, totaux: [] });

describe("regroupement de fournisseurs", () => {
  afterEach(cleanup);

  it("regroupe le fournisseur affiché avec celui qu'on choisit, puis ferme la fenêtre", async () => {
    const onFusionner = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();
    render(
      <FusionFournisseursDialog
        open
        onOpenChange={onOpenChange}
        actif={recap("sotacib kairouan", "SOTACIB KAIROUAN")}
        autres={[recap("sotacib", "SOTACIB", 2)]}
        fusions={[]}
        nomDe={(c) => c}
        onFusionner={onFusionner}
        onSeparer={vi.fn()}
      />,
    );
    const regrouper = screen.getByRole("button", { name: "Regrouper" });
    expect((regrouper as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("radio", { name: /SOTACIB\s+2 factures/ }));
    fireEvent.click(regrouper);
    await waitFor(() => expect(onFusionner).toHaveBeenCalledWith("sotacib kairouan", "sotacib"));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("liste les regroupements en cours et permet de les séparer", async () => {
    const onSeparer = vi.fn().mockResolvedValue(undefined);
    render(
      <FusionFournisseursDialog
        open
        onOpenChange={vi.fn()}
        actif={recap("sotacib", "SOTACIB", 2)}
        autres={[]}
        fusions={[{ cleSource: "sotacib kairouan", cleCible: "sotacib", nomSource: "SOTACIB KAIROUAN" }]}
        nomDe={() => "SOTACIB"}
        onFusionner={vi.fn()}
        onSeparer={onSeparer}
      />,
    );
    expect(screen.getByText(/SOTACIB KAIROUAN » regroupé avec « SOTACIB/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Séparer" }));
    await waitFor(() => expect(onSeparer).toHaveBeenCalledWith("sotacib kairouan"));
  });
});
