// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { CollecteFull } from "@/types";
import { COLLECTE_TAB_KEYS, TAB_BY_KEY } from "@/lib/collecte/tabs";
import { CollecteEditorPage } from "./CollecteEditorPage";

const { saveLignes, fetchOne, clearCurrent, collecte, perms, update, setStatut, submitRecap, transmettreSection, exportSectionXlsx, downloadSectionPdf, printSection, exportAllXlsx } = vi.hoisted(() => {
  const collecte = {
    id: "collecte-1",
    societeId: "soc-1",
    periode: "2026-09",
    statut: "brouillon",
    onglets: ["bordereaux_remise_cheques", "souche_cheques", "etat_cheques_emis"],
    devise: "TND",
    echeance: null,
    derniereRelanceLe: null,
    relanceCadenceJours: 3,
    creeLe: "2026-09-01",
    majLe: "2026-09-01",
    transmisLe: null,
    valideLe: null,
    sections: [],
    lignes: [],
    notes: [],
    fichiers: [],
  } as CollecteFull;
  const perms = { current: { isAdmin: true, poste: "admin", isCollaborateur: false, canManageCollaborateurs: true, canSeeSociete: () => true } as Record<string, unknown> };
  return {
    collecte,
    perms,
    update: vi.fn().mockResolvedValue(undefined),
    setStatut: vi.fn().mockResolvedValue(undefined),
    submitRecap: vi.fn().mockResolvedValue(undefined),
    transmettreSection: vi.fn().mockResolvedValue(undefined),
    exportSectionXlsx: vi.fn().mockResolvedValue(undefined),
    downloadSectionPdf: vi.fn().mockResolvedValue(undefined),
    printSection: vi.fn(),
    exportAllXlsx: vi.fn().mockResolvedValue(undefined),
    saveLignes: vi.fn().mockResolvedValue(undefined),
    fetchOne: vi.fn().mockResolvedValue(undefined),
    clearCurrent: vi.fn(),
  };
});

vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => perms.current,
}));
vi.mock("@/store/data", () => ({
  useSocietes: () => [{ id: "soc-1", raisonSociale: "Société test" }],
}));
vi.mock("@/lib/collecte/exportXlsx", () => ({
  exportCollecteSectionXlsx: exportSectionXlsx,
  downloadCollecteSectionPdf: downloadSectionPdf,
  printCollecteSection: printSection,
  exportCollecteXlsx: exportAllXlsx,
}));
vi.mock("@/store/collectes", () => {
  const getState = () => ({ current: collecte, loadingOne: false, fetchOne, clearCurrent, saveLignes, update, setStatut, submitRecap, transmettreSection });
  return {
    useCollectes: Object.assign((selector: (state: Record<string, unknown>) => unknown) => selector(getState()), { getState }),
  };
});

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  saveLignes.mockReset().mockResolvedValue(undefined);
  setStatut.mockReset().mockResolvedValue(undefined);
  submitRecap.mockReset().mockResolvedValue(undefined);
  transmettreSection.mockReset().mockResolvedValue(undefined);
  update.mockClear();
  exportSectionXlsx.mockClear();
  downloadSectionPdf.mockClear();
  printSection.mockClear();
  exportAllXlsx.mockClear();
});

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
  collecte.statut = "brouillon";
  collecte.onglets = ["bordereaux_remise_cheques", "souche_cheques", "etat_cheques_emis"];
  collecte.sections = [];
  collecte.lignes = [];
  collecte.fichiers = [];
  perms.current = { isAdmin: true, poste: "admin", isCollaborateur: false, canManageCollaborateurs: true, canSeeSociete: () => true };
  vi.unstubAllGlobals();
});

function renderPage(path = "/collectes/collecte-1") {
  const page = () => (
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/collectes/:id" element={<CollecteEditorPage />} />
        <Route path="/collectes" element={<p>Liste des collectes</p>} />
      </Routes>
    </MemoryRouter>
  );
  const rendered = render(page());
  return { ...rendered, refresh: () => rendered.rerender(page()) };
}

function openBordereaux() {
  ouvrirSection("Bordereaux remise de chèques");
}

function sectionButton(name: string) {
  const nav = screen.getByRole("navigation", { name: "Sections du dossier", hidden: true });
  const direct = within(nav).queryAllByRole("button", { hidden: true }).find((button) => button.textContent?.includes(name));
  return direct ?? within(nav).getByRole("combobox", { name: "Choisir un tableau", hidden: true });
}

function ouvrirSelecteurTableaux() {
  if (screen.queryByRole("listbox")) {
    return within(screen.getByRole("navigation", { name: "Sections du dossier", hidden: true }))
      .getByRole("combobox", { name: "Choisir un tableau", hidden: true });
  }
  const trigger = screen.getByRole("combobox", { name: "Choisir un tableau" });
  if (trigger.getAttribute("aria-expanded") !== "true") fireEvent.keyDown(trigger, { key: "ArrowDown" });
  return trigger;
}

function optionTableau(name: string) {
  ouvrirSelecteurTableaux();
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return screen.getByRole("option", { name: new RegExp(escaped) });
}

function fermerSelecteurTableaux() {
  const listbox = screen.queryByRole("listbox");
  if (listbox) fireEvent.keyDown(listbox, { key: "Escape" });
}

function choisirTableau(name: string) {
  const option = optionTableau(name);
  fireEvent.click(option);
  return sectionButton("Choisir un tableau");
}

