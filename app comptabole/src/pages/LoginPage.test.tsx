// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { getToken } from "@/lib/api";
import { useAuth } from "@/store/auth";
import { LoginPage } from "./LoginPage";

const reponse = (status: number, corps: unknown) => new Response(JSON.stringify(corps), { status, headers: { "Content-Type": "application/json" } });
const SESSION = { role: "admin", poste: null, employeId: null, nom: "Admin", fonction: "", initiales: "A", cabinetNom: "C", permissions: {}, societeIds: null };

function afficher() {
  render(
    <MemoryRouter initialEntries={["/login"]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<p>Tableau de bord</p>} />
      </Routes>
    </MemoryRouter>,
  );
}
const saisir = (libelle: RegExp | string, valeur: string) => fireEvent.change(screen.getByLabelText(libelle), { target: { value: valeur } });

beforeEach(() => {
  localStorage.clear();
  useAuth.setState({ status: "anon", session: null });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("page de connexion : double authentification", () => {
  it("sans 2FA : identifiant et mot de passe suffisent", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reponse(200, { token: "t", session: SESSION })));
    afficher();
    saisir("Identifiant", "admin");
    saisir("Mot de passe", "mdp");
    fireEvent.click(screen.getByRole("button", { name: /Se connecter/ }));
    expect(await screen.findByText("Tableau de bord")).toBeTruthy();
    expect(getToken()).toBe("t");
  });

  it("avec 2FA : le mot de passe mène à l'étape du code ; le bon code ouvre la session", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(reponse(200, { etape: "2fa", ticket: "ticket-court" }))
      .mockResolvedValueOnce(reponse(200, { token: "jeton-session", session: SESSION }));
    vi.stubGlobal("fetch", fetchMock);
    afficher();
    saisir("Identifiant", "admin");
    saisir("Mot de passe", "mdp");
    fireEvent.click(screen.getByRole("button", { name: /Se connecter/ }));
    const form = await screen.findByRole("form", { name: "Vérification en deux étapes" });
    expect(form).toBeTruthy();
    expect(getToken()).toBeNull(); // pas de session avant le code
    saisir("Code de vérification", "123 456");
    fireEvent.click(screen.getByRole("button", { name: /Vérifier/ }));
    expect(await screen.findByText("Tableau de bord")).toBeTruthy();
    expect(getToken()).toBe("jeton-session");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ ticket: "ticket-court", code: "123 456" });
  });

  it("un code incorrect affiche l'erreur, reste sur l'étape du code et vide le champ", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(reponse(200, { etape: "2fa", ticket: "t" })).mockResolvedValueOnce(reponse(401, { error: "Code incorrect." })));
    afficher();
    saisir("Identifiant", "admin");
    saisir("Mot de passe", "mdp");
    fireEvent.click(screen.getByRole("button", { name: /Se connecter/ }));
    await screen.findByRole("form", { name: "Vérification en deux étapes" });
    saisir("Code de vérification", "000000");
    fireEvent.click(screen.getByRole("button", { name: /Vérifier/ }));
    expect((await screen.findByRole("alert")).textContent).toBe("Code incorrect.");
    expect((screen.getByLabelText("Code de vérification") as HTMLInputElement).value).toBe("");
    expect(getToken()).toBeNull();
  });

  it("un ticket expiré ramène à la saisie du mot de passe ; « Revenir au mot de passe » aussi", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(reponse(200, { etape: "2fa", ticket: "t" })).mockResolvedValueOnce(reponse(401, { error: "La vérification a expiré : reprenez la connexion." })));
    afficher();
    saisir("Identifiant", "admin");
    saisir("Mot de passe", "mdp");
    fireEvent.click(screen.getByRole("button", { name: /Se connecter/ }));
    await screen.findByRole("form", { name: "Vérification en deux étapes" });
    saisir("Code de vérification", "123456");
    fireEvent.click(screen.getByRole("button", { name: /Vérifier/ }));
    await waitFor(() => expect(screen.queryByRole("form", { name: "Vérification en deux étapes" })).toBeNull());
    expect(screen.getByRole("button", { name: /Se connecter/ })).toBeTruthy();
  });
});

describe("page de connexion : accueil personnalisé", () => {
  const titre = () => screen.getByRole("heading", { level: 1 }).textContent;

  it("affiche « Connexion » tant que l'identifiant est vide, puis « Bon retour, Prénom » avec les initiales", () => {
    afficher();
    expect(titre()).toBe("Connexion");
    saisir("Identifiant", "mohamed.ayedi");
    expect(titre()).toBe("Bon retour, Mohamed");
    expect(screen.getByText("MA")).toBeTruthy();
    saisir("Identifiant", "");
    expect(titre()).toBe("Connexion");
    expect(screen.queryByText("MA")).toBeNull();
  });

  it("déduit le prénom d'une adresse e-mail, d'un seul mot, et ignore une saisie sans lettre", () => {
    afficher();
    saisir("Identifiant", "SARA_ben-ali@cabinet.tn");
    expect(titre()).toBe("Bon retour, Sara");
    expect(screen.getByText("SB")).toBeTruthy();
    saisir("Identifiant", "admin");
    expect(titre()).toBe("Bon retour, Admin");
    expect(screen.getByText("AD")).toBeTruthy();
    saisir("Identifiant", "1234");
    expect(titre()).toBe("Connexion");
  });

  it("raccourcit un très long prénom", () => {
    afficher();
    saisir("Identifiant", "abcdefghijklmnopqrstuvwxyz");
    expect(titre()).toBe("Bon retour, Abcdefghijklmno…");
  });

  it("avertit quand le verrouillage majuscules est actif sur le mot de passe", () => {
    afficher();
    const mdp = screen.getByLabelText("Mot de passe");
    expect(screen.queryByRole("status")).toBeNull();
    fireEvent.keyDown(mdp, { key: "A", modifierCapsLock: true });
    expect(screen.getByRole("status").textContent).toContain("Verrouillage majuscules");
    fireEvent.keyUp(mdp, { key: "A", modifierCapsLock: false });
    expect(screen.queryByRole("status")).toBeNull();
  });
});
