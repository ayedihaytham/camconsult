// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { Noeud } from "@/types";
import { VueGenerale } from "./VueGenerale";

afterEach(cleanup);
beforeAll(() => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() });
});

const noeud = (id: string, libelle: string, type: "dossier" | "fichier", parentId: string | null): Noeud =>
  ({ id, libelle, type, parentId, description: "", societeId: "s1", creeLe: "2026-01-10T08:00:00Z", majLe: "2026-01-10T08:00:00Z" }) as unknown as Noeud;

const NODES = [
  noeud("r", "01-RUSPINA", "dossier", null),
  noeud("c", "Comptabilité générale 2026", "dossier", "r"),
  noeud("a", "achat", "dossier", "c"),
  noeud("v", "vente", "dossier", "c"),
  noeud("f1", "FA-0012.pdf", "fichier", "a"),
  noeud("f2", "FA-0013.pdf", "fichier", "a"),
];

function afficher() {
  const onOpenNode = vi.fn();
  render(
    <VueGenerale
      nodes={NODES}
      roots={[NODES[0]]}
      getSocieteById={() => null}
      onOpenNode={onOpenNode}
      actions={<button type="button">Ajouter une arborescence</button>}
    />,
  );
  return { onOpenNode };
}

describe("vue générale de l'arborescence d'une société", () => {
  it("montre la société, son dossier d'année puis ses dossiers avec leur nombre de fichiers", () => {
    afficher();
    expect(screen.getByText("3 dossiers · 2 fichiers")).toBeTruthy();
    expect(screen.getByText("2 dossiers")).toBeTruthy();
    const dossiers = within(screen.getByLabelText("Dossiers de Comptabilité générale 2026"));
    expect(dossiers.getByText("achat")).toBeTruthy();
    expect(dossiers.getByText("2 fichiers")).toBeTruthy();
    expect(dossiers.getByText("0 fichier")).toBeTruthy();
  });

  it("ouvre un dossier au clic et garde les boutons d'action dans la barre", () => {
    const { onOpenNode } = afficher();
    fireEvent.click(screen.getByRole("button", { name: /achat/ }));
    expect(onOpenNode).toHaveBeenCalledWith(NODES[2]);
    expect(screen.getByRole("button", { name: "Ajouter une arborescence" })).toBeTruthy();
  });
});
