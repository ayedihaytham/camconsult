// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { Employe } from "@/types";
import { EmployeViewSheet } from "./EmployeViewSheet";

vi.mock("@/store/data", () => ({
  useSocietes: () => [{ id: "s1", raisonSociale: "05-I CARGO LINE" }],
  useData: (selector: (state: Record<string, unknown>) => unknown) => selector({ enLigneIds: ["e1"] }),
  PERMISSION_LABELS: {
    consulterDossiers: "Consulter les dossiers",
    deposerFichiers: "Déposer des fichiers",
    modifierSocietes: "Modifier les fiches sociétés",
    supprimer: "Supprimer des éléments",
    messagerie: "Accès à la messagerie",
  },
}));

afterEach(cleanup);

const employe = {
  id: "e1",
  prenom: "Haytham",
  nom: "Ayyedi",
  identifiant: "a.ayedi",
  email: "a@cabinet.tn",
  type: "Comptable",
  statut: "actif",
  creeLe: "2026-10-12T08:00:00.000Z",
  societesAssignees: ["s1"],
  permissions: { consulterDossiers: true, deposerFichiers: true, modifierSocietes: false, supprimer: false, messagerie: true },
} as unknown as Employe;

describe("fiche collaborateur en carte", () => {
  it("affiche identité, sociétés assignées et permissions autorisées ou refusées", () => {
    render(<EmployeViewSheet open onOpenChange={vi.fn()} employe={employe} />);
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Haytham Ayyedi")).toBeTruthy();
    expect(screen.getByText("Comptable")).toBeTruthy();
    expect(screen.getByText("a.ayedi")).toBeTruthy();
    expect(screen.getByText("05-I CARGO LINE")).toBeTruthy();
    expect(screen.getByText("3 sur 5 autorisées")).toBeTruthy();
    expect(screen.getAllByText("Refusé")).toHaveLength(2);
    expect(screen.getAllByText("Autorisé")).toHaveLength(3);
  });

  it("propose Assigner sans société, puis Modifier et Accès en pied de carte", () => {
    const onEdit = vi.fn();
    const onAcces = vi.fn();
    render(<EmployeViewSheet open onOpenChange={vi.fn()} employe={{ ...employe, societesAssignees: [] }} onEdit={onEdit} onAcces={onAcces} />);
    expect(screen.getByText("Aucune société assignée")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Assigner" }));
    fireEvent.click(screen.getByRole("button", { name: "Accès" }));
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: "e1" }));
    expect(onAcces).toHaveBeenCalled();
  });
});
