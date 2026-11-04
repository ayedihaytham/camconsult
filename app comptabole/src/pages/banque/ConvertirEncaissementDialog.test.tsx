// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ConvertirEncaissementDialog } from "./ConvertirEncaissementDialog";
import type { MouvementBancaire } from "@/types";

afterEach(cleanup);
beforeAll(() => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() });
});

// Mouvements synthétiques.
const mv = (id: string, dateOp: string, debit: number, credit: number, type: MouvementBancaire["type"], extra: Partial<MouvementBancaire> = {}): MouvementBancaire =>
  ({ id, compteId: "eur", dateOp, dateValeur: null, libelle: id, details: "", reference: "", numPiece: "", debit, credit, type, aRevoir: false, note: "", affecteClient: 0, reglementsClient: [], cours: null, reglementId: null, fournisseurCle: null, ...extra }) as MouvementBancaire;

const enc = mv("ENC A", "2026-02-10", 0, 30000, "encaissement_client");
const TOUS = [enc, mv("VENTE 1", "2026-02-12", 20000, 0, "change", { coursReel: 3.3 }), mv("VENTE 2", "2026-03-01", 15000, 0, "change", { coursReel: 3.4 })];

function ouvrir(onEnregistrer = vi.fn().mockResolvedValue(undefined), encaissement = enc, mouvements = TOUS) {
  render(<ConvertirEncaissementDialog open onOpenChange={vi.fn()} encaissement={encaissement} mouvements={mouvements} devise="EUR" onEnregistrer={onEnregistrer} />);
  return onEnregistrer;
}
const part = (nom: string) => screen.getByLabelText(`Part de ${nom}`) as HTMLInputElement;

describe("relier un encaissement en devise à ses changes", () => {
  it("propose la répartition dans l'ordre des dates, avec le cours moyen, et l'enregistre", async () => {
    const onEnregistrer = ouvrir();
    expect(part("VENTE 1").value).toBe("20000");
    expect(part("VENTE 2").value).toBe("10000");
    expect(screen.getByText("3,3333")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(onEnregistrer).toHaveBeenCalledWith([{ changeId: "VENTE 1", montant: 20000 }, { changeId: "VENTE 2", montant: 10000 }]));
  });

  it("refuse un total au-dessus de l'encaissement ou une part au-dessus de ce qui reste du change", () => {
    ouvrir();
    fireEvent.change(part("VENTE 2"), { target: { value: "12000" } });
    expect(screen.getByText("Le total dépasse le montant de l'encaissement.")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Enregistrer" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(part("VENTE 2"), { target: { value: "10000" } });
    fireEvent.change(part("VENTE 1"), { target: { value: "20001" } });
    expect(screen.getByRole("alert").textContent).toMatch(/dépasse/);
  });

  it("« Répartir automatiquement » refait la proposition ; vider toutes les parts propose de retirer les liens d'un encaissement déjà relié", () => {
    const deja = { ...enc, conversions: [{ changeId: "VENTE 1", montant: 5000, dateOp: "2026-02-12", coursReel: 3.3 }] };
    ouvrir(undefined, deja, [deja, { ...TOUS[1], changeUtilise: 5000 }, TOUS[2]]); // la part de cet encaissement est comptée dans « déjà utilisé » du change
    expect(part("VENTE 1").value).toBe("5000");
    expect(part("VENTE 2").value).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "Répartir automatiquement" }));
    expect(part("VENTE 1").value).toBe("20000");
    fireEvent.change(part("VENTE 1"), { target: { value: "" } });
    fireEvent.change(part("VENTE 2"), { target: { value: "" } });
    expect(screen.getByRole("button", { name: "Retirer les liens" })).toBeTruthy();
  });

  it("sans change possible, le dit et ne propose pas d'enregistrer", () => {
    ouvrir(undefined, enc, [enc]);
    expect(screen.getByText(/Aucune sortie de change de ce compte/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Retirer les liens" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
