// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { CollecteFull } from "@/types";
import { CollecteEditorPage } from "./CollecteEditorPage";

const { saveLignes, fetchOne, clearCurrent, collecte } = vi.hoisted(() => {
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
  return {
    collecte,
    saveLignes: vi.fn().mockResolvedValue(undefined),
    fetchOne: vi.fn().mockResolvedValue(undefined),
    clearCurrent: vi.fn(),
  };
});

vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({ isAdmin: true, poste: "admin", isCollaborateur: false, canManageCollaborateurs: true, canSeeSociete: () => true }),
}));
vi.mock("@/store/data", () => ({
  useSocietes: () => [{ id: "soc-1", raisonSociale: "Société test" }],
}));
vi.mock("@/store/collectes", () => ({
  useCollectes: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ current: collecte, loadingOne: false, fetchOne, clearCurrent, saveLignes }),
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
  fireEvent.click(sectionButton("Bordereaux remise chèques"));
}

function sectionButton(name: string) {
  return within(screen.getByRole("navigation", { name: "Sections du dossier", hidden: true }))
    .getByRole("button", { name: new RegExp(`^${name}`), hidden: true });
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
    // Le pastille de pièces manquantes s'ajoute au libellé : on compare le début.
    expect(noms.some((n) => n?.startsWith("Bordereaux remise chèques"))).toBe(true);
    expect(noms.some((n) => n?.startsWith("Souche de chèques"))).toBe(true);
    expect(within(nav).getAllByRole("button", { hidden: true }).filter((b) => b.getAttribute("aria-current") === "page")).toHaveLength(1);
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
    expect(sectionButton("Bordereaux remise chèques").getAttribute("aria-current")).toBe("page");
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
    fireEvent.click(sectionButton("Souche de chèques"));
    const alerte = screen.getByRole("dialog", { name: "Répartition incomplète" });
    expect(alerte.textContent).toMatch(/Bordereau REM-42 : il reste 25\s000,000 TND à répartir/);
    fireEvent.click(within(alerte).getByRole("button", { name: "Compléter" }));
    expect(sectionButton("Bordereaux remise chèques").getAttribute("aria-current")).toBe("page");
  });

  it("laisse passer une fois le montant atteint", () => {
    renderPage();
    saisirBordereauIncomplet();
    const cases = document.querySelectorAll<HTMLInputElement>("tbody tr[data-row] input");
    fireEvent.change(cases[6], { target: { value: "60000" } });
    fireEvent.click(sectionButton("Souche de chèques"));
    expect(screen.queryByRole("dialog", { name: "Répartition incomplète" })).toBeNull();
    // Il reste la confirmation habituelle des modifications non enregistrées.
    expect(screen.getByRole("dialog", { name: "Modifications non enregistrées" })).toBeTruthy();
  });

  it("permet de continuer quand même, après l'avertissement", () => {
    renderPage();
    saisirBordereauIncomplet();
    fireEvent.click(sectionButton("Souche de chèques"));
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
    fireEvent.click(sectionButton("Souche de chèques"));
    expect(screen.queryByText("Modifications non enregistrées")).toBeNull();
    expect(sectionButton("Souche de chèques").getAttribute("aria-current")).toBe("page");
  });

  it("keeps staged data on Rester, then discards it before switching sections", () => {
    renderPage();
    openBordereaux();
    stageRow();
    fireEvent.click(sectionButton("Souche de chèques"));
    expect(screen.getByRole("dialog", { name: "Modifications non enregistrées" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Rester" }));
    expect(screen.getByDisplayValue("REM-42")).toBeTruthy();
    fireEvent.click(sectionButton("Souche de chèques"));
    fireEvent.click(screen.getByRole("button", { name: "Quitter sans enregistrer" }));
    expect(saveLignes).not.toHaveBeenCalled();
    expect(sectionButton("Souche de chèques").getAttribute("aria-current")).toBe("page");
  });

  it("waits for the existing save before switching sections", async () => {
    renderPage();
    openBordereaux();
    stageRow();
    fireEvent.click(sectionButton("Souche de chèques"));
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer et changer" }));
    await waitFor(() => expect(saveLignes).toHaveBeenCalledOnce());
    await waitFor(() => expect(sectionButton("Souche de chèques").getAttribute("aria-current")).toBe("page"));
  });

  it("retains the current section and staged row when saving fails", async () => {
    saveLignes.mockRejectedValueOnce(new Error("network"));
    renderPage();
    openBordereaux();
    stageRow();
    fireEvent.click(sectionButton("Souche de chèques"));
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer et changer" }));
    await waitFor(() => expect(within(screen.getByRole("dialog", { name: "Modifications non enregistrées" })).getByText(/Enregistrement impossible/).textContent).toContain("Vos modifications sont conservées"));
    expect(sectionButton("Bordereaux remise chèques").getAttribute("aria-current")).toBe("page");
    expect(screen.getByDisplayValue("REM-42")).toBeTruthy();
  });
});
