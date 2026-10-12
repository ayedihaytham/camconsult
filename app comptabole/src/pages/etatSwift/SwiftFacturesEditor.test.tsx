// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SwiftFacturesEditor } from "./SwiftFacturesEditor";
import type { SwiftVirement } from "@/types";

afterEach(cleanup);

const virement: SwiftVirement = {
  id: "v1",
  societeId: "s1",
  date: "2026-09-24",
  montant: 86350.25,
  libelle: "Transfert SWIFT EUR",
  banque: "Attijari Bank",
  envoye: true,
  justifie: 0,
  reste: 86350.25,
  statut: "a_justifier",
  factures: [],
};

describe("SwiftFacturesEditor", () => {
  it("calcule le montant en TND (devise × taux) et le reste à justifier, puis envoie les factures", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<SwiftFacturesEditor virement={virement} onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: /Ajouter une facture/ }));
    fireEvent.change(screen.getByLabelText("Numéro de la facture 1"), { target: { value: "FA-0412" } });
    fireEvent.change(screen.getByLabelText("Montant devise de la facture 1"), { target: { value: "8000" } });
    fireEvent.change(screen.getByLabelText("Taux de change de la facture 1"), { target: { value: "3.4" } });
    expect((screen.getByLabelText("Montant en dinar de la facture 1") as HTMLInputElement).value).toBe("27200,000");
    expect(screen.getByText(/31 % justifié/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Envoyer au cabinet/ }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith([expect.objectContaining({ numFacture: "FA-0412", montantDevise: 8000, taux: 3.4, montantTnd: 27200, devise: "EUR" })]),
    );
  });

  it("signale un dépassement du montant demandé", () => {
    render(<SwiftFacturesEditor virement={{ ...virement, montant: 1000, reste: 1000 }} onSave={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Ajouter une facture/ }));
    fireEvent.change(screen.getByLabelText("Montant en dinar de la facture 1"), { target: { value: "1200" } });
    expect(screen.getByText(/Dépassement de 200,000 TND/)).toBeTruthy();
  });

  it("refuse d'envoyer une facture sans numéro", () => {
    const onSave = vi.fn();
    render(<SwiftFacturesEditor virement={virement} onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: /Ajouter une facture/ }));
    fireEvent.click(screen.getByRole("button", { name: /Envoyer au cabinet/ }));
    expect(onSave).not.toHaveBeenCalled();
  });
});
