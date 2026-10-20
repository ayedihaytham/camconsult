// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { getToken, setToken } from "@/lib/api";
import { DoubleAuthentification } from "./DoubleAuthentification";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const reponse = (status: number, corps: unknown) => new Response(JSON.stringify(corps), { status, headers: { "Content-Type": "application/json" } });
const URI = "otpauth://totp/Cabinet%3Aadmin?secret=ABCDEFGHIJKLMNOPQRSTUVWXYZ234567&issuer=Cabinet";
const CODES = Array.from({ length: 10 }, (_, i) => `ABCD${i}-EFGH${i}`.replace(/[01]/g, "2"));

/** Serveur simulé : chaque appel renvoie, dans l'ordre, la réponse suivante. */
function serveur(...reponses: Response[]) {
  const f = vi.fn();
  reponses.forEach((r) => f.mockResolvedValueOnce(r));
  vi.stubGlobal("fetch", f);
  return f;
}
const corps = (f: ReturnType<typeof vi.fn>, n: number) => JSON.parse(f.mock.calls[n][1].body);

beforeEach(() => {
  localStorage.clear();
  setToken("jeton-initial");
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("double authentification (Paramètres)", () => {
  it("inactive : le dit, et propose de l'activer", async () => {
    serveur(reponse(200, { actif: false, codesSecoursRestants: 0 }));
    render(<DoubleAuthentification />);
    expect(await screen.findByText(/Inactive : seul le mot de passe/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Activer la double authentification/ })).toBeTruthy();
  });

  it("active : montre les codes de secours restants et avertit quand il en reste peu", async () => {
    serveur(reponse(200, { actif: true, codesSecoursRestants: 2 }));
    render(<DoubleAuthentification />);
    expect(await screen.findByText(/Active : un code est demandé à chaque connexion/)).toBeTruthy();
    expect(screen.getByText(/2 codes de secours restants/)).toBeTruthy();
    expect(screen.getByText(/générer de nouveaux/)).toBeTruthy();
  });

  it("parcours d'activation : mot de passe, QR code et clé, code de l'application, codes de secours à conserver avant de terminer", async () => {
    const f = serveur(
      reponse(200, { actif: false, codesSecoursRestants: 0 }),
      reponse(200, { secret: "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567", uri: URI }),
      reponse(200, { codesSecours: CODES, token: "jeton-apres-activation" }),
      reponse(200, { actif: true, codesSecoursRestants: 10 }),
    );
    render(<DoubleAuthentification />);
    fireEvent.click(await screen.findByRole("button", { name: /Activer la double authentification/ }));

    // 1. le mot de passe est redemandé
    const continuer = screen.getByRole("button", { name: "Continuer" }) as HTMLButtonElement;
    expect(continuer.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Mot de passe actuel"), { target: { value: "Mon-Mdp-Admin-1" } });
    fireEvent.click(continuer);

    // 2. QR code + clé de secours manuelle
    expect(await screen.findByRole("img", { name: "QR code à scanner" })).toBeTruthy();
    expect(document.querySelector('[aria-label="QR code à scanner"] svg')).not.toBeNull();
    expect(screen.getByText("ABCD EFGH IJKL MNOP QRST UVWX YZ23 4567")).toBeTruthy();
    expect(corps(f, 1)).toEqual({ motDePasse: "Mon-Mdp-Admin-1" });
    const activer = screen.getByRole("button", { name: "Activer" }) as HTMLButtonElement;
    expect(activer.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Code à 6 chiffres"), { target: { value: "123 456" } });
    fireEvent.click(activer);

    // 3. les codes de secours : montrés une fois, on ne peut pas terminer avant de les avoir conservés
    const liste = await screen.findByRole("list", { name: "Codes de secours" });
    expect(within(liste).getAllByRole("listitem")).toHaveLength(10);
    expect(corps(f, 2)).toEqual({ code: "123 456" });
    expect(getToken()).toBe("jeton-apres-activation"); // cet appareil reste connecté
    const terminer = screen.getByRole("button", { name: "Terminer" }) as HTMLButtonElement;
    expect(terminer.disabled).toBe(true);
    fireEvent.click(screen.getByRole("checkbox", { name: /J'ai conservé ces codes/ }));
    expect(terminer.disabled).toBe(false);
    fireEvent.click(terminer);

    // 4. l'état est rechargé : active, dix codes
    expect(await screen.findByText(/10 codes de secours restants/)).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Codes de secours" })).toBeNull();
  });

  it("un mot de passe ou un code refusé affiche l'erreur du serveur et reste sur la même étape", async () => {
    serveur(reponse(200, { actif: false, codesSecoursRestants: 0 }), reponse(400, { error: "Mot de passe incorrect." }));
    render(<DoubleAuthentification />);
    fireEvent.click(await screen.findByRole("button", { name: /Activer la double authentification/ }));
    fireEvent.change(screen.getByLabelText("Mot de passe actuel"), { target: { value: "mauvais" } });
    fireEvent.click(screen.getByRole("button", { name: "Continuer" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Mot de passe incorrect.");
    expect(screen.queryByRole("img", { name: "QR code à scanner" })).toBeNull();
  });

  it("désactiver : mot de passe ET code, puis l'état repasse à inactif et le jeton neuf est gardé", async () => {
    const f = serveur(
      reponse(200, { actif: true, codesSecoursRestants: 8 }),
      reponse(200, { ok: true, token: "jeton-apres-desactivation" }),
      reponse(200, { actif: false, codesSecoursRestants: 0 }),
    );
    render(<DoubleAuthentification />);
    fireEvent.click(await screen.findByRole("button", { name: /Désactiver/ }));
    const bouton = screen.getAllByRole("button", { name: "Désactiver" }).at(-1) as HTMLButtonElement;
    expect(bouton.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Mot de passe actuel"), { target: { value: "Mon-Mdp-Admin-1" } });
    fireEvent.change(screen.getByLabelText("Code de l'application ou code de secours"), { target: { value: "654321" } });
    fireEvent.click(bouton);
    expect(await screen.findByText(/Inactive : seul le mot de passe/)).toBeTruthy();
    expect(corps(f, 1)).toEqual({ motDePasse: "Mon-Mdp-Admin-1", code: "654321" });
    expect(getToken()).toBe("jeton-apres-desactivation");
  });

  it("nouveaux codes de secours : affichés une fois, à conserver", async () => {
    serveur(
      reponse(200, { actif: true, codesSecoursRestants: 1 }),
      reponse(200, { codesSecours: CODES }),
      reponse(200, { actif: true, codesSecoursRestants: 10 }),
    );
    render(<DoubleAuthentification />);
    fireEvent.click(await screen.findByRole("button", { name: /Nouveaux codes de secours/ }));
    fireEvent.change(screen.getByLabelText("Mot de passe actuel"), { target: { value: "Mon-Mdp-Admin-1" } });
    fireEvent.change(screen.getByLabelText("Code de l'application ou code de secours"), { target: { value: "ABCDE-FGHIJ" } });
    fireEvent.click(screen.getByRole("button", { name: "Générer" }));
    expect(await screen.findByRole("list", { name: "Codes de secours" })).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox", { name: /J'ai conservé ces codes/ }));
    fireEvent.click(screen.getByRole("button", { name: "Terminer" }));
    await waitFor(() => expect(screen.getByText(/10 codes de secours restants/)).toBeTruthy());
  });

  it("l'état qui ne se charge pas est signalé", async () => {
    serveur(reponse(403, { error: "Accès réservé à l'administrateur" }));
    render(<DoubleAuthentification />);
    expect((await screen.findByRole("alert")).textContent).toMatch(/n'a pas pu être chargé/);
  });
});
