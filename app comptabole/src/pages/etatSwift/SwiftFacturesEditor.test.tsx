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
  devise: "",
  equivalentDevise: null,
  justifieDevise: 0,
  resteDevise: null,
  statut: "a_justifier",
  factures: [],
};

describe("SwiftFacturesEditor", () => {
  it("compare les factures à l'équivalent en devise indiqué par la société, pas au dinar, puis envoie", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<SwiftFacturesEditor virement={virement} onSave={onSave} />);
    expect(screen.getByText(/Indiquez d'abord l'équivalent/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Équivalent du virement en devise"), { target: { value: "2500" } });
    fireEvent.click(screen.getByRole("button", { name: /Ajouter une facture/ }));
    fireEvent.change(screen.getByLabelText("Numéro de la facture 1"), { target: { value: "FA-1" } });
    fireEvent.change(screen.getByLabelText("Montant devise de la facture 1"), { target: { value: "1300" } });
    fireEvent.change(screen.getByLabelText("Taux de change de la facture 1"), { target: { value: "3.15" } });
    expect((screen.getByLabelText("Montant en dinar de la facture 1") as HTMLInputElement).value).toBe("4095,000");
    expect(screen.getByText(/52 % justifié · encore 1.200,000 EUR/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Ajouter une facture/ }));
    fireEvent.change(screen.getByLabelText("Numéro de la facture 2"), { target: { value: "FA-2" } });
    fireEvent.change(screen.getByLabelText("Montant devise de la facture 2"), { target: { value: "1200" } });
    expect(screen.getByText(/atteint l'équivalent demandé/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Envoyer au cabinet/ }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        [expect.objectContaining({ numFacture: "FA-1", montantDevise: 1300, montantTnd: 4095 }), expect.objectContaining({ numFacture: "FA-2", montantDevise: 1200 })],
        { equivalentDevise: 2500, devise: "EUR" },
      ),
    );
  });

  it("signale un dépassement de l'équivalent en devise", () => {
    render(<SwiftFacturesEditor virement={{ ...virement, equivalentDevise: 1000, devise: "EUR" }} onSave={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Ajouter une facture/ }));
    fireEvent.change(screen.getByLabelText("Montant devise de la facture 1"), { target: { value: "1200" } });
    expect(screen.getByText(/Dépassement de 200,000 EUR/)).toBeTruthy();
  });

  it("refuse d'envoyer une facture sans numéro", () => {
    const onSave = vi.fn();
    render(<SwiftFacturesEditor virement={virement} onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: /Ajouter une facture/ }));
    fireEvent.click(screen.getByRole("button", { name: /Envoyer au cabinet/ }));
    expect(onSave).not.toHaveBeenCalled();
  });

  it("propose l'euro et le dollar pour la devise du virement et celle de chaque facture ; changer la devise du virement suit sur les factures", () => {
    render(<SwiftFacturesEditor virement={virement} onSave={vi.fn().mockResolvedValue(undefined)} />);
    const reference = screen.getByLabelText("Devise") as HTMLSelectElement;
    expect(Array.from(reference.options).map((o) => o.value)).toEqual(["EUR", "USD"]);
    expect(reference.value).toBe("EUR");
    fireEvent.click(screen.getByRole("button", { name: /Ajouter une facture/ }));
    const facture = screen.getByLabelText("Devise de la facture 1") as HTMLSelectElement;
    expect(Array.from(facture.options).map((o) => o.textContent)).toEqual(["EUR · Euro", "USD · Dollar"]);
    expect(facture.value).toBe("EUR");
    fireEvent.change(reference, { target: { value: "USD" } });
    expect((screen.getByLabelText("Devise de la facture 1") as HTMLSelectElement).value).toBe("USD");
  });
});
