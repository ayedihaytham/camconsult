// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { Noeud } from "@/types";
import { OrganigrammeView } from "./OrganigrammeView";

afterEach(cleanup);

const noeud = (id: string, libelle: string, type: "dossier" | "fichier", parentId: string | null, creeLe = "2026-01-10T08:00:00Z"): Noeud =>
  ({ id, libelle, type, parentId, description: "", societeId: "s1", format: type === "fichier" ? "pdf" : undefined, creeLe, majLe: creeLe }) as unknown as Noeud;

const NODES = [
  noeud("r", "01-RUSPINA", "dossier", null),
  noeud("c", "Comptabilité générale 2026", "dossier", "r"),
  noeud("a", "achat", "dossier", "c"),
  noeud("b", "banque", "dossier", "c"),
  noeud("f1", "FA-0012.pdf", "fichier", "a", "2026-01-05T08:00:00Z"),
  noeud("f2", "FA-0013.pdf", "fichier", "a", "2026-01-20T08:00:00Z"),
  noeud("f3", "Relevé BIAT mars.pdf", "fichier", "b", "2026-03-04T08:00:00Z"),
];

function afficher() {
  const onOpenNode = vi.fn();
  render(<OrganigrammeView nodes={NODES} roots={[NODES[0]]} getSocieteById={() => null} onOpenNode={onOpenNode} />);
  return { onOpenNode };
}

describe("organigramme vertical avec les mois", () => {
  it("montre la société, l'année puis une ligne par dossier avec son nombre de fichiers et ses 12 mois", () => {
    afficher();
    expect(screen.getByText("3 dossiers · 3 fichiers")).toBeTruthy();
    expect(screen.getByText("Comptabilité générale 2026")).toBeTruthy();
    const mois = within(screen.getByLabelText("Mois de achat"));
    expect(mois.getAllByRole("button")).toHaveLength(12);
    expect(mois.getByRole("button", { name: /Jan · 2/ })).toBeTruthy();
    expect(screen.getByText("2 fichiers")).toBeTruthy();
    expect(screen.getByText("1 fichier")).toBeTruthy();
  });

  it("affiche les fichiers d'un mois dans le volet de droite, sans quitter le schéma", () => {
    afficher();
    expect(screen.getByText(/Cliquez un mois pour voir ses fichiers/)).toBeTruthy();
    fireEvent.click(within(screen.getByLabelText("Mois de achat")).getByRole("button", { name: /Jan · 2/ }));
    const volet = within(screen.getByLabelText("Fichiers du mois"));
    expect(volet.getByText("achat · Janvier 2026")).toBeTruthy();
    expect(volet.getByText("FA-0013.pdf")).toBeTruthy();
    expect(volet.getByText("FA-0012.pdf")).toBeTruthy();
    fireEvent.click(within(screen.getByLabelText("Mois de banque")).getByRole("button", { name: "Fév" }));
    expect(volet.getByText("Aucun fichier ce mois-ci.")).toBeTruthy();
  });

  it("ouvre un dossier depuis son nom ou depuis le volet", () => {
    const { onOpenNode } = afficher();
    fireEvent.click(screen.getByRole("button", { name: "achat" }));
    expect(onOpenNode).toHaveBeenCalledWith(NODES[2]);
    fireEvent.click(within(screen.getByLabelText("Mois de banque")).getByRole("button", { name: /Mar · 1/ }));
    fireEvent.click(screen.getByRole("button", { name: "Ouvrir le dossier" }));
    expect(onOpenNode).toHaveBeenLastCalledWith(NODES[3]);
  });
});
