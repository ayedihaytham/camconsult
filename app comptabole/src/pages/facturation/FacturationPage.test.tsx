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
  ttn: null as unknown,
  fetchTtn: vi.fn(),
  testerTtn: vi.fn(),
  deposer: vi.fn(),
  actualiser: vi.fn(),
  rouvrir: vi.fn(),
  journal: vi.fn(),
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
  magasin.ttn = { configuree: true, connexion: null };
  magasin.fetchTtn.mockReset().mockResolvedValue(magasin.ttn);
  magasin.testerTtn.mockReset();
  magasin.signer.mockReset();
  magasin.deposer.mockReset();
  magasin.journal.mockReset().mockResolvedValue([]);
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
    expect(within(l1).getByRole("img", { name: /Facture électronique : Non préparée/ })).toBeTruthy();
    expect(within(l1).getByRole("button", { name: "Préparer" })).toBeTruthy();
    expect(within(l1).getByRole("button", { name: "Imprimer" })).toBeTruthy();

    const l2 = ligne("AUTRE CLIENT");
    expect(within(l2).getByText("Payée")).toBeTruthy();
    expect(within(l2).getByText("Signée — à déposer")).toBeTruthy();
    expect(within(l2).getByRole("button", { name: "Déposer" })).toBeTruthy();

    const l3 = ligne("TROISIEME");
    expect(within(l3).getByText("En retard")).toBeTruthy();
    expect(within(l3).getByText("Préparée — à signer")).toBeTruthy();
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

  it("pastilles de filtre : compteurs et filtrage rapide, la pastille active est signalée", () => {
    monter([
      facture(),
      facture({ id: "f3", numero: "2026-0003", societeNom: "TROISIEME", einvoice: { statut: "prete", genereLe: null, sha256: "" } }),
      facture({ id: "f5", numero: "2026-0005", societeNom: "CINQUIEME", einvoice: { statut: "signee", genereLe: null, sha256: "", signeLe: "2026-10-17T10:00:00Z", shaSigne: "a".repeat(64) } }),
    ]);
    const groupe = screen.getByRole("group", { name: "Filtres rapides" });
    const pastille = (nom: RegExp) => within(groupe).getByRole("button", { name: nom });
    expect(pastille(/^Toutes/).getAttribute("aria-pressed")).toBe("true");
    expect(pastille(/^À signer/).textContent).toContain("1");
    expect(pastille(/^À déposer/).textContent).toContain("1");
    fireEvent.click(pastille(/^À déposer/));
    expect(pastille(/^À déposer/).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getAllByText("CINQUIEME").length).toBeGreaterThan(0);
    expect(screen.queryAllByText("TROISIEME")).toHaveLength(0);
    fireEvent.click(pastille(/^Toutes/));
    expect(screen.getAllByText("TROISIEME").length).toBeGreaterThan(0);
  });

  it("liste de mise en route : étapes à faire avec leur lien d'action ; l'essai de connexion se lance depuis la liste", async () => {
    magasin.ttn = { configuree: true, connexion: { url: "https://ttn.exemple/EfactService", login: "compte", matricule: "", environnement: "test", motDePasseDefini: true, majLe: "2026-10-17T10:00:00Z", majPar: "Admin", dernierEssai: null } };
    magasin.fetchTtn.mockResolvedValue(magasin.ttn);
    magasin.testerTtn.mockResolvedValue("ok");
    monter([facture()]);
    expect(screen.getByText("Mise en route de la facture électronique")).toBeTruthy();
    expect(screen.getByText("Certificat de signature")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Charger le certificat" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Tester la connexion" }));
    await waitFor(() => expect(magasin.testerTtn).toHaveBeenCalled());
    await waitFor(() => expect(magasin.fetchTtn).toHaveBeenCalledTimes(2)); // relu après l'essai
  });

  it("badges du bandeau : certificat bientôt expiré et environnement TTN de test", () => {
    const dans = (jours: number) => new Date(Date.now() + jours * 24 * 3600 * 1000).toISOString();
    magasin.signature = { configuree: true, certificat: { sujet: "CN=Test", emetteur: "CN=CA", serie: "01", validDu: dans(-300), validAu: dans(12), empreinte: "a".repeat(64), chargeLe: dans(-100), chargePar: "Admin", expire: false }, deverrouille: false, expireLe: null };
    magasin.ttn = { configuree: true, connexion: { url: "https://ttn.exemple/EfactService", login: "compte", matricule: "", environnement: "test", motDePasseDefini: true, majLe: dans(-1), majPar: "Admin", dernierEssai: { ok: true, le: dans(-1) } } };
    monter([facture()]);
    expect(screen.getByText(/expire dans 12 j/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /TTN\s*test/i })).toBeTruthy();
  });

  it("clic sur une ligne : le panneau de détail s'ouvre (avancement, lignes, historique) ; la colonne « Papier » est masquée au départ", async () => {
    magasin.journal.mockResolvedValue([{ id: "j1", at: "2026-10-17T10:12:00Z", actor: "Mohamed Ayedi", action: "modification", label: "2026-0001 — facture électronique préparée (TEIF 1.8.9)" }]);
    monter([facture({ einvoice: { statut: "prete", genereLe: "2026-10-17T10:12:00Z", sha256: "" }, lignes: [{ id: "l1", ordre: 0, description: "Honoraires du mois", quantite: 1, montantHt: 100 }] as never })]);
    expect(screen.queryByRole("columnheader", { name: /Papier/ })).toBeNull();
    fireEvent.click(ligne("CLIENT EXEMPLE SARL"));
    expect(await screen.findByText("Facture 2026-0001")).toBeTruthy();
    expect(screen.getByText("Honoraires du mois")).toBeTruthy();
    expect(screen.getByText("Prochaine étape")).toBeTruthy();
    expect(await screen.findByText(/facture électronique préparée \(TEIF 1.8.9\)/)).toBeTruthy();
    await waitFor(() => expect(magasin.journal).toHaveBeenCalledWith("f1"));
  });

  it("actions groupées : « Signer (n) » et « Déposer (n) » ne comptent que les factures dans le bon état ; signature verrouillée refusée", async () => {
    monter([
      facture(),
      facture({ id: "f3", numero: "2026-0003", societeNom: "TROISIEME", einvoice: { statut: "prete", genereLe: null, sha256: "" } }),
      facture({ id: "f5", numero: "2026-0005", societeNom: "CINQUIEME", einvoice: { statut: "signee", genereLe: null, sha256: "", signeLe: "2026-10-17T10:00:00Z", shaSigne: "a".repeat(64) } }),
    ]);
    for (const nom of ["CLIENT EXEMPLE SARL", "TROISIEME", "CINQUIEME"]) fireEvent.click(within(ligne(nom)).getByRole("checkbox"));
    expect(await screen.findByRole("button", { name: "Signer (1)" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Déposer chez TTN (1)" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Signer (1)" }));
    fireEvent.click(await screen.findByRole("button", { name: "Signer" })); // confirmation
    await waitFor(() => expect(magasin.signer).not.toHaveBeenCalled()); // signature verrouillée : rien n'est envoyé
  });

  it("actions groupées avec signature déverrouillée : chaque facture préparée est signée, les autres sont ignorées", async () => {
    magasin.signature = { configuree: true, certificat: null, deverrouille: true, expireLe: "2026-10-17T12:00:00Z" };
    magasin.signer.mockResolvedValue({});
    monter([
      facture(),
      facture({ id: "f3", numero: "2026-0003", societeNom: "TROISIEME", einvoice: { statut: "prete", genereLe: null, sha256: "" } }),
    ]);
    for (const nom of ["CLIENT EXEMPLE SARL", "TROISIEME"]) fireEvent.click(within(ligne(nom)).getByRole("checkbox"));
    fireEvent.click(await screen.findByRole("button", { name: "Signer (1)" }));
    fireEvent.click(await screen.findByRole("button", { name: "Signer" }));
    await waitFor(() => expect(magasin.signer).toHaveBeenCalledTimes(1));
    expect(magasin.signer).toHaveBeenCalledWith("f3");
  });
});
