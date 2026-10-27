// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { Eye } from "lucide-react";
import { EmployesVolet } from "./EmployesVolet";
import { employee } from "@/lib/dashboard/dashboardFixtures.test-support";
import type { Employe } from "@/types";

afterEach(cleanup);

const membre = (id: string, nom: string, prenom: string, patch: Partial<Employe> = {}): Employe => ({ ...employee(id, ["s1", "s2", "s3"]), nom, prenom, email: `${prenom.toLowerCase()}@cabinet.tn`, ...patch });

function monter(patch: Partial<React.ComponentProps<typeof EmployesVolet>> = {}) {
  const props: React.ComponentProps<typeof EmployesVolet> = {
    employes: [membre("b", "Zahra", "Sara"), membre("a", "Ayari", "Karim", { type: "Comptable" }), membre("c", "Mekni", "Chaima", { statut: "inactif", societesAssignees: [] })],
    loading: false,
    emptyMessage: "Aucun collaborateur enregistré.",
    societyNames: new Map([["s1", "Alpha"], ["s2", "Beta"], ["s3", "Gamma"]]),
    openTaskCounts: new Map([["a", 3]]),
    droitsTotal: 5,
    droitsActifs: (e) => (e.id === "a" ? 4 : 1),
    onOpenFiche: vi.fn(),
    onOpenAcces: vi.fn(),
    menuActions: () => [{ icon: Eye, label: "Voir la fiche", onClick: () => {} }, { icon: Eye, label: "Accès", onClick: () => {} }, { icon: Eye, label: "Modifier", onClick: () => {} }],
    ...patch,
  };
  return { props, ...render(<EmployesVolet {...props} />) };
}

describe("Registre des collaborateurs : liste et volet", () => {
  it("liste l'équipe par ordre alphabétique et ouvre le premier dans le volet", () => {
    monter();
    const liste = screen.getByRole("list", { name: "Collaborateurs" });
    expect(within(liste).getAllByRole("button")).toHaveLength(3);
    expect(screen.getByRole("heading", { level: 2 }).textContent).toContain("Ayari");
  });

  it("le volet donne périmètre, droits, tâches ouvertes et statut réels", () => {
    monter();
    expect(screen.getByText("3 sociétés")).toBeTruthy();
    expect(screen.getByText("4/5")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByText("Actif", { selector: "dd" })).toBeTruthy();
  });

  it("choisir un autre collaborateur change le volet ; sans société, le périmètre le dit", () => {
    monter();
    fireEvent.click(screen.getByRole("button", { name: /Chaima/ }));
    const detail = within(screen.getByRole("region", { name: /Détail de/ }));
    expect(detail.getByText("0 sociétés")).toBeTruthy();
    expect(detail.getByText("Aucune société assignée")).toBeTruthy();
    expect(detail.getByText("Inactif", { selector: "dd" })).toBeTruthy();
  });

  it("les flèches du clavier parcourent la liste", () => {
    monter();
    const avant = screen.getByRole("heading", { level: 2 }).textContent;
    fireEvent.keyDown(screen.getByRole("list", { name: "Collaborateurs" }), { key: "ArrowDown" });
    expect(screen.getByRole("heading", { level: 2 }).textContent).not.toBe(avant);
  });

  it("« Ouvrir la fiche » et « Gérer les accès » agissent sur le collaborateur choisi", () => {
    const { props } = monter();
    fireEvent.click(screen.getByRole("button", { name: "Ouvrir la fiche" }));
    expect(props.onOpenFiche).toHaveBeenCalledWith(expect.objectContaining({ id: "a" }));
    fireEvent.click(screen.getByRole("button", { name: "Gérer les accès" }));
    expect(props.onOpenAcces).toHaveBeenCalledWith(expect.objectContaining({ id: "a" }));
  });

  it("chargement et liste vide sont annoncés", () => {
    monter({ loading: true });
    expect(screen.getByRole("status", { name: "Chargement des collaborateurs" })).toBeTruthy();
    cleanup();
    monter({ employes: [] });
    expect(screen.getByText("Aucun collaborateur enregistré.")).toBeTruthy();
  });
});
