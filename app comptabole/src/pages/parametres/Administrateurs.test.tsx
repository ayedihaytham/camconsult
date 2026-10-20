// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Administrateurs } from "./Administrateurs";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const reponse = (status: number, corps: unknown) => new Response(JSON.stringify(corps), { status, headers: { "Content-Type": "application/json" } });
const admin = (id: string, extra: object = {}) => ({
  id, identifiant: `id.${id}`, nom: `Admin ${id}`, fonction: "", statut: "actif", principal: false, doitChangerMotDePasse: false,
  doubleAuthentification: false, derniereConnexion: null, creeLe: "2026-10-01T08:00:00Z", creePar: "", moi: false, ...extra,
});
const PRINCIPAL = admin("p", { principal: true, moi: true, doubleAuthentification: true });
const KARIM = admin("k", { doubleAuthentification: true });
const SARA = admin("s", { statut: "desactive" });

function serveur(...reponses: Response[]) {
  const f = vi.fn();
  reponses.forEach((r) => f.mockResolvedValueOnce(r));
  f.mockImplementation(async () => reponse(200, []));
  vi.stubGlobal("fetch", f);
  return f;
}
const appel = (f: ReturnType<typeof vi.fn>, n: number) => ({ url: String(f.mock.calls[n][0]), methode: f.mock.calls[n][1].method, corps: f.mock.calls[n][1].body ? JSON.parse(f.mock.calls[n][1].body) : undefined });

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("administrateurs (Paramètres)", () => {
  it("liste les comptes avec leurs repères ; le principal et vous n'ont pas d'actions de gestion", async () => {
    serveur(reponse(200, [PRINCIPAL, KARIM, SARA]));
    render(<Administrateurs />);
    const liste = await screen.findByRole("list", { name: "Liste des administrateurs" });
    const lignes = within(liste).getAllByRole("listitem");
    expect(lignes).toHaveLength(3);
    expect(within(lignes[0]).getByText("Principal")).toBeTruthy();
    expect(within(lignes[0]).getByText("Vous")).toBeTruthy();
    expect(within(lignes[0]).queryByRole("button")).toBeNull();
    expect(within(lignes[1]).getByRole("button", { name: /Désactiver Admin k/ })).toBeTruthy();
    expect(within(lignes[1]).getByRole("button", { name: /Retirer la double authentification de Admin k/ })).toBeTruthy();
    expect(within(lignes[2]).getByText("Désactivé")).toBeTruthy();
    expect(within(lignes[2]).getByRole("button", { name: /Réactiver Admin s/ })).toBeTruthy();
    expect(within(lignes[2]).queryByRole("button", { name: /Désactiver/ })).toBeNull();
  });

  it("création : demande votre mot de passe, montre le mot de passe provisoire une fois, ne se ferme qu'une fois transmis", async () => {
    const f = serveur(reponse(200, [PRINCIPAL]), reponse(201, { ...admin("n", { nom: "Nadia Ben Ali", identifiant: "nadia.b", doitChangerMotDePasse: true }), motDePasseProvisoire: "Abcd-Efgh-Jkmn" }), reponse(200, [PRINCIPAL]));
    render(<Administrateurs />);
    await screen.findByRole("list", { name: "Liste des administrateurs" });
    fireEvent.click(screen.getByRole("button", { name: /Ajouter un administrateur/ }));
    const creer = screen.getByRole("button", { name: "Créer le compte" }) as HTMLButtonElement;
    expect(creer.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Nom complet"), { target: { value: "Nadia Ben Ali" } });
    fireEvent.change(screen.getByLabelText("Identifiant de connexion"), { target: { value: "nadia.b" } });
    fireEvent.change(screen.getByLabelText(/Votre mot de passe/), { target: { value: "Mon-Mdp" } });
    fireEvent.click(creer);
    expect((await screen.findByTestId("mdp-provisoire")).textContent).toContain("Abcd-Efgh-Jkmn");
    expect(appel(f, 1)).toEqual({ url: "/api/administrateurs", methode: "POST", corps: { nom: "Nadia Ben Ali", fonction: "", identifiant: "nadia.b", motDePasse: "Mon-Mdp" } });
    const terminer = screen.getByRole("button", { name: "Terminer" }) as HTMLButtonElement;
    expect(terminer.disabled).toBe(true);
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(terminer);
    await waitFor(() => expect(screen.queryByTestId("mdp-provisoire")).toBeNull());
  });

  it("un refus du serveur est affiché dans la fenêtre (identifiant déjà pris)", async () => {
    serveur(reponse(200, [PRINCIPAL]), reponse(409, { error: "Cet identifiant existe déjà." }));
    render(<Administrateurs />);
    await screen.findByRole("list", { name: "Liste des administrateurs" });
    fireEvent.click(screen.getByRole("button", { name: /Ajouter un administrateur/ }));
    fireEvent.change(screen.getByLabelText("Nom complet"), { target: { value: "Doublon" } });
    fireEvent.change(screen.getByLabelText("Identifiant de connexion"), { target: { value: "karim.t" } });
    fireEvent.change(screen.getByLabelText(/Votre mot de passe/), { target: { value: "Mon-Mdp" } });
    fireEvent.click(screen.getByRole("button", { name: "Créer le compte" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Cet identifiant existe déjà.");
  });

  it("désactiver : confirmation par mot de passe, puis la liste est rechargée", async () => {
    const f = serveur(reponse(200, [PRINCIPAL, KARIM]), reponse(200, { ok: true }), reponse(200, [PRINCIPAL, admin("k", { statut: "desactive" })]));
    render(<Administrateurs />);
    fireEvent.click(await screen.findByRole("button", { name: /Désactiver Admin k/ }));
    fireEvent.change(screen.getByLabelText(/Votre mot de passe/), { target: { value: "Mon-Mdp" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Désactiver" }).at(-1)!);
    expect(await screen.findByText("Désactivé")).toBeTruthy();
    expect(appel(f, 1)).toEqual({ url: "/api/administrateurs/k/desactiver", methode: "POST", corps: { motDePasse: "Mon-Mdp" } });
  });

  it("réinitialiser : montre le nouveau mot de passe provisoire", async () => {
    serveur(reponse(200, [PRINCIPAL, KARIM]), reponse(200, { motDePasseProvisoire: "Zzzz-Yyyy-Xxxx" }), reponse(200, [PRINCIPAL, KARIM]));
    render(<Administrateurs />);
    fireEvent.click(await screen.findByRole("button", { name: /Réinitialiser le mot de passe de Admin k/ }));
    fireEvent.change(screen.getByLabelText(/Votre mot de passe/), { target: { value: "Mon-Mdp" } });
    fireEvent.click(screen.getByRole("button", { name: "Réinitialiser" }));
    expect((await screen.findByTestId("mdp-provisoire")).textContent).toContain("Zzzz-Yyyy-Xxxx");
  });

  it("appareils d'un collègue : liste ses sessions", async () => {
    const f = serveur(reponse(200, [PRINCIPAL, KARIM]), reponse(200, [{ id: "s1", courante: false, appareil: "Chrome / Brave sur Windows", adresse: "10.0.0.2", creeLe: "2026-10-20T08:00:00Z", derniereActivite: new Date().toISOString(), expireLe: "2026-10-21T08:00:00Z" }]));
    render(<Administrateurs />);
    fireEvent.click(await screen.findByRole("button", { name: /Appareils connectés de Admin k/ }));
    expect(await screen.findByText("Chrome / Brave sur Windows")).toBeTruthy();
    expect(appel(f, 1).url).toBe("/api/administrateurs/k/sessions");
  });
});
