// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

// Magasin simulé, données fictives : aucune requête réseau, aucun vrai certificat.
const magasin = vi.hoisted(() => ({
  signature: null as unknown,
  fetchSignature: vi.fn(),
  chargerCertificat: vi.fn(),
  supprimerCertificat: vi.fn(),
  deverrouiller: vi.fn(),
  verrouiller: vi.fn(),
}));
vi.mock("@/store/facturation", () => ({ useFacturation: (selecteur: (s: typeof magasin) => unknown) => selecteur(magasin) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { SignatureElectroniqueDialog } from "./SignatureElectroniqueDialog";

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
const etat = (extra: Record<string, unknown> = {}) => ({ configuree: true, certificat: null, deverrouille: false, expireLe: null, ...extra });

beforeEach(() => {
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  magasin.signature = etat();
  magasin.fetchSignature.mockReset().mockImplementation(async () => magasin.signature);
  magasin.chargerCertificat.mockReset();
  magasin.supprimerCertificat.mockReset().mockResolvedValue(undefined);
  magasin.deverrouiller.mockReset().mockResolvedValue(undefined);
  magasin.verrouiller.mockReset().mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const monter = () => render(<SignatureElectroniqueDialog open onOpenChange={vi.fn()} />);
const fichierDeTest = () => new File([new Uint8Array([1, 2, 3])], "cabinet.p12", { type: "application/x-pkcs12" });

describe("SignatureElectroniqueDialog", () => {
  it("sans certificat : propose de le charger ; le bouton reste inactif sans fichier et sans mot de passe", async () => {
    monter();
    expect(await screen.findByText("Charger le certificat")).toBeTruthy();
    const bouton = screen.getByRole("button", { name: "Enregistrer le certificat" }) as HTMLButtonElement;
    expect(bouton.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Fichier du certificat (.p12 ou .pfx)"), { target: { files: [fichierDeTest()] } });
    expect(bouton.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Mot de passe du certificat"), { target: { value: "mdp-de-test" } });
    expect(bouton.disabled).toBe(false);
  });

  it("envoie le fichier et le mot de passe une seule fois, vide le champ du mot de passe et signale les avertissements du serveur", async () => {
    magasin.chargerCertificat.mockImplementation(async () => {
      magasin.signature = etat({ certificat, deverrouille: true, expireLe: "2026-10-17T12:00:00Z", avertissements: ["Ce certificat n'est pas déclaré pour la signature électronique."] });
      return magasin.signature;
    });
    monter();
    await screen.findByText("Charger le certificat");
    const fichier = fichierDeTest();
    fireEvent.change(screen.getByLabelText("Fichier du certificat (.p12 ou .pfx)"), { target: { files: [fichier] } });
    const champ = screen.getByLabelText("Mot de passe du certificat") as HTMLInputElement;
    expect(champ.type).toBe("password");
    fireEvent.change(champ, { target: { value: "mdp-de-test" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer le certificat" }));
    await waitFor(() => expect(magasin.chargerCertificat).toHaveBeenCalledWith(fichier, "mdp-de-test"));
    // le fichier est enregistré : le formulaire disparaît, le mot de passe n'est plus nulle part dans la page
    await waitFor(() => expect(screen.queryByLabelText("Mot de passe du certificat")).toBeNull());
    expect(document.body.innerHTML).not.toContain("mdp-de-test");
    expect(await screen.findByText(/n'est pas déclaré pour la signature électronique/)).toBeTruthy();
  });

  it("certificat enregistré : détail, aucune donnée secrète, suppression après confirmation", async () => {
    magasin.signature = etat({ certificat });
    monter();
    expect(await screen.findByText("Certificat enregistré")).toBeTruthy();
    expect(screen.getByText(certificat.sujet)).toBeTruthy();
    expect(screen.getByText("c".repeat(64))).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Supprimer" }));
    expect(magasin.supprimerCertificat).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByRole("button", { name: "Supprimer" }).at(-1)!);
    await waitFor(() => expect(magasin.supprimerCertificat).toHaveBeenCalled());
  });

  it("certificat expiré : signalé en rouge et plus de déverrouillage proposé", async () => {
    magasin.signature = etat({ certificat: { ...certificat, expire: true } });
    monter();
    expect(await screen.findByText("Certificat expiré")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Déverrouiller" })).toBeNull();
  });

  it("serveur sans clé de chiffrement : explication claire et aucun formulaire de chargement", async () => {
    magasin.signature = etat({ configuree: false });
    monter();
    expect(await screen.findByText(/n'est pas activée sur ce serveur/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Enregistrer le certificat" })).toBeNull();
  });
});
