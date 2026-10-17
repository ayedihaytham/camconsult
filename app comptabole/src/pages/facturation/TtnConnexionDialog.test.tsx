// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

// Magasin simulé, données fictives : aucune requête réseau.
const magasin = vi.hoisted(() => ({
  ttn: null as unknown,
  fetchTtn: vi.fn(),
  enregistrerTtn: vi.fn(),
  supprimerTtn: vi.fn(),
  testerTtn: vi.fn(),
}));
vi.mock("@/store/facturation", () => ({ useFacturation: (selecteur: (s: typeof magasin) => unknown) => selecteur(magasin) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { TtnConnexionDialog } from "./TtnConnexionDialog";

const connexion = { url: "https://ttn.exemple/EfactService", login: "compte", matricule: "", environnement: "test", motDePasseDefini: true, majLe: "2026-10-17T10:00:00Z", majPar: "Admin" };
const etat = (extra: Record<string, unknown> = {}) => ({ configuree: true, connexion: null, ...extra });

beforeEach(() => {
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  magasin.ttn = etat();
  magasin.fetchTtn.mockReset().mockImplementation(async () => magasin.ttn);
  magasin.enregistrerTtn.mockReset().mockResolvedValue(undefined);
  magasin.supprimerTtn.mockReset().mockResolvedValue(undefined);
  magasin.testerTtn.mockReset();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const monter = () => render(<TtnConnexionDialog open onOpenChange={vi.fn()} />);

describe("TtnConnexionDialog", () => {
  it("première saisie : mot de passe obligatoire, bandeau de TEST, envoi une fois puis champ vidé", async () => {
    monter();
    expect(await screen.findByText(/ENVIRONNEMENT DE TEST/)).toBeTruthy();
    const bouton = screen.getByRole("button", { name: "Enregistrer" }) as HTMLButtonElement;
    fireEvent.change(screen.getByLabelText("Adresse du service TTN"), { target: { value: "https://ttn.exemple/EfactService" } });
    fireEvent.change(screen.getByLabelText("Identifiant El Fatoora"), { target: { value: "compte" } });
    expect(bouton.disabled).toBe(true); // pas de mot de passe
    const champ = screen.getByLabelText("Mot de passe") as HTMLInputElement;
    expect(champ.type).toBe("password");
    fireEvent.change(champ, { target: { value: "mdp-de-test-ttn" } });
    expect(bouton.disabled).toBe(false);
    fireEvent.click(bouton);
    await waitFor(() => expect(magasin.enregistrerTtn).toHaveBeenCalledWith({ url: "https://ttn.exemple/EfactService", login: "compte", motDePasse: "mdp-de-test-ttn", matricule: "", environnement: "test" }));
    await waitFor(() => expect((screen.getByLabelText("Mot de passe") as HTMLInputElement).value).toBe(""));
    expect(document.body.innerHTML).not.toContain("mdp-de-test-ttn");
  });

  it("accès déjà enregistrés : mot de passe jamais relu, modification sans le ressaisir, essai de connexion avec résultat", async () => {
    magasin.ttn = etat({ connexion });
    magasin.testerTtn.mockResolvedValue("Le service TTN a répondu (0 résultat pour le numéro d'essai).");
    monter();
    expect(await screen.findByDisplayValue("https://ttn.exemple/EfactService")).toBeTruthy();
    expect((screen.getByLabelText("Mot de passe") as HTMLInputElement).value).toBe("");
    expect(screen.getByText(/Déjà enregistré : laissez vide/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(magasin.enregistrerTtn).toHaveBeenCalledWith(expect.objectContaining({ motDePasse: undefined, login: "compte" })));
    fireEvent.click(screen.getByRole("button", { name: "Tester la connexion" }));
    expect(await screen.findByText(/Le service TTN a répondu/)).toBeTruthy();
  });

  it("essai refusé : le message d'erreur du serveur est affiché", async () => {
    magasin.ttn = etat({ connexion });
    magasin.testerTtn.mockRejectedValue(new Error("Le service TTN a refusé l'accès (identifiants ou droits)."));
    monter();
    fireEvent.click(await screen.findByRole("button", { name: "Tester la connexion" }));
    expect(await screen.findByText(/a refusé l'accès/)).toBeTruthy();
  });

  it("suppression après confirmation ; serveur sans clé de chiffrement : explication et aucun formulaire", async () => {
    magasin.ttn = etat({ connexion });
    monter();
    fireEvent.click(await screen.findByRole("button", { name: "Supprimer" }));
    expect(magasin.supprimerTtn).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByRole("button", { name: "Supprimer" }).at(-1)!);
    await waitFor(() => expect(magasin.supprimerTtn).toHaveBeenCalled());

    cleanup();
    magasin.ttn = etat({ configuree: false });
    monter();
    expect(await screen.findByText(/n'est pas activé sur ce serveur/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Enregistrer" })).toBeNull();
  });
});
