// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { Facture } from "@/types";

// Magasin simulé, données fictives : aucune requête réseau.
const magasin = vi.hoisted(() => ({
  list: [] as unknown[],
  loading: false,
  cabinet: null as unknown,
  signature: null as unknown,
  fetchList: vi.fn(),
  fetchCabinet: vi.fn(),
  saveCabinet: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  telechargerXml: vi.fn(),
  conformite: vi.fn(),
  preparer: vi.fn(),
  signer: vi.fn(),
  fetchSignature: vi.fn(),
  chargerCertificat: vi.fn(),
  supprimerCertificat: vi.fn(),
  deverrouiller: vi.fn(),
  verrouiller: vi.fn(),
}));
vi.mock("@/store/facturation", () => ({ useFacturation: (selecteur: (s: typeof magasin) => unknown) => selecteur(magasin) }));
vi.mock("@/hooks/useSocieteActive", () => ({ useSocieteActive: () => null }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/facturation", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/facturation")>()), imprimerFacture: vi.fn(() => true) }));

import { FacturationPage } from "./FacturationPage";

const facture = (extra: Partial<Facture> = {}): Facture =>
  ({
    id: "f1",
    societeId: "s1",
    societeNom: "CLIENT EXEMPLE SARL",
    clientAdresse: "",
    clientTva: "7654321KAM000",
    clientRne: "",
    numero: "2026-0001",
    dateEmission: "2026-10-16",
    echeance: "2099-11-15",
    tvaTaux: 19,
    timbre: 1,
    totalHt: 100,
    tva: 19,
    netAPayer: 120,
    statut: "emise",
    note: "",
    payeLe: null,
    signeeLe: null,
    creeLe: "2026-10-16T08:00:00Z",
    einvoice: null,
    lignes: [],
    ...extra,
  }) as Facture;

beforeEach(() => {
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: true, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  for (const f of [magasin.fetchList, magasin.fetchCabinet, magasin.telechargerXml, magasin.update]) f.mockReset().mockResolvedValue(undefined);
  magasin.fetchSignature.mockReset().mockResolvedValue({ configuree: true, certificat: null, deverrouille: false, expireLe: null });
  magasin.conformite.mockReset().mockResolvedValue({ einvoice: null, version: "1.8.9", problemes: [], pret: true });
  magasin.signature = { configuree: true, certificat: null, deverrouille: false, expireLe: null };
  magasin.loading = false;
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// Le registre rend le tableau (écran large) ET la liste mobile : on cible la ligne du tableau.
const ligne = (nom: string) => screen.getAllByText(nom).map((e) => e.closest("tr")).find(Boolean) as HTMLElement;

const monter = (liste: Facture[]) => {
  magasin.list = liste;
  return render(
    <MemoryRouter>
      <FacturationPage />
    </MemoryRouter>,
  );
};

describe("FacturationPage (registre)", () => {
  it("liste vide : message d'invitation à créer une facture", () => {
    monter([]);
    expect(screen.getAllByText(/Aucune facture : créez une facture/).length).toBeGreaterThan(0);
  });

  it("affiche chaque facture avec son statut, son état de facture électronique et les boutons d'action", () => {
    monter([
      facture(),
      facture({ id: "f2", numero: "2026-0002", societeNom: "AUTRE CLIENT", statut: "payee", einvoice: { statut: "signee", genereLe: null, sha256: "", signeLe: "2026-10-17T10:00:00Z", shaSigne: "a".repeat(64) } }),
      facture({ id: "f3", numero: "2026-0003", societeNom: "TROISIEME", echeance: "2020-01-01", einvoice: { statut: "prete", genereLe: null, sha256: "" } }),
    ]);
    const l1 = ligne("CLIENT EXEMPLE SARL");
    expect(within(l1).getByText("Émise")).toBeTruthy();
    expect(within(l1).getByText("Non préparée")).toBeTruthy();
    expect(within(l1).getByRole("button", { name: "Préparer" })).toBeTruthy();
    expect(within(l1).getByRole("button", { name: "Imprimer" })).toBeTruthy();

    const l2 = ligne("AUTRE CLIENT");
    expect(within(l2).getByText("Payée")).toBeTruthy();
    expect(within(l2).getByText("Signée")).toBeTruthy();
    expect(within(l2).getByRole("button", { name: "Déposer" })).toBeTruthy();

    const l3 = ligne("TROISIEME");
    expect(within(l3).getByText("En retard")).toBeTruthy();
    expect(within(l3).getByText("Préparée")).toBeTruthy();
    expect(within(l3).getByRole("button", { name: "Signer" })).toBeTruthy();
  });

  it("ouvre la fenêtre de facture électronique depuis le bouton de la ligne", async () => {
    monter([facture()]);
    fireEvent.click(within(ligne("CLIENT EXEMPLE SARL")).getByRole("button", { name: "Préparer" }));
    expect(await screen.findByText(/Facture électronique 2026-0001/)).toBeTruthy();
    await waitFor(() => expect(magasin.conformite).toHaveBeenCalledWith("f1"));
  });

  it("la recherche filtre la liste ; une facture annulée n'a ni bouton de facture électronique ni ouverture au clic", () => {
    monter([facture(), facture({ id: "f4", numero: "2026-0004", societeNom: "ANNULEE SA", statut: "annulee" })]);
    const annulee = ligne("ANNULEE SA");
    expect(within(annulee).queryByRole("button", { name: "Préparer" })).toBeNull();
    fireEvent.change(screen.getAllByLabelText("Rechercher une facture")[0], { target: { value: "exemple" } });
    expect(screen.queryAllByText("ANNULEE SA")).toHaveLength(0);
    expect(screen.getAllByText("CLIENT EXEMPLE SARL").length).toBeGreaterThan(0);
  });

  it("indicateurs cliquables : « À traiter » compte les factures à signer, à déposer ou rejetées et filtre", () => {
    monter([facture(), facture({ id: "f3", numero: "2026-0003", societeNom: "TROISIEME", einvoice: { statut: "prete", genereLe: null, sha256: "" } })]);
    fireEvent.click(screen.getByRole("button", { name: /À traiter/ }));
    expect(screen.queryAllByText("CLIENT EXEMPLE SARL")).toHaveLength(0);
    expect(screen.getAllByText("TROISIEME").length).toBeGreaterThan(0);
  });
});
