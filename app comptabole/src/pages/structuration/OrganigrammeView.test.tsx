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

describe("organigramme : schéma société, armoire, tiroirs", () => {
  it("montre la société, l'armoire de l'année, puis un tiroir par dossier avec son nombre de fichiers", () => {
    afficher();
    expect(screen.getByText("Comptabilité générale 2026")).toBeTruthy();
    expect(screen.getByText("2 tiroirs · 3 fichiers")).toBeTruthy();
    const tiroirs = within(screen.getByRole("list", { name: "Tiroirs de Comptabilité générale 2026" }));
    expect(tiroirs.getByRole("button", { name: "Tiroir achat, 2 fichiers" })).toBeTruthy();
    expect(tiroirs.getByRole("button", { name: "Tiroir banque, 1 fichier" })).toBeTruthy();
  });

  it("affiche à droite les douze mois du tiroir choisi, puis les fichiers du mois cliqué, sans quitter le schéma", () => {
    afficher();
    // Le premier tiroir qui contient des fichiers est ouvert d'office.
    const mois = within(screen.getByLabelText("Mois de achat"));
    expect(mois.getAllByRole("button")).toHaveLength(12);
    expect(mois.getByRole("button", { name: /Janvier : 2 fichiers/ })).toBeTruthy();
    expect(screen.queryByLabelText("Fichiers du mois")).toBeNull();
    fireEvent.click(mois.getByRole("button", { name: /Janvier : 2 fichiers/ }));
    const volet = within(screen.getByLabelText("Fichiers du mois"));
    expect(volet.getByText("achat · Janvier 2026")).toBeTruthy();
    expect(volet.getByText("FA-0013.pdf")).toBeTruthy();
    expect(volet.getByText("FA-0012.pdf")).toBeTruthy();
    fireEvent.click(mois.getByRole("button", { name: /Février : 0 fichier/ }));
    expect(volet.getByText("Aucun fichier ce mois-ci.")).toBeTruthy();
  });

  it("un clic sur un autre tiroir affiche ses mois", () => {
    afficher();
    fireEvent.click(screen.getByRole("button", { name: "Tiroir banque, 1 fichier" }));
    const mois = within(screen.getByLabelText("Mois de banque"));
    expect(mois.getByRole("button", { name: /Mars : 1 fichier/ })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "banque" })).toBeTruthy();
  });

  it("ouvre un dossier depuis le schéma ou depuis le détail, et dépose dans le tiroir choisi si la session le peut", () => {
    const onOpenNode = vi.fn();
    const onDeposer = vi.fn();
    render(<OrganigrammeView nodes={NODES} roots={[NODES[0]]} getSocieteById={() => null} onOpenNode={onOpenNode} onDeposer={onDeposer} />);
    fireEvent.click(screen.getByRole("button", { name: /Comptabilité générale 2026/ }));
    expect(onOpenNode).toHaveBeenCalledWith(NODES[1]);
    fireEvent.click(screen.getByRole("button", { name: "Tiroir banque, 1 fichier" }));
    fireEvent.click(screen.getByRole("button", { name: "Ouvrir le dossier" }));
    expect(onOpenNode).toHaveBeenLastCalledWith(NODES[3]);
    fireEvent.click(screen.getByRole("button", { name: "Déposer dans banque" }));
    expect(onDeposer).toHaveBeenCalledWith(NODES[3]);
    cleanup();
    afficher();
    expect(screen.queryByRole("button", { name: /Déposer dans/ })).toBeNull();
  });
});
