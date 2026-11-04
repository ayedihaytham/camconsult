// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { CoherenceModule } from "./CoherenceModule";
import type { AlerteCoherence } from "@/types";

const get = vi.fn();
vi.mock("@/lib/api", () => ({ api: { get: (...a: unknown[]) => get(...a) } }));

afterEach(cleanup);
beforeEach(() => get.mockReset());

const alerte = (code: AlerteCoherence["code"], modules: AlerteCoherence["modules"], gravite: AlerteCoherence["gravite"], message: string, route = "/fournisseurs/s1"): AlerteCoherence =>
  ({ code, modules, gravite, date: null, message, lien: { route, libelle: "Suivi fournisseur" } });

const ALERTES = [
  alerte("montant_banque_different", ["banque", "fournisseur"], "erreur", "Règlement du 10/06/2026 : écart de 5,000."),
  alerte("paiement_non_rapproche", ["banque", "fournisseur"], "attention", "2 paiements fournisseur en banque n'ont pas de règlement."),
  alerte("encaissement_non_affecte", ["banque", "devise"], "attention", "Encaissement non affecté."),
];

const monter = (module: AlerteCoherence["modules"][number], garde?: (a: AlerteCoherence) => boolean) =>
  render(<MemoryRouter><CoherenceModule societeId="s1" module={module} garde={garde} /></MemoryRouter>);

describe("alertes de cohérence sur l'écran d'un module", () => {
  it("n'affiche que les alertes du module, repliées d'abord, puis le détail avec le lien vers l'écran à corriger", async () => {
    get.mockResolvedValue({ alertes: ALERTES });
    monter("fournisseur");
    const bouton = await screen.findByRole("button", { name: /Cohérence avec les autres modules/ });
    expect(bouton.textContent).toContain("2 points à vérifier dont 1 incohérence");
    expect(screen.queryByText(/Encaissement non affecté/)).toBeNull();
    expect(screen.queryByText(/écart de 5,000/)).toBeNull();
    fireEvent.click(bouton);
    expect(screen.getByText(/écart de 5,000/)).toBeTruthy();
    expect(screen.queryByText(/Encaissement non affecté/)).toBeNull();
    // l'écran où l'on est n'est pas proposé comme lien (le rendu est monté sur « / », pas sur « /fournisseurs/s1 »)
    expect(screen.getAllByRole("link", { name: "Suivi fournisseur" })[0].getAttribute("href")).toBe("/fournisseurs/s1");
    expect(get).toHaveBeenCalledWith("/banque/coherence?societeId=s1");
  });

  it("une garde affine la liste", async () => {
    get.mockResolvedValue({ alertes: ALERTES });
    monter("fournisseur", (a) => a.code !== "montant_banque_different");
    expect((await screen.findByRole("button", { name: /Cohérence/ })).textContent).toContain("1 point à vérifier");
  });

  it("sans alerte pour le module, aucun bandeau", async () => {
    get.mockResolvedValue({ alertes: ALERTES });
    monter("stock");
    await waitFor(() => expect(get).toHaveBeenCalledTimes(1));
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByTestId("coherence-module")).toBeNull();
  });
});

describe("lien vers l'écran courant", () => {
  it("n'est pas proposé quand l'alerte se corrige sur l'écran où l'on est", async () => {
    get.mockResolvedValue({ alertes: [alerte("paiement_non_rapproche", ["banque", "fournisseur"], "attention", "2 paiements sans règlement.")] });
    render(<MemoryRouter initialEntries={["/fournisseurs/s1"]}><CoherenceModule societeId="s1" module="fournisseur" /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: /Cohérence/ }));
    expect(screen.getByText(/2 paiements sans règlement/)).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Suivi fournisseur" })).toBeNull();
  });
});
