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

describe("organigramme avec les mois", () => {
  it("montre sous chaque dossier de l'année son nombre de fichiers et « voir les mois »", () => {
    afficher();
    expect(screen.getByText("2 fichiers")).toBeTruthy();
    expect(screen.getByText("1 fichier")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /voir les mois/ })).toHaveLength(2);
    expect(screen.queryByLabelText("Mois de achat")).toBeNull();
  });

  it("déplie les 12 mois avec leur compte, puis liste les fichiers d'un mois au clic", () => {
    afficher();
    fireEvent.click(screen.getAllByRole("button", { name: /voir les mois/ })[0]);
    const mois = within(screen.getByLabelText("Mois de achat"));
    expect(mois.getAllByRole("button")).toHaveLength(12);
    fireEvent.click(mois.getByRole("button", { name: /Jan · 2/ }));
    const panneau = within(screen.getByLabelText("Fichiers du mois"));
    expect(panneau.getByText("achat · Janvier 2026")).toBeTruthy();
    expect(panneau.getByText("FA-0013.pdf")).toBeTruthy();
    expect(panneau.getByText("FA-0012.pdf")).toBeTruthy();
  });

  it("déplie ou replie tous les mois, et masque les mois si on le demande", () => {
    afficher();
    fireEvent.click(screen.getByRole("button", { name: "Tout déplier" }));
    expect(screen.getAllByLabelText(/^Mois de /)).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Tout replier" }));
    expect(screen.queryAllByLabelText(/^Mois de /)).toHaveLength(0);
    fireEvent.click(screen.getByLabelText("Afficher les mois"));
    expect(screen.queryByRole("button", { name: /voir les mois/ })).toBeNull();
  });
});