function ajouterTableau(name: string) {
  ouvrirSection("Checklist");
  fireEvent.click(screen.getByRole("button", { name: /Ajouter un tableau/ }));
  const dialog = screen.getByRole("dialog", { name: "Ajouter un tableau" });
  fireEvent.click(within(dialog).getByRole("button", { name }));
}

function ouvrirArchive(name: string) {
  ouvrirSection(name);
}

function ouvrirSection(name: string) {
  const nav = screen.getByRole("navigation", { name: "Sections du dossier", hidden: true });
  const direct = within(nav).queryAllByRole("button", { hidden: true }).find((button) => button.textContent?.includes(name));
  if (direct) fireEvent.click(direct);
  else choisirTableau(name);
}

/** Ajoute une ligne dans le tableau et y écrit le n° de bordereau (2ᵉ case). */
function stageRow() {
  fireEvent.click(screen.getByRole("button", { name: "Ajouter une ligne" }));
  const cases = document.querySelectorAll<HTMLInputElement>("tbody tr[data-row] input");
  fireEvent.change(cases[1], { target: { value: "REM-42" } });
}

function pendingSave() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

describe("Collecte : onglets de feuille et actions visibles", () => {
  it("place la navigation avant le contenu et garde une seule section active", () => {
    renderPage();
    const nav = screen.getByRole("navigation", { name: "Sections du dossier", hidden: true });
    const contenu = document.querySelector('[data-tour="collecte-content"]') as HTMLElement;
    // La navigation reste visible avant la longue zone de saisie.
    expect(nav.compareDocumentPosition(contenu) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const noms = within(nav).getAllByRole("button", { hidden: true }).map((b) => b.textContent);
    expect(noms.slice(0, 3)).toEqual(["Récap", "Checklist", "Documents"]);
    expect(screen.getByRole("heading", { name: "Récap" })).toBeTruthy();
    // Les 14 tableaux sont accessibles dans un sélecteur groupé sans seconde barre latérale.
    optionTableau("Bordereaux remise de chèques");
    expect(screen.getByRole("option", { name: /Souche de chèques/ })).toBeTruthy();
    expect(screen.getByRole("option", { name: /État des chèques émis/ })).toBeTruthy();
    fermerSelecteurTableaux();
    expect(within(nav).getAllByRole("button", { hidden: true }).filter((b) => b.getAttribute("aria-current") === "page")).toHaveLength(1);
  });

  it("ouvre une table de famille en un clic et garde la destination active", () => {
    renderPage();
    ouvrirSection("État des chèques émis");
    const onglet = sectionButton("État des chèques émis");
    expect(onglet.getAttribute("aria-current")).toBe("page");
    expect(onglet.textContent).toContain("État des chèques émis");
    expect(screen.getByRole("heading", { name: "État des chèques émis" })).toBeTruthy();
  });

  it("la souche de chèques est un onglet à part, remplie par le client ; l'état des chèques émis est tenu par le cabinet", () => {
    renderPage();
    ouvrirSection("Souche de chèques");
    expect(screen.getByRole("heading", { name: "Souche de chèques" })).toBeTruthy();
    // Elle suit le circuit du client (il la transfère, le cabinet la valide).
    expect(screen.getByText(/Le client n'a pas encore transféré ce tableau/)).toBeTruthy();
    ouvrirSection("État des chèques émis");
    expect(screen.getByText("Tenu par le cabinet")).toBeTruthy();
    expect(screen.queryByText(/Le client n'a pas encore transféré/)).toBeNull();
    expect(screen.getByRole("button", { name: "Reprendre la souche de chèques" })).toBeTruthy();
  });

  it("le cabinet voit l'état des traites même sans traites dans la collecte, et peut y ajouter ses trois tableaux", async () => {
    renderPage();
    ajouterTableau("Traites escomptées");
    await waitFor(() => expect(update).toHaveBeenCalledWith("collecte-1", { onglets: ["bordereaux_remise_cheques", "etat_cheques_emis", "traites_escomptees", "souche_cheques"] }));
  });

  it("la checklist propose au cabinet d'ajouter les tableaux pas encore demandés, états compris", async () => {
    renderPage();
    ouvrirSection("Checklist");
    fireEvent.click(screen.getByRole("button", { name: /Ajouter un tableau/ }));
    const zone = screen.getByRole("dialog", { name: "Ajouter un tableau" });
    // Les deux tableaux de l'état des chèques sont déjà demandés : ils ne sont pas proposés.
    expect(within(zone).queryByRole("button", { name: "Bordereaux remise de chèques" })).toBeNull();
    expect(within(zone).getByRole("button", { name: "Virements émis" })).toBeTruthy();
    fireEvent.click(within(zone).getByRole("button", { name: "Traites escomptées" }));
    await waitFor(() => expect(update).toHaveBeenCalledWith("collecte-1", { onglets: ["bordereaux_remise_cheques", "etat_cheques_emis", "traites_escomptees", "souche_cheques"] }));
  });

  it("garde les sections du cabinet et le choix des tableaux dans une seule navigation", () => {
    renderPage();
    const nav = screen.getByRole("navigation", { name: "Sections du dossier", hidden: true });
    expect(within(nav).getByRole("button", { name: "Checklist" })).toBeTruthy();
    expect(within(nav).getByRole("button", { name: "Documents" })).toBeTruthy();
    expect(within(nav).getByRole("combobox", { name: "Choisir un tableau" })).toBeTruthy();
    expect(screen.getAllByRole("navigation", { name: "Sections du dossier" })).toHaveLength(1);
  });

  it("keeps all 14 accounting tables reachable in the grouped selector", () => {
    collecte.onglets = [...COLLECTE_TAB_KEYS];
    renderPage();
    ouvrirSelecteurTableaux();
    for (const key of COLLECTE_TAB_KEYS) {
      const escaped = TAB_BY_KEY[key].label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      expect(screen.getByRole("option", { name: new RegExp(escaped) })).toBeTruthy();
    }
    fermerSelecteurTableaux();
  });

  it("regroupe les actions secondaires sous Outils et garde la validation directement visible", () => {
    collecte.statut = "transmis";
    renderPage();
    const bandeau = document.querySelector('[data-tour="collecte-identity"]') as HTMLElement;
    expect(within(bandeau).getByRole("button", { name: "Valider la collecte" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Tout en Excel/ })).toBeNull();
    fireEvent.keyDown(within(bandeau).getByRole("button", { name: "Outils" }), { key: "Enter" });
    expect(screen.getByRole("menuitem", { name: /Tout en Excel/ })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: /Modifier la collecte/ })).toBeTruthy();
  });

  it.each([
    { label: "Excel", action: exportSectionXlsx },
    { label: "PDF", action: downloadSectionPdf },
    { label: "Imprimer", action: printSection },
  ])("exporte uniquement le tableau courant via $label depuis le menu de la barre fixe", async ({ label, action }) => {
    renderPage();
    openBordereaux();
    const barre = screen.getByRole("region", { name: "Suivi et actions du tableau" });
    const exporter = within(barre).getByRole("button", { name: "Exporter le tableau" });
    for (const outil of ["Excel", "PDF", "Imprimer"]) {
      expect(within(barre).queryByRole("button", { name: outil })).toBeNull();
    }
    fireEvent.keyDown(exporter, { key: "Enter" });
    fireEvent.click(screen.getByRole("menuitem", { name: label }));
    await waitFor(() => expect(action).toHaveBeenCalledWith(collecte, "bordereaux_remise_cheques", "Société test"));
    expect(exportAllXlsx).not.toHaveBeenCalled();
    expect(saveLignes).not.toHaveBeenCalled();
  });

  it("garde le menu d'export accessible sur un tableau archivé, sans actions de saisie", () => {
    collecte.statut = "archive";
    renderPage();
    openBordereaux();
    const barre = screen.getByRole("region", { name: "Suivi et actions du tableau" });
    expect(within(barre).queryByRole("button", { name: "Ajouter une ligne" })).toBeNull();
    expect(within(barre).queryByRole("button", { name: "Enregistrer et voir le récap" })).toBeNull();
    fireEvent.keyDown(within(barre).getByRole("button", { name: "Exporter le tableau" }), { key: "Enter" });
    for (const outil of ["Excel", "PDF", "Imprimer"]) {
      expect(screen.getByRole("menuitem", { name: outil })).toBeTruthy();
    }
  });

  it("enregistre le client dans son tableau, puis transmet uniquement ce tableau au cabinet", async () => {
    perms.current = { isAdmin: false, poste: "societe_employe", isCollaborateur: false, canManageCollaborateurs: false, canSeeSociete: () => true };
    collecte.onglets = ["virements_recus"];
    collecte.sections = [{ id: "s", onglet: "virements_recus", statut: "a_corriger", recapStatut: "none", motifRenvoi: "Compléter l'émetteur" } as never];
    collecte.lignes = [{ id: "l1", onglet: "virements_recus", ordre: 0, data: { date: "2026-09-02", emetteur: "", reference: "VIR-1", montant: 100, compte_bancaire: "Banque", observations: "RAS" } }];
    saveLignes.mockImplementation(async (_id, onglet, lignes) => {
      collecte.lignes = lignes.map((ligne: { ordre: number; data: Record<string, unknown> }) => ({ ...ligne, id: `l${ligne.ordre + 1}`, onglet }));
    });
    renderPage("/collectes/collecte-1?tab=virements_recus");
    fireEvent.change(document.querySelector<HTMLInputElement>('tbody [data-col="emetteur"]')!, { target: { value: "Client A" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(saveLignes).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.getByRole("heading", { name: "Virements reçus" })).toBeTruthy());
    expect(screen.queryByRole("heading", { name: "Récap" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Vérifiez votre collecte" })).toBeNull();
    expect(setStatut).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer et transférer au cabinet" }));
    const confirm = await screen.findByRole("dialog", { name: "Transférer ce tableau au cabinet ?" });
    expect(transmettreSection).not.toHaveBeenCalled();
    fireEvent.click(within(confirm).getByRole("button", { name: "Transférer" }));
    await waitFor(() => expect(transmettreSection).toHaveBeenCalledWith("collecte-1", "virements_recus", false));
    expect(setStatut).not.toHaveBeenCalled();
  });

  it("ouvre un tableau en un seul clic sur son onglet", () => {
    renderPage();
    openBordereaux();
    expect(sectionButton("Bordereaux remise de chèques").getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("button", { name: "Ajouter une ligne" })).toBeTruthy();
    const outils = document.querySelector('[data-tour="collecte-sticky-tools"]') as HTMLElement;
    const tableau = document.querySelector("table") as HTMLElement;
    expect(outils.className).toContain("sticky");
    expect(outils.compareDocumentPosition(tableau) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("ouvre le Récap pour l'admin et respecte un lien partagé vers un tableau", async () => {
    collecte.statut = "transmis";
    collecte.sections = [
      { id: "s0", onglet: "bordereaux_remise_cheques", commentaire: "", recapStatut: "none", recuManuel: false, dateSuivi: null, totalSaisi: null, statut: "brouillon", transmisLe: null, valideLe: null, motifRenvoi: "" },
      { id: "s2", onglet: "etat_cheques_emis", commentaire: "", recapStatut: "none", recuManuel: false, dateSuivi: null, totalSaisi: null, statut: "brouillon", transmisLe: null, valideLe: null, motifRenvoi: "" },
      { id: "s1", onglet: "souche_cheques", commentaire: "", recapStatut: "none", recuManuel: false, dateSuivi: null, totalSaisi: null, statut: "transmis", transmisLe: null, valideLe: null, motifRenvoi: "" },
    ];
    renderPage();
    await waitFor(() => expect(sectionButton("Récap").getAttribute("aria-current")).toBe("page"));

    cleanup();
    renderPage("/collectes/collecte-1?tab=etat_cheques_emis");
    await waitFor(() => expect(sectionButton("État des chèques émis").getAttribute("aria-current")).toBe("page"));
  });

  it("ouvre le tableau exact d’une demande de récap pour le client", async () => {
    perms.current = { isAdmin: false, poste: "societe_employe", isCollaborateur: false, canManageCollaborateurs: false, canSeeSociete: () => true };
    collecte.statut = "valide";
    collecte.sections = [
      { id: "s1", onglet: "bordereaux_remise_cheques", commentaire: "", recapStatut: "envoye", recuManuel: false, dateSuivi: null, totalSaisi: null, statut: "valide", transmisLe: null, valideLe: null, motifRenvoi: "" },
    ];
    renderPage();
    await waitFor(() => expect(sectionButton("Bordereaux remise de chèques").getAttribute("aria-current")).toBe("page"));
    expect(screen.getByRole("heading", { name: "Bordereaux remise de chèques" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ajouter une ligne" })).toBeTruthy();
  });

  it("shows supporting files inside the table being reviewed", () => {
    collecte.fichiers = [{ id: "f1", onglet: "bordereaux_remise_cheques", nom: "bordereau.pdf", format: "pdf", taille: "12 Ko", dataUrl: "data:application/pdf;base64,AA==", deposePar: "Client", creeLe: "2026-09-01" }];
    renderPage();
    openBordereaux();
    const region = screen.getByRole("region", { name: "Pièces liées au tableau" });
    expect(within(region).getByText("bordereau.pdf")).toBeTruthy();
    expect(within(region).getByRole("button", { name: "Aperçu" })).toBeTruthy();
    expect(within(region).getByRole("button", { name: "Télécharger" })).toBeTruthy();
  });

  it("ouvre et cible la case exacte lorsque l'admin choisit un manque depuis le Récap", async () => {
    collecte.statut = "valide";
    collecte.sections = [
      { id: "s1", onglet: "souche_cheques", commentaire: "", recapStatut: "envoye", recuManuel: false, dateSuivi: null, totalSaisi: null, statut: "valide", transmisLe: null, valideLe: null, motifRenvoi: "" },
    ];
    collecte.lignes = [
      { id: "l1", onglet: "souche_cheques", ordre: 0, data: { date: "2026-09-01", num_cheque: "", beneficiaire: "Client", motif: "", montant: 25, compte_bancaire: "TND" } },
    ];
    renderPage("/collectes/collecte-1?tab=recap");
    fireEvent.click(screen.getAllByRole("button", { name: "Voir le détail de Souche de chèques" })[0]);
    fireEvent.click(screen.getAllByRole("button", { name: "Ouvrir la ligne 1, N° Chèque, dans Souche de chèques" })[0]);
    await waitFor(() => expect(document.activeElement?.getAttribute("data-col")).toBe("num_cheque"));
  });
});

describe("Collecte : bordereau incomplet", () => {
  // L'avertissement est réservé au responsable de société (le cabinet passe par le Récap).
  beforeEach(() => {
    perms.current = { isAdmin: false, poste: "societe_employe", isCollaborateur: false, canManageCollaborateurs: false, canSeeSociete: () => true };
    const demandee = (onglet: string, id: string) => ({ id, onglet, commentaire: "", recapStatut: "envoye", recuManuel: false, dateSuivi: null, totalSaisi: null, statut: "brouillon", transmisLe: null, valideLe: null, motifRenvoi: "" }) as never;
    collecte.sections = [demandee("bordereaux_remise_cheques", "s"), demandee("souche_cheques", "s2")];
  });
  afterEach(() => {
    perms.current = { isAdmin: true, poste: "admin", isCollaborateur: false, canManageCollaborateurs: true, canSeeSociete: () => true };
    collecte.sections = [];
  });

  function saisirBordereauIncomplet() {
    openBordereaux();
    fireEvent.click(screen.getByRole("button", { name: "Ajouter une ligne" }));
    const cases = document.querySelectorAll<HTMLInputElement>("tbody tr[data-row] input");
    fireEvent.change(cases[1], { target: { value: "REM-42" } });
    fireEvent.change(cases[2], { target: { value: "60000" } });
    fireEvent.change(cases[6], { target: { value: "35000" } });
  }

  it("prévient avant de quitter la section tant que les chèques n'atteignent pas le montant, et propose de compléter", () => {
    renderPage();
    saisirBordereauIncomplet();
    ouvrirSection("Souche de chèques");
    const alerte = screen.getByRole("dialog", { name: "Répartition incomplète" });
    expect(alerte.textContent).toMatch(/Bordereau REM-42 : il reste 25\s000,000 TND à répartir/);
    fireEvent.click(within(alerte).getByRole("button", { name: "Compléter" }));
    expect(sectionButton("Bordereaux remise de chèques").getAttribute("aria-current")).toBe("page");
  });

  it("sauvegarde les modifications quand le montant est atteint puis change de section", async () => {
    renderPage();
    saisirBordereauIncomplet();
    const cases = document.querySelectorAll<HTMLInputElement>("tbody tr[data-row] input");
    fireEvent.change(cases[6], { target: { value: "60000" } });
    ouvrirSection("Souche de chèques");
    expect(screen.queryByRole("dialog", { name: "Répartition incomplète" })).toBeNull();
    await waitFor(() => expect(saveLignes).toHaveBeenCalledOnce());
    await waitFor(() => expect(sectionButton("Souche de chèques").getAttribute("aria-current")).toBe("page"));
  });

  it("permet de continuer quand même après l'avertissement et sauvegarde le brouillon", async () => {
    renderPage();
    saisirBordereauIncomplet();
    ouvrirSection("Souche de chèques");
    fireEvent.click(screen.getByRole("button", { name: "Continuer quand même" }));
    await waitFor(() => expect(saveLignes).toHaveBeenCalledOnce());
    await waitFor(() => expect(sectionButton("Souche de chèques").getAttribute("aria-current")).toBe("page"));
  });
});

describe("Collecte requested-table navigation guard", () => {
  it("navigates clean sections without confirmation, even with an empty row added", () => {
    renderPage();
    openBordereaux();
    fireEvent.click(screen.getByRole("button", { name: "Ajouter une ligne" }));
    expect(document.querySelectorAll("tbody tr[data-row]")).toHaveLength(1);
    ouvrirSection("Souche de chèques");
    expect(screen.queryByText("Modifications non enregistrées")).toBeNull();
    expect(sectionButton("Souche de chèques").getAttribute("aria-current")).toBe("page");
  });

  it("saves staged data automatically when the user switches sections", async () => {
    renderPage();
    openBordereaux();
    stageRow();
    ouvrirSection("Souche de chèques");
    await waitFor(() => expect(saveLignes).toHaveBeenCalledWith("collecte-1", "bordereaux_remise_cheques", expect.arrayContaining([expect.objectContaining({ data: expect.objectContaining({ num_bordereau: "REM-42" }) })])));
    await waitFor(() => expect(sectionButton("Souche de chèques").getAttribute("aria-current")).toBe("page"));
    expect(screen.queryByRole("dialog", { name: "Modifications non enregistrées" })).toBeNull();
  });

  it("waits for the existing save before switching sections", async () => {
    const pending = pendingSave();
    saveLignes.mockReturnValueOnce(pending.promise);
    renderPage();
    openBordereaux();
    stageRow();
    ouvrirSection("Souche de chèques");
    await waitFor(() => expect(saveLignes).toHaveBeenCalledOnce());
    expect(sectionButton("Bordereaux remise de chèques").getAttribute("aria-current")).toBe("page");
    expect(screen.getByDisplayValue("REM-42")).toBeTruthy();
    await act(async () => { pending.resolve(); await pending.promise; });
    await waitFor(() => expect(sectionButton("Souche de chèques").getAttribute("aria-current")).toBe("page"));
  });

  it("retains the current section and staged row when saving fails", async () => {
    saveLignes.mockRejectedValueOnce(new Error("network"));
    renderPage();
    openBordereaux();
    stageRow();
    ouvrirSection("Souche de chèques");
    await waitFor(() => expect(screen.getAllByRole("alert").some((alert) => alert.textContent?.includes("brouillon n’a pas été enregistré"))).toBe(true));
    expect(sectionButton("Bordereaux remise de chèques").getAttribute("aria-current")).toBe("page");
    expect(screen.getByDisplayValue("REM-42")).toBeTruthy();
  });
});

describe("Collecte : enregistrement de l'admin vers le Récap", () => {
  it("attend la sauvegarde réussie avant d'ouvrir le Récap et conserve la saisie pendant l'attente", async () => {
    const pending = pendingSave();
    saveLignes.mockReturnValueOnce(pending.promise);
    renderPage();
    openBordereaux();
    stageRow();
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer et voir le récap" }));
    await waitFor(() => expect(saveLignes).toHaveBeenCalledWith("collecte-1", "bordereaux_remise_cheques", expect.arrayContaining([
      expect.objectContaining({ data: expect.objectContaining({ num_bordereau: "REM-42" }) }),
    ])));
    expect(sectionButton("Bordereaux remise de chèques").getAttribute("aria-current")).toBe("page");
    expect(screen.getByDisplayValue("REM-42")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Récap" })).toBeNull();
    await act(async () => { pending.resolve(); await pending.promise; });
    expect(await screen.findByRole("heading", { name: "Récap" })).toBeTruthy();
    expect(sectionButton("Récap").getAttribute("aria-current")).toBe("page");
    expect(saveLignes).toHaveBeenCalledOnce();
  });

  it("reste sur le tableau après un échec et permet de réessayer avec la même ligne", async () => {
    saveLignes.mockRejectedValueOnce(new Error("network"));
    renderPage();
    openBordereaux();
    stageRow();
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer et voir le récap" }));
    await waitFor(() => expect(screen.getAllByRole("alert").some((alert) => alert.textContent?.includes("brouillon n’a pas été enregistré"))).toBe(true));
    expect(screen.queryByRole("heading", { name: "Récap" })).toBeNull();
    expect(sectionButton("Bordereaux remise de chèques").getAttribute("aria-current")).toBe("page");
    expect(screen.getByDisplayValue("REM-42")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer et voir le récap" }));
    expect(await screen.findByRole("heading", { name: "Récap" })).toBeTruthy();
    expect(saveLignes).toHaveBeenCalledTimes(2);
    expect(saveLignes.mock.calls[1][2]).toEqual(saveLignes.mock.calls[0][2]);
  });

  it("enregistre un bordereau incomplet sans interrompre l'admin avant le Récap", async () => {
    renderPage();
    openBordereaux();
    stageRow();
    fireEvent.change(document.querySelector<HTMLInputElement>('tbody [data-col="montant"]')!, { target: { value: "60000" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer et voir le récap" }));
    expect(screen.queryByRole("dialog", { name: "Répartition incomplète" })).toBeNull();
    expect(await screen.findByRole("heading", { name: "Récap" })).toBeTruthy();
    expect(saveLignes).toHaveBeenCalledWith("collecte-1", "bordereaux_remise_cheques", expect.arrayContaining([
      expect.objectContaining({ data: expect.objectContaining({ num_bordereau: "REM-42", montant: 60000 }) }),
    ]));
  });
});

describe("Collecte : circuit par tableau", () => {
  const section = (onglet: string, statut: string, motifRenvoi = "") =>
    ({ id: onglet, onglet, commentaire: "", recapStatut: "none", recuManuel: false, dateSuivi: null, totalSaisi: null, statut, transmisLe: null, valideLe: null, motifRenvoi }) as never;
  afterEach(() => {
    collecte.sections = [];
    collecte.lignes = [];
    perms.current = { isAdmin: true, poste: "admin", isCollaborateur: false, canManageCollaborateurs: true, canSeeSociete: () => true };
  });
  const client = () => {
    perms.current = { isAdmin: false, poste: "societe_employe", isCollaborateur: false, canManageCollaborateurs: false, canSeeSociete: () => true };
  };

  it.each([false, true])("place le motif et À corriger dans un seul bloc hors de la barre fixe (client : %s)", (isClient) => {
    if (isClient) client();
    collecte.onglets = ["virements_recus"];
    collecte.sections = [section("virements_recus", "a_corriger", "Il manque le justificatif de VIR-42")];
    renderPage();
    if (!isClient) ouvrirSection("Virements reçus");
    const note = screen.getByRole("note");
    expect(within(note).getByText("À corriger")).toBeTruthy();
    expect(within(note).getByText("Il manque le justificatif de VIR-42")).toBeTruthy();
    const barre = screen.getByRole("region", { name: "Suivi et actions du tableau" });
    expect(barre.contains(note)).toBe(false);
    expect(within(barre).queryByText("À corriger")).toBeNull();
    expect(within(barre).queryByText(/en attente de ses corrections/)).toBeNull();
    expect(within(barre).queryByText(/Complétez les informations demandées/)).toBeNull();
    if (isClient) expect(within(barre).getByRole("button", { name: "Enregistrer et transférer au cabinet" })).toBeTruthy();
    else expect(barre.querySelector('[data-tour="collecte-circuit"]')).toBeNull();
  });

  it("le responsable de société peut ajouter des lignes à un tableau à remplir, même si le cabinet a envoyé un récap", () => {
    client();
    collecte.sections = [{ ...(section("bordereaux_remise_cheques", "brouillon") as object), recapStatut: "envoye" } as never];
    renderPage();
    ouvrirSection("Bordereaux remise de chèques");
    expect(screen.getByRole("button", { name: "Ajouter une ligne" })).toBeTruthy();
    expect(screen.queryByText(/uniquement les cases marquées/)).toBeNull();
    expect(screen.getByRole("button", { name: "Enregistrer" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Enregistrer et voir le récap" })).toBeNull();
  });

  it("un récap envoyé sur un tableau transmis ou validé le rouvre : le client peut modifier et ajouter des lignes", () => {
    client();
    collecte.sections = [{ ...(section("bordereaux_remise_cheques", "transmis") as object), recapStatut: "envoye" } as never];
    collecte.lignes = [{ id: "l1", onglet: "bordereaux_remise_cheques", ordre: 0, data: { date_remise: "2026-05-22", num_bordereau: "293", montant: 100, banque: "btk" } }] as never;
    renderPage();
    ouvrirSection("Bordereaux remise de chèques");
    expect(screen.getByText("À corriger")).toBeTruthy();
    expect(screen.queryByText(/uniquement les cases marquées/)).toBeNull();
    expect(screen.getAllByRole("button", { name: /Ajouter une ligne/ }).length).toBeGreaterThan(0);
  });

  it("le cabinet voit les statuts de chaque table et peut traiter celle qui est transmise", () => {
    collecte.sections = [section("souche_cheques", "transmis"), section("bordereaux_remise_cheques", "valide")];
    collecte.lignes = ["souche_cheques", "bordereaux_remise_cheques"].map((onglet) => ({
      id: `ligne-${onglet}`, onglet, ordre: 0,
      data: Object.fromEntries(TAB_BY_KEY[onglet].columns.map((col) => [col.key, col.type === "number" ? 1 : col.type === "date" ? "2026-09-01" : "Test"])),
    }));
    renderPage();
    const options = [optionTableau("Bordereaux remise de chèques"), optionTableau("Souche de chèques")];
    expect(options[0].textContent).toContain("Validé");
    expect(options[1].textContent).toContain("À examiner");
    fermerSelecteurTableaux();
    ouvrirSection("Souche de chèques");
    expect(screen.getByRole("button", { name: "Valider ce tableau" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Renvoyer au client" })).toBeTruthy();
    ouvrirSection("Bordereaux remise de chèques");
    expect(screen.queryByRole("button", { name: "Valider ce tableau" })).toBeNull();
    expect(screen.getByRole("button", { name: "Archiver ce tableau" })).toBeTruthy();
  });

  it("masque les chèques émis dans la navigation client et refuse aussi leur accès par lien direct", () => {
    client();
    collecte.sections = [{ ...(section("bordereaux_remise_cheques", "brouillon") as object), recapStatut: "envoye" } as never];
    renderPage();
    const nav = screen.getByRole("navigation", { name: "Sections du dossier" });
    fireEvent.keyDown(within(nav).getByRole("combobox", { name: "Choisir un tableau" }), { key: "Enter", code: "Enter" });
    const proposes = screen.getAllByRole("option").map((o) => o.textContent ?? "");
    expect(proposes.some((n) => n.startsWith("État des chèques émis"))).toBe(false);
    expect(proposes.some((n) => n.startsWith("Bordereaux remise de chèques"))).toBe(true);
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });

    cleanup();
    renderPage("/collectes/collecte-1?tab=etat_cheques_emis");
    expect(screen.queryByRole("heading", { name: "État des chèques émis" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Bordereaux remise de chèques" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Enregistrer et vérifier" })).toBeNull();
  });

  it("un tableau archivé reste directement accessible dans son groupe Archives", () => {
    collecte.sections = [section("souche_cheques", "archive"), section("bordereaux_remise_cheques", "archive")];
    renderPage();
    optionTableau("Souche de chèques");
    expect(screen.getByText("Archives")).toBeTruthy();
    fermerSelecteurTableaux();
    ouvrirSection("Souche de chèques");
    expect(screen.getByRole("heading", { name: "Souche de chèques" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Désarchiver" })).toBeTruthy();
  });

  it("un tableau archivé n'est plus modifiable, même par l'admin", () => {
    collecte.sections = [section("souche_cheques", "archive")];
    renderPage();
    ouvrirArchive("Souche de chèques");
    expect(screen.queryByRole("button", { name: "Ajouter une ligne" })).toBeNull();
    expect(screen.getByRole("button", { name: "Désarchiver" })).toBeTruthy();
  });
});

describe("Collecte : avertissement de répartition réservé au responsable de société", () => {
  const entete = { id: "l1", onglet: "bordereaux_remise_cheques", ordre: 0, data: { date_remise: "2026-10-10", num_bordereau: "3339", montant: 6660, banque: "", montant_cheque: "" } };
  const section = { id: "s", onglet: "bordereaux_remise_cheques", commentaire: "", recapStatut: "envoye", recuManuel: false, dateSuivi: null, totalSaisi: null, statut: "brouillon", transmisLe: null, valideLe: null, motifRenvoi: "" };
  afterEach(() => {
    collecte.sections = [];
    collecte.lignes = [];
    perms.current = { isAdmin: true, poste: "admin", isCollaborateur: false, canManageCollaborateurs: true, canSeeSociete: () => true };
  });

  it("n'interrompt pas l'admin qui quitte un bordereau incomplet : il passe par le Récap", () => {
    collecte.sections = [section as never];
    collecte.lignes = [entete] as never;
    renderPage();
    ouvrirSection("Bordereaux remise de chèques");
    ouvrirSection("Souche de chèques");
    expect(screen.queryByText("Répartition incomplète")).toBeNull();
    expect(sectionButton("Souche de chèques").getAttribute("aria-current")).toBe("page");
  });

  it("interrompt le responsable de société, avec un texte adapté à un dépassement", () => {
    perms.current = { isAdmin: false, poste: "societe_employe", isCollaborateur: false, canManageCollaborateurs: false, canSeeSociete: () => true };
    collecte.sections = [section as never, { ...section, id: "s2", onglet: "souche_cheques" } as never];
    collecte.lignes = [entete, { id: "l2", onglet: "bordereaux_remise_cheques", ordre: 1, data: { ...entete.data, montant: "", montant_cheque: 40000 } }] as never;
    renderPage();
    ouvrirSection("Bordereaux remise de chèques");
    ouvrirSection("Souche de chèques");
    expect(screen.getByText("Montants à vérifier")).toBeTruthy();
    expect(screen.getByText(/une faute de frappe/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Vérifier" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Continuer quand même" }));
    expect(sectionButton("Souche de chèques").getAttribute("aria-current")).toBe("page");
  });
});

describe("Collecte : espace limité du responsable de société", () => {
  const sectionOuverte = { id: "s", onglet: "bordereaux_remise_cheques", commentaire: "", recapStatut: "envoye", recuManuel: false, dateSuivi: null, totalSaisi: null, statut: "brouillon", transmisLe: null, valideLe: null, motifRenvoi: "" };
  const devenirClient = () => {
    perms.current = { isAdmin: false, poste: "societe_employe", isCollaborateur: false, canManageCollaborateurs: false, canSeeSociete: () => true };
  };
  afterEach(() => {
    collecte.sections = [];
    collecte.lignes = [];
    perms.current = { isAdmin: true, poste: "admin", isCollaborateur: false, canManageCollaborateurs: true, canSeeSociete: () => true };
  });

  it("n'a que le choix des tableaux demandés dans la barre, sans aucune section du cabinet", () => {
    devenirClient();
    collecte.sections = [sectionOuverte as never];
    renderPage();
    const nav = screen.getByRole("navigation", { name: "Sections du dossier", hidden: true });
    expect(within(nav).queryAllByRole("button", { hidden: true })).toHaveLength(0);
    // Les tableaux se choisissent dans le sélecteur : le tableau envoyé par le cabinet y est seul.
    fireEvent.keyDown(within(nav).getByRole("combobox", { name: "Choisir un tableau", hidden: true }), { key: "Enter", code: "Enter" });
    const proposes = screen.getAllByRole("option", { hidden: true }).map((o) => o.textContent ?? "");
    expect(proposes).toHaveLength(1);
    expect(proposes[0]).toMatch(/^Bordereaux remise de chèques/);
  });

  it("arrive directement sur le premier tableau à compléter, sans exports ni outils du cabinet", () => {
    devenirClient();
    collecte.sections = [sectionOuverte as never];
    renderPage();
    expect(screen.getByRole("heading", { name: "Bordereaux remise de chèques" })).toBeTruthy();
    expect(screen.queryByText("Checklist")).toBeNull();
    expect(screen.queryByRole("button", { name: /Tout en Excel/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Modifier la collecte/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Relancer/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Excel$/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^PDF$/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Exporter le tableau" })).toBeNull();
    expect(screen.queryByText(/pièces reçues/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Outils" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Transmettre au cabinet" })).toBeNull();
    expect(screen.getByRole("button", { name: /Enregistrer et transférer au cabinet/ })).toBeTruthy();
  });

  it("propose Quitter, qui ramène à la liste des collectes", () => {
    devenirClient();
    collecte.sections = [sectionOuverte as never];
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Quitter/ }));
    expect(screen.getByText("Liste des collectes")).toBeTruthy();
  });

  it("enregistre la saisie en cours avant de quitter, sans rien perdre", async () => {
    devenirClient();
    collecte.sections = [sectionOuverte as never];
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Ajouter une ligne" }));
    fireEvent.change(document.querySelectorAll<HTMLInputElement>("tbody tr[data-row] input")[1], { target: { value: "REM-1" } });
    fireEvent.click(screen.getByRole("button", { name: /Quitter/ }));
    await waitFor(() => expect(saveLignes).toHaveBeenCalledOnce());
    expect(await screen.findByText("Liste des collectes")).toBeTruthy();
  });

  it.each(["recap", "verification", "checklist", "documents", "historique", "souche_cheques"])("refuse la section %s par lien direct et ouvre le tableau demandé", (tab) => {
    devenirClient();
    collecte.sections = [sectionOuverte as never];
    renderPage(`/collectes/collecte-1?tab=${tab}`);
    expect(screen.getByRole("heading", { name: "Bordereaux remise de chèques" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Récap" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Vérifiez votre collecte" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Transmettre au cabinet" })).toBeNull();
    const nav = screen.getByRole("navigation", { name: "Sections du dossier" });
    expect(within(nav).queryAllByRole("button")).toHaveLength(0);
  });

  it("affiche l'attente sans ouvrir de tableau lorsque le cabinet n'a rien demandé", () => {
    devenirClient();
    renderPage("/collectes/collecte-1?tab=bordereaux_remise_cheques");
    expect(screen.getByText("Aucun tableau à compléter")).toBeTruthy();
    expect(screen.queryByRole("combobox", { name: "Choisir un tableau" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Ajouter une ligne" })).toBeNull();
  });

  it("conserve le brouillon si la demande est clôturée en direct et permet de l'enregistrer avant l'attente", async () => {
    devenirClient();
    collecte.onglets = ["bordereaux_remise_cheques"];
    collecte.sections = [sectionOuverte as never];
    const page = renderPage();
    stageRow();
    collecte.sections = collecte.sections.map((section) => ({ ...section, recapStatut: "none" }));
    page.refresh();
    expect(screen.getByText(/La demande a changé/)).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Bordereaux remise de chèques" })).toBeTruthy();
    expect(screen.getByDisplayValue("REM-42")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Enregistrer et transférer au cabinet" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(saveLignes).toHaveBeenCalledWith("collecte-1", "bordereaux_remise_cheques", expect.arrayContaining([
      expect.objectContaining({ data: expect.objectContaining({ num_bordereau: "REM-42" }) }),
    ])));
    expect(await screen.findByText("Aucun tableau à compléter")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Bordereaux remise de chèques" })).toBeNull();
    expect(transmettreSection).not.toHaveBeenCalled();
  });

  it("le cabinet garde ses outils accessibles depuis le menu", () => {
    renderPage();
    const bandeau = document.querySelector('[data-tour="collecte-identity"]') as HTMLElement;
    expect(within(bandeau).getByRole("button", { name: "Outils" })).toBeTruthy();
    expect(within(bandeau).getByRole("button", { name: "Quitter" })).toBeTruthy();
    const nav = screen.getByRole("navigation", { name: "Sections du dossier", hidden: true });
    const noms = within(nav).getAllByRole("button", { hidden: true }).map((b) => b.textContent ?? "");
    expect(noms.slice(0, 3)).toEqual(["Récap", "Checklist", "Documents"]);
  });
});

describe("Collecte : espace du collaborateur", () => {
  it("arrive sur la checklist et ignore un lien vers le Récap réservé à l'admin", () => {
    perms.current = { isAdmin: false, poste: "collaborateur", isCollaborateur: true, canManageCollaborateurs: false, canSeeSociete: () => true };
    renderPage("/collectes/collecte-1?tab=recap");
    expect(screen.getByRole("heading", { name: "Checklist" })).toBeTruthy();
    const nav = screen.getByRole("navigation", { name: "Sections du dossier" });
    expect(within(nav).queryByRole("button", { name: "Récap" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Récap" })).toBeNull();
    openBordereaux();
    expect(screen.getByRole("button", { name: "Enregistrer" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Enregistrer et voir le récap" })).toBeNull();
  });
});
