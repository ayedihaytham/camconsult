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
  signature: null as unknown,
  fetchSignature: vi.fn(),
  signer: vi.fn(),
  deverrouiller: vi.fn(),
  verrouiller: vi.fn(),
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

const certificat = {
  sujet: "C=TN, O=CABINET FICTIF, CN=CABINET DE TEST",
  emetteur: "C=TN, O=AUTORITE FICTIVE, CN=AUTORITE DE TEST",
  serie: "05ED",
  validDu: "2026-01-01T00:00:00.000Z",
  validAu: "2028-01-01T00:00:00.000Z",
  empreinte: "c".repeat(64),
  chargeLe: "2026-10-01T00:00:00.000Z",
  chargePar: "Admin",
  expire: false,
};
const etatSignature = (extra: Record<string, unknown> = {}) => ({ configuree: true, certificat, deverrouille: false, expireLe: null, ...extra });

function monter(f: Facture | null, onOpenCabinet = vi.fn(), onOpenSignature = vi.fn()) {
  magasin.list = f ? [f] : [];
  render(
    <MemoryRouter>
      <FactureElectroniqueDialog facture={f} onOpenChange={vi.fn()} onOpenCabinet={onOpenCabinet} onOpenSignature={onOpenSignature} />
    </MemoryRouter>,
  );
  return { onOpenCabinet, onOpenSignature };
}

beforeEach(() => {
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  magasin.conformite.mockReset();
  magasin.preparer.mockReset();
  magasin.telechargerXml.mockReset();
  magasin.signature = etatSignature();
  magasin.fetchSignature.mockReset().mockResolvedValue(magasin.signature);
  magasin.signer.mockReset();
  magasin.deverrouiller.mockReset().mockResolvedValue(undefined);
  magasin.verrouiller.mockReset().mockResolvedValue(undefined);
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

  describe("signature électronique", () => {
    const preparee = () => facture({ einvoice: { statut: "prete", genereLe: "2026-10-17T10:00:00Z", sha256: "b".repeat(64) } });

    it("verrouillée : demande le mot de passe, ne propose pas de signer, et le mot de passe n'est pas gardé dans le champ", async () => {
      magasin.conformite.mockResolvedValue(etatPret);
      monter(preparee());
      expect(await screen.findByText(/La signature est verrouillée/)).toBeTruthy();
      expect((screen.getByRole("button", { name: "Signer la facture" }) as HTMLButtonElement).disabled).toBe(true);
      const champ = screen.getByLabelText("Mot de passe du certificat") as HTMLInputElement;
      expect(champ.type).toBe("password");
      fireEvent.change(champ, { target: { value: "secret-de-test" } });
      fireEvent.click(screen.getByRole("button", { name: "Déverrouiller" }));
      await waitFor(() => expect(magasin.deverrouiller).toHaveBeenCalledWith("secret-de-test"));
      await waitFor(() => expect((screen.getByLabelText("Mot de passe du certificat") as HTMLInputElement).value).toBe(""));
    });

    it("déverrouillée : signe après confirmation, avec l'identifiant de la facture", async () => {
      magasin.signature = etatSignature({ deverrouille: true, expireLe: "2026-10-17T12:00:00Z" });
      magasin.conformite.mockResolvedValue(etatPret);
      magasin.signer.mockResolvedValue({ ...etatPret, einvoice: { statut: "signee", genereLe: null, sha256: "", signeLe: "2026-10-17T11:00:00Z" } });
      monter(preparee());
      expect(await screen.findByText(/Signature déverrouillée/)).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Signer la facture" }));
      expect(magasin.signer).not.toHaveBeenCalled();
      expect(await screen.findByText(/ne peut plus être régénérée, modifiée ni annulée/)).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Signer" }));
      await waitFor(() => expect(magasin.signer).toHaveBeenCalledWith("f1"));
    });

    it("aucun certificat ou signature désactivée : pas de signature possible, avec le bon renvoi", async () => {
      magasin.signature = etatSignature({ certificat: null });
      magasin.conformite.mockResolvedValue(etatPret);
      const { onOpenSignature } = monter(preparee());
      fireEvent.click(await screen.findByRole("button", { name: "Charger le certificat" }));
      expect(onOpenSignature).toHaveBeenCalled();
      expect((screen.getByRole("button", { name: "Signer la facture" }) as HTMLButtonElement).disabled).toBe(true);

      cleanup();
      magasin.signature = etatSignature({ configuree: false, certificat: null });
      monter(preparee());
      expect(await screen.findByText(/n'est pas activée sur ce serveur/)).toBeTruthy();
      expect((screen.getByRole("button", { name: "Signer la facture" }) as HTMLButtonElement).disabled).toBe(true);
    });

    it("certificat expiré : signature refusée dès l'écran", async () => {
      magasin.signature = etatSignature({ certificat: { ...certificat, expire: true }, deverrouille: true });
      magasin.conformite.mockResolvedValue(etatPret);
      monter(preparee());
      expect(await screen.findByText(/Le certificat de signature est expiré/)).toBeTruthy();
      expect((screen.getByRole("button", { name: "Signer la facture" }) as HTMLButtonElement).disabled).toBe(true);
    });

    it("facture signée : fichier figé, téléchargement du XML signé ou sans signature, plus de signature ni de régénération", async () => {
      magasin.conformite.mockResolvedValue(etatPret);
      monter(facture({ einvoice: { statut: "signee", genereLe: "2026-10-17T10:00:00Z", sha256: "b".repeat(64), signeLe: "2026-10-17T11:00:00Z" } }));
      expect(await screen.findByText("Facture électronique signée")).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Signer la facture" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Régénérer" })).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: /Télécharger le XML signé/ }));
      expect(magasin.telechargerXml).toHaveBeenCalledWith("f1", "2026-0001", "signe");
      fireEvent.click(screen.getByRole("button", { name: "Télécharger sans signature" }));
      expect(magasin.telechargerXml).toHaveBeenCalledWith("f1", "2026-0001", "non-signe");
      expect(magasin.fetchSignature).not.toHaveBeenCalled();
    });
  });
});
