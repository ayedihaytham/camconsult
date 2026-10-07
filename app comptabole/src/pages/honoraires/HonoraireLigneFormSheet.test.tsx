// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { HonoraireLigneFormSheet } from "./HonoraireLigneFormSheet";
import type { HonoraireLigne } from "@/types";

const ligne: HonoraireLigne = {
  id: "l1", societeId: "s1", ordre: 1, type: "mensuelle", nature: "", periode: "", libelle: "DMI AOUT 2026",
  cnss: "", numQuittance: "M064921", montantDeclaration: 888.01, honoraire: 0, reglement: 0, dateReglement: null, note: "",
  total: 888.01, solde: 888.01, aPiece: false, pieceNom: "", pieceFormat: "", pieceTaille: "", creeLe: "", majLe: "",
};

describe("pièce jointe à la modification", () => {
  it("envoie le fichier choisi avec la ligne modifiée", async () => {
    const onSubmit = vi.fn();
    const { container } = render(
      <HonoraireLigneFormSheet open onOpenChange={() => {}} societeId="s1" ligne={ligne} onSubmit={onSubmit} />,
    );
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["%PDF-1.4 test"], "DMI-08-2026.pdf", { type: "application/pdf" });
    fireEvent.change(input, { target: { files: [file] } });
    await screen.findByText("DMI-08-2026.pdf");
    fireEvent.click(screen.getByText("Enregistrer"));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const data = onSubmit.mock.calls[0][0];
    expect(data.pieceNom).toBe("DMI-08-2026.pdf");
    expect(data.pieceDataUrl).toMatch(/^data:application\/pdf;base64,/);
    expect(container).toBeTruthy();
  });
});
