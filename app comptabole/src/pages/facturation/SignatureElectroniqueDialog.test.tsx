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
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("@/store/facturation", () => ({ useFacturation: (selecteur: (s: typeof magasin) => unknown) => selecteur(magasin) }));
vi.mock("sonner", () => ({ toast }));

import { SignatureElectroniqueDialog } from "./SignatureElectroniqueDialog";

const dans = (jours: number) => new Date(Date.now() + jours * 24 * 3600 * 1000).toISOString();
const certificat = (jours = 200, extra: Record<string, unknown> = {}) => ({
  sujet: "C=TN, O=CABINET FICTIF, CN=CABINET DE TEST",
  emetteur: "C=TN, O=AUTORITE FICTIVE, CN=AUTORITE DE TEST",
  serie: "05ED",
  validDu: dans(jours - 365),
  validAu: dans(jours),
  empreinte: "c".repeat(64),
  chargeLe: "2026-10-01T00:00:00.000Z",
  chargePar: "Admin",
  expire: jours < 0,
  ...extra,
});
const etat = (extra: Record<string, unknown> = {}) => ({ configuree: true, certificat: null, deverrouille: false, expireLe: null, ...extra });

beforeEach(() => {
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  magasin.signature = etat();
  magasin.fetchSignature.mockReset().mockImplementation(async () => magasin.signature);
  magasin.chargerCertificat.mockReset();
  magasin.supprimerCertificat.mockReset().mockResolvedValue(undefined);
  magasin.deverrouiller.mockReset().mockResolvedValue(undefined);
  magasin.verrouiller.mockReset().mockResolvedValue(undefined);
  toast.success.mockReset();
  toast.error.mockReset();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const monter = () => render(<SignatureElectroniqueDialog open onOpenChange={vi.fn()} />);
const fichierDeTest = (nom = "cabinet.p12") => new File([new Uint8Array([1, 2, 3])], nom, { type: "application/x-pkcs12" });
const champFichier = () => screen.getByLabelText("Fichier du certificat (.p12 ou .pfx)");

describe("SignatureElectroniqueDialog", () => {
  it("sans certificat : zone de dépôt, étapes, bouton inactif tant que le fichier et le mot de passe ne sont pas donnés", async () => {
    monter();
    expect(await screen.findByText("Charger le certificat")).toBeTruthy();
    expect(screen.getByText("Glissez le fichier ici ou cliquez pour le choisir")).toBeTruthy();
    expect(screen.getByText("Aucun certificat")).toBeTruthy();
    const bouton = screen.getByRole("button", { name: "Enregistrer le certificat" }) as HTMLButtonElement;
    expect(bouton.disabled).toBe(true);
    expect(screen.getByRole("status").textContent).toBe("Choisissez le fichier et saisissez son mot de passe.");
    fireEvent.change(champFichier(), { target: { files: [fichierDeTest()] } });
    expect(screen.getByText(/cabinet\.p12 · 3 o/)).toBeTruthy();
    expect(bouton.disabled).toBe(true);
    expect(screen.getByRole("status").textContent).toBe("Saisissez le mot de passe du certificat.");
    fireEvent.change(screen.getByLabelText("Mot de passe du certificat"), { target: { value: "mdp-de-test" } });
    expect(bouton.disabled).toBe(false);
    expect(screen.getByRole("status").textContent).toBe("Prêt : le fichier sera vérifié puis chiffré.");
  });

  it("un fichier qui n'est pas .p12 / .pfx est refusé avec un message ; « Retirer » permet d'en choisir un autre", async () => {
    monter();
    await screen.findByText("Charger le certificat");
    fireEvent.change(champFichier(), { target: { files: [fichierDeTest("photo.png")] } });
    expect(toast.error).toHaveBeenCalledWith("Choisissez un fichier .p12 ou .pfx.");
    expect(screen.queryByText(/photo\.png/)).toBeNull();
    fireEvent.change(champFichier(), { target: { files: [fichierDeTest("cabinet.PFX")] } });
    expect(screen.getByText(/cabinet\.PFX/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retirer" }));
    expect(screen.getByText("Glissez le fichier ici ou cliquez pour le choisir")).toBeTruthy();
  });

  it("glisser-déposer : le fichier déposé est pris en compte", async () => {
    monter();
    const zone = await screen.findByRole("button", { name: "Choisir le fichier du certificat" });
    fireEvent.drop(zone, { dataTransfer: { files: [fichierDeTest("depose.p12")] } });
    expect(screen.getByText(/depose\.p12/)).toBeTruthy();
  });

  it("envoie le fichier et le mot de passe une seule fois, vide le champ du mot de passe et signale les avertissements du serveur", async () => {
    magasin.chargerCertificat.mockImplementation(async () => {
      magasin.signature = etat({ certificat: certificat(), deverrouille: true, expireLe: "2026-10-17T12:00:00Z", avertissements: ["Ce certificat n'est pas déclaré pour la signature électronique."] });
      return magasin.signature;
    });
    monter();
    await screen.findByText("Charger le certificat");
    const fichier = fichierDeTest();
    fireEvent.change(champFichier(), { target: { files: [fichier] } });
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

  it("certificat enregistré : détail complet, jauge de validité, aucune donnée secrète, suppression après confirmation", async () => {
    magasin.signature = etat({ certificat: certificat(200) });
    monter();
    expect(await screen.findByText("Certificat enregistré")).toBeTruthy();
    expect(screen.getByText("C=TN, O=CABINET FICTIF, CN=CABINET DE TEST")).toBeTruthy();
    expect(screen.getByText("c".repeat(64))).toBeTruthy();
    expect(screen.getByText(/Valide encore 200 jours/)).toBeTruthy();
    const jauge = screen.getByRole("progressbar", { name: "Validité restante" });
    expect(Number(jauge.getAttribute("aria-valuenow"))).toBeGreaterThan(50);
    fireEvent.click(screen.getByRole("button", { name: "Supprimer le certificat" }));
    expect(magasin.supprimerCertificat).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByRole("button", { name: "Supprimer" }).at(-1)!);
    await waitFor(() => expect(magasin.supprimerCertificat).toHaveBeenCalled());
  });

  it("certificat bientôt expiré : alerte et rappel de le renouveler", async () => {
    magasin.signature = etat({ certificat: certificat(12) });
    monter();
    expect(await screen.findByText(/Expire dans 12 jours : à renouveler/)).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("renouveler");
  });

  it("remplacer : le formulaire de chargement apparaît, « Annuler » le referme", async () => {
    magasin.signature = etat({ certificat: certificat(200) });
    monter();
    fireEvent.click(await screen.findByRole("button", { name: "Choisir un autre fichier…" }));
    expect(screen.getByText("Remplacer le certificat", { selector: "h2" })).toBeTruthy();
    expect(screen.getByText("Glissez le fichier ici ou cliquez pour le choisir")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
    expect(screen.queryByText("Glissez le fichier ici ou cliquez pour le choisir")).toBeNull();
  });

  it("certificat expiré : signalé en rouge et plus de déverrouillage proposé", async () => {
    magasin.signature = etat({ certificat: certificat(-10) });
    monter();
    expect(await screen.findByText("Certificat expiré")).toBeTruthy();
    expect(screen.getByText(/Expiré depuis le/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Déverrouiller" })).toBeNull();
  });

  it("serveur sans clé de chiffrement : explication claire et aucun formulaire de chargement", async () => {
    magasin.signature = etat({ configuree: false });
    monter();
    expect(await screen.findByText(/n'est pas activée sur ce serveur/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Enregistrer le certificat" })).toBeNull();
  });
});
