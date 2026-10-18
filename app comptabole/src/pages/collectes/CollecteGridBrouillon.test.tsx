// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { CollecteLigne } from "@/types";
import { effacerTousLesBrouillons, lireBrouillon } from "@/lib/brouillons";
import { TAB_BY_KEY } from "@/lib/collecte/tabs";
import { CollecteGrid } from "./CollecteGrid";

vi.mock("sonner", () => ({ toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() } }));

beforeEach(() => {
  effacerTousLesBrouillons();
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const enregistre: CollecteLigne[] = [{ id: "l1", onglet: "virements_recus", ordre: 0, data: { date: "2026-01-02", emetteur: "ALPHA", montant: 100 } }];

function grille(lignes: CollecteLigne[] = enregistre, onSave = vi.fn().mockResolvedValue(undefined)) {
  return render(<CollecteGrid def={TAB_BY_KEY.virements_recus} lignes={lignes} readOnly={false} devise="TND" brouillonCle="collecte:c1:virements_recus" onSave={onSave} />);
}
const emetteur = () => (document.querySelector('tbody tr[data-row] input[data-col="emetteur"]') as HTMLInputElement);

describe("CollecteGrid : brouillon qui survit à un changement de page", () => {
  it("une modification non enregistrée est retrouvée en revenant sur la page (précédent / suivant)", () => {
    const premiere = grille();
    fireEvent.change(emetteur(), { target: { value: "ALPHA SARL" } });
    expect(lireBrouillon("collecte:c1:virements_recus")).not.toBeNull();
    premiere.unmount(); // on quitte la page
    grille(); // on y revient
    expect(emetteur().value).toBe("ALPHA SARL");
    expect(screen.getByRole("button", { name: "Enregistrer" })).toBeTruthy();
  });

  it("un tableau sans modification ne laisse aucun brouillon", () => {
    const g = grille();
    expect(lireBrouillon("collecte:c1:virements_recus")).toBeNull();
    g.unmount();
    grille();
    expect(emetteur().value).toBe("ALPHA");
  });

  it("annuler la modification (la remettre comme enregistrée) efface le brouillon", () => {
    grille();
    fireEvent.change(emetteur(), { target: { value: "X" } });
    expect(lireBrouillon("collecte:c1:virements_recus")).not.toBeNull();
    fireEvent.change(emetteur(), { target: { value: "ALPHA" } });
    expect(lireBrouillon("collecte:c1:virements_recus")).toBeNull();
  });

  it("si le tableau enregistré a changé entre-temps, le brouillon périmé n'est pas repris", () => {
    const premiere = grille();
    fireEvent.change(emetteur(), { target: { value: "ALPHA SARL" } });
    premiere.unmount();
    const modifie: CollecteLigne[] = [{ ...enregistre[0], data: { ...enregistre[0].data, emetteur: "BETA" } }];
    grille(modifie);
    expect(emetteur().value).toBe("BETA");
  });

  it("l'enregistrement efface le brouillon", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    grille(enregistre, onSave);
    fireEvent.change(emetteur(), { target: { value: "ALPHA SARL" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await vi.waitFor(() => expect(onSave).toHaveBeenCalled());
    await vi.waitFor(() => expect(lireBrouillon("collecte:c1:virements_recus")).toBeNull());
  });
});
