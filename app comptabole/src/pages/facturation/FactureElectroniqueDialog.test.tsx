// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { EinvoiceEtat, Facture } from "@/types";

// Magasin simulé, données fictives : aucune requête réseau.
const magasin = vi.hoisted(() => ({
  list: [] as unknown[],
  conformite: vi.fn(),
  preparer: vi.fn(),
  telechargerXml: vi.fn(),
}));
vi.mock("@/store/facturation", () => ({ useFacturation: (selecteur: (s: typeof magasin) => unknown) => selecteur(magasin) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { FactureElectroniqueDialog } from "./FactureElectroniqueDialog";

const facture = (extra: Partial<Facture> = {}) =>
  ({ id: "f1", numero: "2026-0001", statut: "emise", einvoice: null, ...extra }) as Facture;

const etatPret: EinvoiceEtat = { einvoice: null, version: "1.8.9", problemes: [], pret: true };
const etatBloque: EinvoiceEtat = {
  einvoice: null,
  version: "1.8.9",
  pret: false,
  problemes: [
    { niveau: "bloquant", ou: "cabinet", champ: "matriculeFiscal", message: "Cabinet : Matricule fiscal absent." },
    { niveau: "bloquant", ou: "societe", champ: "ville", message: "Client : ville absente." },
    { niveau: "avertissement", ou: "facture", champ: "tvaTaux", message: "TVA à 0 % : à confirmer." },
  ],
};

function monter(f: Facture | null, onOpenCabinet = vi.fn()) {
  magasin.list = f ? [f] : [];
  render(
    <MemoryRouter>
      <FactureElectroniqueDialog facture={f} onOpenChange={vi.fn()} onOpenCabinet={onOpenCabinet} />
    </MemoryRouter>,
  );
  return { onOpenCabinet };
}

beforeEach(() => {
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  magasin.conformite.mockReset();
  magasin.preparer.mockReset();
  magasin.telechargerXml.mockReset();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("FactureElectroniqueDialog", () => {
  it("fermée quand aucune facture n'est choisie : aucun appel au serveur", () => {
    monter(null);
    expect(magasin.conformite).not.toHaveBeenCalled();
    expect(screen.queryByText(/Facture électronique/)).toBeNull();
  });

  it("affiche les points bloquants avec leur origine, les avertissements, et refuse de préparer", async () => {
    magasin.conformite.mockResolvedValue(etatBloque);
    const { onOpenCabinet } = monter(facture());
    expect(await screen.findByText(/À corriger avant de préparer la facture \(2\)/)).toBeTruthy();
    expect(screen.getByText("Cabinet : Matricule fiscal absent.", { exact: false })).toBeTruthy();
    expect(screen.getByText("TVA à 0 % : à confirmer.", { exact: false })).toBeTruthy();
    expect((screen.getByRole("button", { name: "Préparer la facture électronique" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Compléter les informations du cabinet" }));
    expect(onOpenCabinet).toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Compléter la société cliente" }).getAttribute("href")).toBe("/societes");
  });

  it("conforme : prépare, puis annonce le résultat sans jamais promettre de dépôt chez TTN", async () => {
    magasin.conformite.mockResolvedValue(etatPret);
    magasin.preparer.mockResolvedValue({ ...etatPret, einvoice: { statut: "prete", genereLe: "2026-10-17T10:00:00Z", sha256: "a".repeat(64) } });
    monter(facture());
    expect(await screen.findByText(/La facture est conforme/)).toBeTruthy();
    expect(screen.getByText(/non signé/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Préparer la facture électronique" }));
    await waitFor(() => expect(magasin.preparer).toHaveBeenCalledWith("f1", false));
  });

  it("déjà préparée : télécharge le XML ou régénère après confirmation", async () => {
    magasin.conformite.mockResolvedValue(etatPret);
    magasin.preparer.mockResolvedValue(etatPret);
    monter(facture({ einvoice: { statut: "prete", genereLe: "2026-10-17T10:00:00Z", sha256: "b".repeat(64) } }));
    expect(await screen.findByText("Fichier prêt")).toBeTruthy();
    expect(screen.getByText("b".repeat(64))).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Télécharger le XML/ }));
    expect(magasin.telechargerXml).toHaveBeenCalledWith("f1", "2026-0001");
    fireEvent.click(screen.getByRole("button", { name: "Régénérer" }));
    expect(magasin.preparer).not.toHaveBeenCalled();
    // le bouton de confirmation porte le même nom que celui qui ouvre la fenêtre : c'est le dernier de la liste
    fireEvent.click(screen.getAllByRole("button", { name: "Régénérer" }).at(-1)!);
    await waitFor(() => expect(magasin.preparer).toHaveBeenCalledWith("f1", true));
  });

  it("facture annulée : ni préparation ni téléchargement", async () => {
    magasin.conformite.mockResolvedValue({ ...etatPret, pret: false });
    monter(facture({ statut: "annulee" }));
    await screen.findByText(/Message TEIF/);
    expect((screen.getByRole("button", { name: "Préparer la facture électronique" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("échec de la vérification : message clair, rien d'activé", async () => {
    magasin.conformite.mockRejectedValue(new Error("réseau"));
    monter(facture());
    expect(await screen.findByText(/Impossible de vérifier la facture/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Préparer la facture électronique" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
