// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

// Magasin simulé, données fictives : aucune requête réseau.
const magasin = vi.hoisted(() => ({
  ttn: null as unknown,
  cabinet: null as unknown,
  fetchTtn: vi.fn(),
  enregistrerTtn: vi.fn(),
  supprimerTtn: vi.fn(),
  testerTtn: vi.fn(),
}));
vi.mock("@/store/facturation", () => ({ useFacturation: (selecteur: (s: typeof magasin) => unknown) => selecteur(magasin) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { TtnConnexionDialog } from "./TtnConnexionDialog";

const connexion = { url: "https://ttn.exemple/EfactService", login: "compte", matricule: "", environnement: "test", motDePasseDefini: true, majLe: "2026-10-17T10:00:00Z", majPar: "Admin", dernierEssai: null };
const etat = (extra: Record<string, unknown> = {}) => ({ configuree: true, connexion: null, ...extra });

beforeEach(() => {
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  magasin.ttn = etat();
  magasin.cabinet = { matriculeFiscal: "1464520LAP000" };
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
  it("première saisie : mot de passe obligatoire, badge d'environnement de test, envoi une fois puis champ vidé", async () => {
    monter();
    expect(await screen.findByText("Environnement de test")).toBeTruthy();
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

  it("environnement : bascule Test / Réel en un clic, avec le badge et le message qui suivent", async () => {
    monter();
    const groupe = await screen.findByRole("group", { name: "Environnement" });
    expect(within(groupe).getByRole("button", { name: "Test" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(within(groupe).getByRole("button", { name: "Réel" }));
    expect(within(groupe).getByRole("button", { name: "Réel" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("Environnement réel")).toBeTruthy();
    expect(screen.getByText("Réel : les factures déposées seront définitives.")).toBeTruthy();
  });

  it("matricule : indique ce qui sera réellement envoyé à TTN (celui du cabinet par défaut, ou celui saisi)", async () => {
    monter();
    expect(await screen.findByText(/Envoyé à TTN :/)).toBeTruthy();
    expect(screen.getByText("1464520LAP000")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Matricule fiscal déclaré chez TTN"), { target: { value: "9999999ZZZ000" } });
    expect(screen.getByText("9999999ZZZ000")).toBeTruthy();
  });

  it("accès déjà enregistrés : mot de passe jamais relu (« Enregistré », bouton Changer), carte d'état et essai de connexion", async () => {
    magasin.ttn = etat({ connexion });
    magasin.testerTtn.mockResolvedValue("Le service TTN a répondu (0 résultat pour le numéro d'essai).");
    monter();
    expect(await screen.findByDisplayValue("https://ttn.exemple/EfactService")).toBeTruthy();
    expect(screen.getByText("Enregistré (chiffré)")).toBeTruthy();
    expect(screen.queryByLabelText("Mot de passe")).toBeNull();
    expect(screen.getByText("Jamais essayé")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(magasin.enregistrerTtn).toHaveBeenCalledWith(expect.objectContaining({ motDePasse: undefined, login: "compte" })));
    fireEvent.click(screen.getByRole("button", { name: "Tester la connexion" }));
    expect(await screen.findByText(/Le service TTN a répondu/)).toBeTruthy();
    await waitFor(() => expect(magasin.fetchTtn).toHaveBeenCalledTimes(2)); // état relu après l'essai
  });

  it("« Changer » fait apparaître le champ du nouveau mot de passe", async () => {
    magasin.ttn = etat({ connexion });
    monter();
    fireEvent.click(await screen.findByRole("button", { name: "Changer" }));
    const champ = screen.getByLabelText("Mot de passe") as HTMLInputElement;
    fireEvent.change(champ, { target: { value: "nouveau-mdp" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(magasin.enregistrerTtn).toHaveBeenCalledWith(expect.objectContaining({ motDePasse: "nouveau-mdp" })));
  });

  it("modifications non enregistrées : l'essai de connexion est refusé avec une explication", async () => {
    magasin.ttn = etat({ connexion });
    monter();
    const essai = (await screen.findByRole("button", { name: "Tester la connexion" })) as HTMLButtonElement;
    expect(essai.disabled).toBe(false);
    fireEvent.change(screen.getByLabelText("Adresse du service TTN"), { target: { value: "https://autre.exemple/x" } });
    expect(essai.disabled).toBe(true);
    expect(screen.getByText(/Enregistrez d'abord vos modifications/)).toBeTruthy();
  });

  it("dernier essai mémorisé par le serveur : réussi ou échoué, avec sa date", async () => {
    magasin.ttn = etat({ connexion: { ...connexion, dernierEssai: { ok: true, le: "2026-10-17T10:30:00Z" } } });
    monter();
    expect(await screen.findByText(/Réussi · 17\/10\/2026/)).toBeTruthy();
    cleanup();
    magasin.ttn = etat({ connexion: { ...connexion, dernierEssai: { ok: false, le: "2026-10-17T10:30:00Z" } } });
    monter();
    expect(await screen.findByText(/Échoué · 17\/10\/2026/)).toBeTruthy();
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
    fireEvent.click(await screen.findByRole("button", { name: "Supprimer les accès" }));
    expect(magasin.supprimerTtn).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByRole("button", { name: "Supprimer" }).at(-1)!);
    await waitFor(() => expect(magasin.supprimerTtn).toHaveBeenCalled());

    cleanup();
    magasin.ttn = etat({ configuree: false });
    monter();
    expect(await screen.findByText(/n'est pas activé sur ce serveur/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Enregistrer" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByLabelText("Adresse du service TTN")).toBeNull();
  });
});
