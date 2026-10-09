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
    onglets: ["bordereaux_remise_cheques", "souche_cheques"],
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
  it("place les sections en onglets sous le contenu, comme les feuilles d'Excel, et en marque une seule", () => {
    renderPage();
    const nav = screen.getByRole("navigation", { name: "Sections du dossier", hidden: true });
    const contenu = document.querySelector('[data-tour="collecte-content"]') as HTMLElement;
    // L'onglet se lit après le contenu : barre en bas.
    expect(contenu.compareDocumentPosition(nav) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const noms = within(nav).getAllByRole("button", { hidden: true }).map((b) => b.textContent);
    expect(noms.slice(0, 3)).toEqual(["Checklist", "Récap", "Documents"]);
    // Un seul onglet par état (le pastille de pièces manquantes s'ajoute au libellé : on compare le début) ; ses tableaux sont dans son menu.
    expect(noms.some((n) => n?.startsWith("CHQÉtat des chèques"))).toBe(true);
    expect(noms.some((n) => n?.startsWith("Bordereaux remise de chèques"))).toBe(false);
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
    await waitFor(() => expect(update).toHaveBeenCalledWith("collecte-1", { onglets: ["bordereaux_remise_cheques", "souche_cheques", "traites_escomptees"] }));
  });

  it("la checklist propose au cabinet d'ajouter les tableaux pas encore demandés, états compris", async () => {
    renderPage();
    const zone = screen.getByRole("region", { name: "Tableaux non demandés" });
    // Les deux tableaux de l'état des chèques sont déjà demandés : ils ne sont pas proposés.
    expect(within(zone).queryByRole("button", { name: /Bordereaux remise de chèques/ })).toBeNull();
    expect(within(zone).getByRole("button", { name: /Ajouter « Virements émis »/ })).toBeTruthy();
    fireEvent.click(within(zone).getByRole("button", { name: /Ajouter « Traites escomptées »/ }));
    await waitFor(() => expect(update).toHaveBeenCalledWith("collecte-1", { onglets: ["bordereaux_remise_cheques", "souche_cheques", "traites_escomptees"] }));
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
    ouvrirSection("État des chèques émis");
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
    ouvrirSection("État des chèques émis");
    expect(screen.queryByRole("dialog", { name: "Répartition incomplète" })).toBeNull();
    // Il reste la confirmation habituelle des modifications non enregistrées.
    expect(screen.getByRole("dialog", { name: "Modifications non enregistrées" })).toBeTruthy();
  });

  it("permet de continuer quand même, après l'avertissement", () => {
    renderPage();
    saisirBordereauIncomplet();
    ouvrirSection("État des chèques émis");
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
    ouvrirSection("État des chèques émis");
    expect(screen.queryByText("Modifications non enregistrées")).toBeNull();
    expect(sectionButton("État des chèques émis").getAttribute("aria-current")).toBe("page");
  });

  it("keeps staged data on Rester, then discards it before switching sections", () => {
    renderPage();
    openBordereaux();
    stageRow();
    ouvrirSection("État des chèques émis");
    expect(screen.getByRole("dialog", { name: "Modifications non enregistrées" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Rester" }));
    expect(screen.getByDisplayValue("REM-42")).toBeTruthy();
    ouvrirSection("État des chèques émis");
    fireEvent.click(screen.getByRole("button", { name: "Quitter sans enregistrer" }));
    expect(saveLignes).not.toHaveBeenCalled();
    expect(sectionButton("État des chèques émis").getAttribute("aria-current")).toBe("page");
  });

  it("waits for the existing save before switching sections", async () => {
    renderPage();
    openBordereaux();
    stageRow();
    ouvrirSection("État des chèques émis");
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer et changer" }));
    await waitFor(() => expect(saveLignes).toHaveBeenCalledOnce());
    await waitFor(() => expect(sectionButton("État des chèques émis").getAttribute("aria-current")).toBe("page"));
  });

  it("retains the current section and staged row when saving fails", async () => {
    saveLignes.mockRejectedValueOnce(new Error("network"));
    renderPage();
    openBordereaux();
    stageRow();
    ouvrirSection("État des chèques émis");
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
    fireEvent.keyDown(sectionButton("État des chèques émis"), { key: "Enter", code: "Enter" });
    expect(screen.getByRole("menuitem", { name: /État des chèques émis/ }).querySelector('[title="Transmis au cabinet"]')).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: /Bordereaux remise de chèques/ }).querySelector('[title="Validé"]')).toBeTruthy();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    ouvrirSection("État des chèques émis");
    expect(screen.getByRole("button", { name: "Valider ce tableau" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Renvoyer au client" })).toBeTruthy();
    ouvrirSection("Bordereaux remise de chèques");
    expect(screen.queryByRole("button", { name: "Valider ce tableau" })).toBeNull();
    expect(screen.getByRole("button", { name: "Archiver ce tableau" })).toBeTruthy();
  });

  it("un tableau archivé n'est plus modifiable, même par l'admin", () => {
    collecte.sections = [section("souche_cheques", "archive")];
    renderPage();
    ouvrirSection("État des chèques émis");
    expect(screen.queryByRole("button", { name: "Ajouter une ligne" })).toBeNull();
    expect(screen.getByRole("button", { name: "Désarchiver" })).toBeTruthy();
  });
});
