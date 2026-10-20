// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { setToken } from "@/lib/api";
import { useAuth } from "@/store/auth";
import { AppareilsEmployeDialog, MesAppareilsDialog } from "./AppareilsConnectes";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
import { toast } from "sonner";

const reponse = (status: number, corps: unknown) => new Response(JSON.stringify(corps), { status, headers: { "Content-Type": "application/json" } });
const session = (id: string, appareil: string, extra: object = {}) => ({ id, courante: false, appareil, adresse: "10.0.0.1", creeLe: "2026-10-20T08:00:00Z", derniereActivite: new Date().toISOString(), expireLe: "2026-10-21T08:00:00Z", ...extra });
const PC = session("s-pc", "Chrome / Brave sur Windows", { courante: true });
const TEL = session("s-tel", "Safari sur iPhone", { adresse: "41.226.0.5" });
const AUTRE = session("s-mac", "Safari sur macOS", { adresse: "41.226.0.9" });

/** Serveur simulé : réponses dans l'ordre ; les appels sont gardés pour vérification. */
function serveur(...reponses: Response[]) {
  const f = vi.fn();
  reponses.forEach((r) => f.mockResolvedValueOnce(r));
  vi.stubGlobal("fetch", f);
  return f;
}
const appel = (f: ReturnType<typeof vi.fn>, n: number) => ({ url: String(f.mock.calls[n][0]), methode: f.mock.calls[n][1].method });

beforeEach(() => {
  localStorage.clear();
  setToken("jeton");
  vi.mocked(toast.success).mockReset();
  vi.mocked(toast.error).mockReset();
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("mes appareils connectés", () => {
  it("liste chaque appareil avec son adresse ; l'appareil courant est marqué et n'a pas de bouton « Déconnecter »", async () => {
    serveur(reponse(200, [PC, TEL]));
    render(<MesAppareilsDialog open onOpenChange={vi.fn()} />);
    const liste = await screen.findByRole("list", { name: "Appareils connectés" });
    const lignes = within(liste).getAllByRole("listitem");
    expect(lignes).toHaveLength(2);
    expect(within(lignes[0]).getByText("Chrome / Brave sur Windows")).toBeTruthy();
    expect(within(lignes[0]).getByText("Cet appareil")).toBeTruthy();
    expect(within(lignes[0]).queryByRole("button")).toBeNull();
    expect(within(lignes[1]).getByText("Safari sur iPhone")).toBeTruthy();
    expect(within(lignes[1]).getByText(/41\.226\.0\.5/)).toBeTruthy();
    expect(within(lignes[1]).getByRole("button", { name: /Déconnecter Safari sur iPhone/ })).toBeTruthy();
  });

  it("« Déconnecter » ferme UN appareil, prévient, et recharge la liste", async () => {
    const f = serveur(reponse(200, [PC, TEL, AUTRE]), reponse(200, { ok: true }), reponse(200, [PC, AUTRE]));
    render(<MesAppareilsDialog open onOpenChange={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: /Déconnecter Safari sur iPhone/ }));
    await waitFor(() => expect(screen.queryByText("Safari sur iPhone")).toBeNull());
    expect(appel(f, 1)).toEqual({ url: "/api/auth/sessions/s-tel/revoquer", methode: "POST" });
    expect(screen.getByText("Safari sur macOS")).toBeTruthy();
    expect(toast.success).toHaveBeenCalledWith("Appareil déconnecté");
  });

  it("un refus du serveur est annoncé ; la liste reste à jour", async () => {
    serveur(reponse(200, [PC, TEL]), reponse(404, { error: "Cette session n'existe plus." }), reponse(200, [PC]));
    render(<MesAppareilsDialog open onOpenChange={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: /Déconnecter Safari sur iPhone/ }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Cette session n'existe plus."));
    await waitFor(() => expect(screen.queryByText("Safari sur iPhone")).toBeNull());
  });

  it("« Déconnecter tous les autres » : proposé seulement s'il y a d'autres appareils ; garde cet appareil connecté", async () => {
    const f = serveur(reponse(200, [PC, TEL, AUTRE]), reponse(200, { token: "jeton-neuf" }), reponse(200, [PC]));
    render(<MesAppareilsDialog open onOpenChange={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: /Déconnecter tous les autres/ }));
    await waitFor(() => expect(screen.queryByText("Safari sur iPhone")).toBeNull());
    expect(appel(f, 1)).toEqual({ url: "/api/auth/deconnecter-autres", methode: "POST" });
    expect(localStorage.getItem("cabinet-token")).toBe("jeton-neuf");
    expect(screen.queryByRole("button", { name: /Déconnecter tous les autres/ })).toBeNull();
  });

  it("seul cet appareil : pas de bouton global ; liste qui ne se charge pas : message d'erreur", async () => {
    serveur(reponse(200, [PC]));
    render(<MesAppareilsDialog open onOpenChange={vi.fn()} />);
    await screen.findByRole("list", { name: "Appareils connectés" });
    expect(screen.queryByRole("button", { name: /Déconnecter tous les autres/ })).toBeNull();
    cleanup();
    serveur(reponse(500, { error: "Erreur" }));
    render(<MesAppareilsDialog open onOpenChange={vi.fn()} />);
    expect((await screen.findByRole("alert")).textContent).toMatch(/n'a pas pu être chargée/);
  });

  it("rien n'est chargé tant que la fenêtre est fermée", () => {
    const f = serveur();
    render(<MesAppareilsDialog open={false} onOpenChange={vi.fn()} />);
    expect(f).not.toHaveBeenCalled();
    expect(useAuth.getState()).toBeDefined();
  });
});

describe("appareils connectés d'un employé (administrateur)", () => {
  const employe = { id: "e1", nom: "Aya Ben Salah" };

  it("liste les appareils de l'employé, ferme l'un d'eux", async () => {
    const f = serveur(reponse(200, [TEL, AUTRE]), reponse(200, { ok: true }), reponse(200, [AUTRE]));
    render(<AppareilsEmployeDialog employe={employe} onClose={vi.fn()} />);
    expect(await screen.findByText(/Appareils connectés — Aya Ben Salah/)).toBeTruthy();
    expect(appel(f, 0).url).toBe("/api/employes/e1/sessions");
    fireEvent.click(await screen.findByRole("button", { name: /Déconnecter Safari sur iPhone/ }));
    await waitFor(() => expect(screen.queryByText("Safari sur iPhone")).toBeNull());
    expect(appel(f, 1)).toEqual({ url: "/api/employes/e1/sessions/s-tel/revoquer", methode: "POST" });
  });

  it("« Tout fermer » déconnecte toutes ses sessions et le dit", async () => {
    const f = serveur(reponse(200, [TEL, AUTRE]), reponse(200, { ok: true, revoquees: 2 }), reponse(200, []));
    render(<AppareilsEmployeDialog employe={employe} onClose={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Tout fermer" }));
    expect(await screen.findByText("Aucune session ouverte pour ce compte.")).toBeTruthy();
    expect(appel(f, 1)).toEqual({ url: "/api/employes/e1/sessions/revoquer-toutes", methode: "POST" });
    expect(toast.success).toHaveBeenCalledWith("2 sessions fermées");
  });

  it("fermée (aucun employé) : rien n'est demandé au serveur", () => {
    const f = serveur();
    render(<AppareilsEmployeDialog employe={null} onClose={vi.fn()} />);
    expect(f).not.toHaveBeenCalled();
  });
});
