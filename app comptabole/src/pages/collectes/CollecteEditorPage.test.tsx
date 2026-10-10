// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { CollecteFull } from "@/types";
import { COLLECTE_ETATS, TAB_BY_KEY } from "@/lib/collecte/tabs";
import { CollecteEditorPage } from "./CollecteEditorPage";

const { saveLignes, fetchOne, clearCurrent, collecte, perms, update } = vi.hoisted(() => {
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
vi.mock("@/store/collectes", () => ({
  useCollectes: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ current: collecte, loadingOne: false, fetchOne, clearCurrent, saveLignes, update }),
}));

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  saveLignes.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderPage() {
  render(
    <MemoryRouter initialEntries={["/collectes/collecte-1"]}>
      <Routes>
        <Route path="/collectes/:id" element={<CollecteEditorPage />} />
        <Route path="/collectes" element={<p>Liste des collectes</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

function openBordereaux() {
  ouvrirSection("Bordereaux remise de chèques");
}

/** Onglet de la barre du bas : un onglet par état (chèques, virements, traites) pour ses tableaux, sinon l'onglet du tableau. */
function sectionButton(name: string) {
  const etat = COLLECTE_ETATS.find((e) => e.tableaux.some((k) => TAB_BY_KEY[k].label === name));
  return within(screen.getByRole("navigation", { name: "Sections du dossier", hidden: true }))
    .getByRole("button", { name: new RegExp(`^${etat ? `(${etat.code} )?${etat.label}` : name}`), hidden: true });
}

/** Ouvre un tableau archivé depuis le menu « Archives » de la barre du bas. */
function ouvrirArchive(name: string) {
  const nav = screen.getByRole("navigation", { name: "Sections du dossier", hidden: true });
  fireEvent.keyDown(within(nav).getByRole("button", { name: /Archives/, hidden: true }), { key: "Enter", code: "Enter" });
  fireEvent.click(screen.getByRole("menuitem", { name: new RegExp(`^${name}`) }));
}

/** Ouvre un tableau : le menu de son état s'ouvre, puis on choisit le tableau. */
function ouvrirSection(name: string) {
  const etat = COLLECTE_ETATS.find((e) => e.tableaux.some((k) => TAB_BY_KEY[k].label === name));
  if (!etat) return fireEvent.click(sectionButton(name));
  fireEvent.keyDown(sectionButton(name), { key: "Enter", code: "Enter" });
  fireEvent.click(screen.getByRole("menuitem", { name: new RegExp(`^${name}`) }));
}

/** Ajoute une ligne dans le tableau et y écrit le n° de bordereau (2ᵉ case). */
function stageRow() {
  fireEvent.click(screen.getByRole("button", { name: "Ajouter une ligne" }));
  const cases = document.querySelectorAll<HTMLInputElement>("tbody tr[data-row] input");
  fireEvent.change(cases[1], { target: { value: "REM-42" } });
}

describe("Collecte : onglets de feuille et actions visibles", () => {
  it("place la navigation avant le contenu et garde une seule section active", () => {
    renderPage();
    const nav = screen.getByRole("navigation", { name: "Sections du dossier", hidden: true });
    const contenu = document.querySelector('[data-tour="collecte-content"]') as HTMLElement;
    // La navigation reste visible avant la longue zone de saisie.
    expect(nav.compareDocumentPosition(contenu) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const noms = within(nav).getAllByRole("button", { hidden: true }).map((b) => b.textContent);
    expect(noms.slice(0, 3)).toEqual(["Checklist", "Récap", "Documents"]);
    // Un seul onglet par état (le pastille de pièces manquantes s'ajoute au libellé : on compare le début) ; ses tableaux sont dans son menu.
    expect(noms.some((n) => n?.startsWith("CHQÉtat des chèques"))).toBe(true);
    expect(noms.some((n) => n?.startsWith("Bordereaux remise de chèques"))).toBe(false);
    // La souche de chèques reste un onglet à part ; l'état des chèques émis est dans le menu de l'état.
    expect(noms.some((n) => n?.startsWith("Souche de chèques"))).toBe(true);
    expect(noms.some((n) => n?.startsWith("État des chèques émis"))).toBe(false);
    expect(within(nav).getAllByRole("button", { hidden: true }).filter((b) => b.getAttribute("aria-current") === "page")).toHaveLength(1);
  });

  it("ouvre les tableaux d'un état depuis son onglet, et le garde actif avec le tableau choisi", () => {
    renderPage();
    fireEvent.keyDown(sectionButton("État des chèques émis"), { key: "Enter", code: "Enter" });
    const items = screen.getAllByRole("menuitem").map((i) => i.textContent ?? "");
    expect(items).toHaveLength(2);
    expect(items[0]).toMatch(/^Bordereaux remise de chèques/);
    expect(items[1]).toMatch(/^État des chèques émis/);
    fireEvent.click(screen.getByRole("menuitem", { name: /^État des chèques émis/ }));
    const onglet = sectionButton("État des chèques émis");
    expect(onglet.getAttribute("aria-current")).toBe("page");
    expect(onglet.textContent).toContain("État des chèques émis");
    expect(screen.getByRole("heading", { name: "État des chèques émis" })).toBeTruthy();
  });

  it("la souche de chèques est un onglet à part, remplie par le client ; l'état des chèques émis est tenu par le cabinet", () => {
    renderPage();
    fireEvent.click(sectionButton("Souche de chèques"));
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
    const tr = sectionButton("Traites escomptées");
    expect(tr.textContent).toContain("État des traites");
    fireEvent.keyDown(tr, { key: "Enter", code: "Enter" });
    expect(screen.getByText("Pas encore demandés")).toBeTruthy();
    expect(screen.getAllByRole("menuitem").map((i) => i.textContent?.replace(/Ajouter$/, ""))).toEqual([
      "Bordereaux traites reçues",
      "État des traites émises",
      "Traites escomptées",
    ]);
    fireEvent.click(screen.getByRole("menuitem", { name: /Traites escomptées/ }));
    await waitFor(() => expect(update).toHaveBeenCalledWith("collecte-1", { onglets: ["bordereaux_remise_cheques", "etat_cheques_emis", "traites_escomptees", "souche_cheques"] }));
  });

  it("la checklist propose au cabinet d'ajouter les tableaux pas encore demandés, états compris", async () => {
    renderPage();
    const zone = screen.getByRole("region", { name: "Tableaux non demandés" });
    // Les deux tableaux de l'état des chèques sont déjà demandés : ils ne sont pas proposés.
    expect(within(zone).queryByRole("button", { name: /Bordereaux remise de chèques/ })).toBeNull();
    expect(within(zone).getByRole("button", { name: /Ajouter « Virements émis »/ })).toBeTruthy();
    fireEvent.click(within(zone).getByRole("button", { name: /Ajouter « Traites escomptées »/ }));
    await waitFor(() => expect(update).toHaveBeenCalledWith("collecte-1", { onglets: ["bordereaux_remise_cheques", "etat_cheques_emis", "traites_escomptees", "souche_cheques"] }));
  });

  it("garde tous les onglets sur une seule ligne, avec défilement horizontal plutôt qu'un retour à la ligne", () => {
    renderPage();
    const nav = screen.getByRole("navigation", { name: "Sections du dossier", hidden: true });
    expect(nav.className).not.toContain("flex-wrap");
    expect(nav.className).toContain("w-max");
    expect(nav.parentElement?.className).toContain("overflow-x-auto");
  });

  it("affiche directement les actions du dossier, sans menu Outils", () => {
    renderPage();
    expect(screen.queryByRole("button", { name: /^Outils/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Tout en Excel" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Modifier la collecte" })).toBeTruthy();
  });

  it("ouvre un tableau en un seul clic sur son onglet", () => {
    renderPage();
    openBordereaux();
    expect(sectionButton("Bordereaux remise de chèques").getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("button", { name: "Ajouter une ligne" })).toBeTruthy();
  });
});

describe("Collecte : bordereau incomplet", () => {
  // L'avertissement est réservé au responsable de société (le cabinet passe par le Récap).
  beforeEach(() => {
    perms.current = { isAdmin: false, poste: "societe_employe", isCollaborateur: false, canManageCollaborateurs: false, canSeeSociete: () => true };
    collecte.sections = [{ id: "s", onglet: "bordereaux_remise_cheques", commentaire: "", recapStatut: "none", recuManuel: false, dateSuivi: null, totalSaisi: null, statut: "brouillon", transmisLe: null, valideLe: null, motifRenvoi: "" } as never];
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

  it("laisse passer une fois le montant atteint", () => {
    renderPage();
    saisirBordereauIncomplet();
    const cases = document.querySelectorAll<HTMLInputElement>("tbody tr[data-row] input");
    fireEvent.change(cases[6], { target: { value: "60000" } });
    ouvrirSection("Souche de chèques");
    expect(screen.queryByRole("dialog", { name: "Répartition incomplète" })).toBeNull();
    // Il reste la confirmation habituelle des modifications non enregistrées.
    expect(screen.getByRole("dialog", { name: "Modifications non enregistrées" })).toBeTruthy();
  });

  it("permet de continuer quand même, après l'avertissement", () => {
    renderPage();
    saisirBordereauIncomplet();
    ouvrirSection("Souche de chèques");
    fireEvent.click(screen.getByRole("button", { name: "Continuer quand même" }));
    expect(screen.getByRole("dialog", { name: "Modifications non enregistrées" })).toBeTruthy();
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

  it("keeps staged data on Rester, then discards it before switching sections", () => {
    renderPage();
    openBordereaux();
    stageRow();
    ouvrirSection("Souche de chèques");
    expect(screen.getByRole("dialog", { name: "Modifications non enregistrées" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Rester" }));
    expect(screen.getByDisplayValue("REM-42")).toBeTruthy();
    ouvrirSection("Souche de chèques");
    fireEvent.click(screen.getByRole("button", { name: "Quitter sans enregistrer" }));
    expect(saveLignes).not.toHaveBeenCalled();
    expect(sectionButton("Souche de chèques").getAttribute("aria-current")).toBe("page");
  });

  it("waits for the existing save before switching sections", async () => {
    renderPage();
    openBordereaux();
    stageRow();
    ouvrirSection("Souche de chèques");
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer et changer" }));
    await waitFor(() => expect(saveLignes).toHaveBeenCalledOnce());
    await waitFor(() => expect(sectionButton("Souche de chèques").getAttribute("aria-current")).toBe("page"));
  });

  it("retains the current section and staged row when saving fails", async () => {
    saveLignes.mockRejectedValueOnce(new Error("network"));
    renderPage();
    openBordereaux();
    stageRow();
    ouvrirSection("Souche de chèques");
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer et changer" }));
    await waitFor(() => expect(within(screen.getByRole("dialog", { name: "Modifications non enregistrées" })).getByText(/Enregistrement impossible/).textContent).toContain("Vos modifications sont conservées"));
    expect(sectionButton("Bordereaux remise de chèques").getAttribute("aria-current")).toBe("page");
    expect(screen.getByDisplayValue("REM-42")).toBeTruthy();
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

  it("le responsable de société peut ajouter des lignes à un tableau à remplir, même si le cabinet a envoyé un récap", () => {
    client();
    collecte.sections = [{ ...(section("bordereaux_remise_cheques", "brouillon") as object), recapStatut: "envoye" } as never];
    renderPage();
    ouvrirSection("Bordereaux remise de chèques");
    expect(screen.getByRole("button", { name: "Ajouter une ligne" })).toBeTruthy();
    expect(screen.queryByText(/uniquement les cases marquées/)).toBeNull();
    expect(screen.getByRole("button", { name: /Enregistrer et transférer au cabinet/ })).toBeTruthy();
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

  it("le cabinet voit le statut de chaque tableau sur son onglet, et peut valider ou renvoyer celui qui est transmis", () => {
    collecte.sections = [section("souche_cheques", "transmis"), section("bordereaux_remise_cheques", "valide")];
    renderPage();
    // Le menu de l'état montre le statut de chacun de ses tableaux.
    fireEvent.keyDown(sectionButton("Bordereaux remise de chèques"), { key: "Enter", code: "Enter" });
    expect(screen.getByRole("menuitem", { name: /Bordereaux remise de chèques/ }).querySelector('[title="Validé"]')).toBeTruthy();
    // Un tableau hors état garde sa pastille sur son propre onglet.
    expect(sectionButton("Souche de chèques").querySelector('[title="Transmis au cabinet"]')).toBeTruthy();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    ouvrirSection("Souche de chèques");
    expect(screen.getByRole("button", { name: "Valider ce tableau" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Renvoyer au client" })).toBeTruthy();
    ouvrirSection("Bordereaux remise de chèques");
    expect(screen.queryByRole("button", { name: "Valider ce tableau" })).toBeNull();
    expect(screen.getByRole("button", { name: "Archiver ce tableau" })).toBeTruthy();
  });

  it("le client consulte l'état des chèques émis sans pouvoir le modifier", () => {
    client();
    renderPage();
    ouvrirSection("État des chèques émis");
    expect(screen.getByText(/vous pouvez le consulter, pas le modifier/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Ajouter une ligne" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Enregistrer et transférer au cabinet/ })).toBeNull();
  });

  it("un tableau archivé quitte les onglets de travail et se retrouve dans l'onglet Archives", () => {
    collecte.sections = [section("souche_cheques", "archive"), section("bordereaux_remise_cheques", "archive")];
    renderPage();
    const nav = screen.getByRole("navigation", { name: "Sections du dossier", hidden: true });
    const noms = within(nav).getAllByRole("button", { hidden: true }).map((b) => b.textContent ?? "");
    // Plus d'onglet « Souche de chèques » : elle est archivée.
    expect(noms.some((n) => n.startsWith("Souche de chèques"))).toBe(false);
    expect(noms.some((n) => n.startsWith("ARCHArchives"))).toBe(true);
    // L'état des chèques n'a plus que son tableau actif, et ne propose pas d'« ajouter » un tableau archivé.
    fireEvent.keyDown(sectionButton("État des chèques émis"), { key: "Enter", code: "Enter" });
    expect(screen.getAllByRole("menuitem").map((i) => i.textContent ?? "").join("|")).not.toMatch(/Bordereaux remise de chèques/);
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    // Les tableaux archivés s'ouvrent depuis le menu Archives.
    fireEvent.keyDown(within(nav).getByRole("button", { name: /Archives/, hidden: true }), { key: "Enter", code: "Enter" });
    const items = screen.getAllByRole("menuitem").map((i) => i.textContent ?? "");
    expect(items).toHaveLength(2);
    fireEvent.click(screen.getByRole("menuitem", { name: /Souche de chèques/ }));
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
  const section = { id: "s", onglet: "bordereaux_remise_cheques", commentaire: "", recapStatut: "none", recuManuel: false, dateSuivi: null, totalSaisi: null, statut: "brouillon", transmisLe: null, valideLe: null, motifRenvoi: "" };
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
    fireEvent.click(sectionButton("Souche de chèques"));
    expect(screen.queryByText("Répartition incomplète")).toBeNull();
    expect(sectionButton("Souche de chèques").getAttribute("aria-current")).toBe("page");
  });

  it("interrompt le responsable de société, avec un texte adapté à un dépassement", () => {
    perms.current = { isAdmin: false, poste: "societe_employe", isCollaborateur: false, canManageCollaborateurs: false, canSeeSociete: () => true };
    collecte.sections = [section as never];
    collecte.lignes = [entete, { id: "l2", onglet: "bordereaux_remise_cheques", ordre: 1, data: { ...entete.data, montant: "", montant_cheque: 40000 } }] as never;
    renderPage();
    ouvrirSection("Bordereaux remise de chèques");
    fireEvent.click(sectionButton("Souche de chèques"));
    expect(screen.getByText("Montants à vérifier")).toBeTruthy();
    expect(screen.getByText(/une faute de frappe/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Vérifier" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Continuer quand même" }));
    expect(sectionButton("Souche de chèques").getAttribute("aria-current")).toBe("page");
  });
});

describe("Collecte : espace limité du responsable de société", () => {
  const sectionOuverte = { id: "s", onglet: "bordereaux_remise_cheques", commentaire: "", recapStatut: "none", recuManuel: false, dateSuivi: null, totalSaisi: null, statut: "brouillon", transmisLe: null, valideLe: null, motifRenvoi: "" };
  const devenirClient = () => {
    perms.current = { isAdmin: false, poste: "societe_employe", isCollaborateur: false, canManageCollaborateurs: false, canSeeSociete: () => true };
  };
  afterEach(() => {
    collecte.sections = [];
    collecte.lignes = [];
    perms.current = { isAdmin: true, poste: "admin", isCollaborateur: false, canManageCollaborateurs: true, canSeeSociete: () => true };
  });

  it("n'a que le Récap et les tableaux à compléter dans la barre : ni Checklist, ni Documents, ni Historique", () => {
    devenirClient();
    collecte.sections = [sectionOuverte as never];
    renderPage();
    const nav = screen.getByRole("navigation", { name: "Sections du dossier", hidden: true });
    const noms = within(nav).getAllByRole("button", { hidden: true }).map((b) => b.textContent ?? "");
    expect(noms.some((n) => n === "Checklist")).toBe(false);
    expect(noms.some((n) => n.startsWith("Documents"))).toBe(false);
    expect(noms.some((n) => n === "Historique")).toBe(false);
    expect(noms.some((n) => n.startsWith("Récap"))).toBe(true);
    expect(noms.some((n) => n.startsWith("CHQ"))).toBe(true);
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
    expect(screen.queryByText(/pièces reçues/)).toBeNull();
    expect(screen.getByRole("button", { name: /Enregistrer et transférer au cabinet/ })).toBeTruthy();
  });

  it("propose Quitter, qui ramène à la liste des collectes", () => {
    devenirClient();
    collecte.sections = [sectionOuverte as never];
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Quitter/ }));
    expect(screen.getByText("Liste des collectes")).toBeTruthy();
  });

  it("prévient avant de quitter avec des modifications non enregistrées", () => {
    devenirClient();
    collecte.sections = [sectionOuverte as never];
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Ajouter une ligne" }));
    fireEvent.change(document.querySelectorAll<HTMLInputElement>("tbody tr[data-row] input")[1], { target: { value: "REM-1" } });
    fireEvent.click(screen.getByRole("button", { name: /Quitter/ }));
    expect(screen.getByRole("dialog", { name: "Modifications non enregistrées" })).toBeTruthy();
    expect(screen.queryByText("Liste des collectes")).toBeNull();
  });

  it("le cabinet garde tous ses outils", () => {
    renderPage();
    expect(screen.getByRole("button", { name: /Tout en Excel/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Quitter/ })).toBeNull();
    const nav = screen.getByRole("navigation", { name: "Sections du dossier", hidden: true });
    const noms = within(nav).getAllByRole("button", { hidden: true }).map((b) => b.textContent ?? "");
    expect(noms.slice(0, 3)).toEqual(["Checklist", "Récap", "Documents"]);
  });
});
