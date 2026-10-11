// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { Noeud } from "@/types";
import { FileTree } from "./FileTree";

vi.mock("@/store/data", () => ({ useSocietes: () => [{ id: "s1", raisonSociale: "01-RUSPINA" }] }));
afterEach(cleanup);

const noeud = (id: string, libelle: string, type: "dossier" | "fichier", parentId: string | null): Noeud =>
  ({ id, libelle, type, parentId, description: "", societeId: "s1", format: type === "fichier" ? "pdf" : undefined, creeLe: "2026-01-10T08:00:00Z", majLe: "2026-01-10T08:00:00Z" }) as unknown as Noeud;

const NODES = [
  noeud("r", "01-RUSPINA", "dossier", null),
  noeud("c", "Comptabilité générale 2026", "dossier", "r"),
  noeud("a", "achat", "dossier", "c"),
  noeud("f1", "FA-0012.pdf", "fichier", "a"),
  noeud("f2", "FA-0013.pdf", "fichier", "a"),
];

function afficher(extra: Partial<React.ComponentProps<typeof FileTree>> = {}) {
  const handlers = { onNavigate: vi.fn(), onAddFolder: vi.fn(), onAddFile: vi.fn(), onRename: vi.fn(), onMove: vi.fn(), onPreview: vi.fn(), onReparent: vi.fn(), onDelete: vi.fn() };
  render(<FileTree nodes={NODES} currentId={null} canCreate canEdit canDelete {...handlers} {...extra} />);
  return handlers;
}

describe("explorateur de documents (tableau et arborescence réunis)", () => {
  it("montre pour chaque dossier ce qu'il contient, et la société de chaque arborescence", () => {
    afficher({ afficherSociete: true });
    expect(screen.getAllByText(/2 dossiers · 2 fichiers/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("01-RUSPINA").length).toBeGreaterThan(1); // l'arbre et la ligne de la liste
  });

  it("liste des résultats de recherche avec le dossier où se trouve chaque élément", () => {
    afficher({ items: [NODES[3], NODES[4]], resultats: true });
    expect(screen.getByText("2 résultats dans toute l'arborescence")).toBeTruthy();
    expect(screen.getAllByText("01-RUSPINA › Comptabilité générale 2026 › achat")).toHaveLength(2);
  });

  it("sélectionne des éléments pour une action groupée", () => {
    const onSelectedIdsChange = vi.fn();
    afficher({ currentId: "a", selectedIds: [], onSelectedIdsChange });
    fireEvent.click(screen.getByRole("checkbox", { name: "Sélectionner FA-0012.pdf" }));
    expect(onSelectedIdsChange).toHaveBeenCalledWith(["f1"]);
  });

  it("propose de dupliquer une arborescence racine, pas un sous-dossier", () => {
    const onDuplicate = vi.fn();
    afficher({ onDuplicate });
    const liste = screen.getAllByRole("list").at(-1) as HTMLElement;
    fireEvent.keyDown(within(liste).getAllByRole("button").at(-1)!, { key: "Enter" });
    expect(screen.getByText("Dupliquer")).toBeTruthy();
  });

  it("dit qu'une recherche n'a rien trouvé", () => {
    afficher({ items: [], resultats: true });
    expect(screen.getByText("Aucun résultat pour cette recherche.")).toBeTruthy();
  });
});
