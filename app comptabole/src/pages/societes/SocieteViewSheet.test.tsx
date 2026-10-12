// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { Societe } from "@/types";
import { SocieteViewSheet } from "./SocieteViewSheet";

vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({ isAdmin: false, can: (cle: string) => cle === "modifierSocietes" }),
}));

afterEach(cleanup);

const societe: Societe = {
  id: "1",
  raisonSociale: "CAM",
  rne: "1234567A",
  tva: "jldsfn",
  theme: "PME",
  code: "CLI-0001",
  statut: "actif",
  telephone: "+216 20 130 289",
  email: "contact@cam.tn",
  adresse: "Sfax",
  creeLe: "2026-10-12T08:00:00.000Z",
};

describe("fiche société en carte", () => {
  it("affiche l'identité, les coordonnées et le statut dans une carte", () => {
    render(<SocieteViewSheet open onOpenChange={vi.fn()} societe={societe} />);
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("CAM")).toBeTruthy();
    expect(screen.getByText("Actif")).toBeTruthy();
    expect(screen.queryByText("CLI-0001")).toBeNull();
    expect(screen.getByText("jldsfn")).toBeTruthy();
    expect(screen.getByRole("link", { name: "contact@cam.tn" })).toBeTruthy();
    expect(screen.getByText("Sfax")).toBeTruthy();
  });

  it("propose Modifier la société et Mes dossiers, et ne montre pas les contacts hors administrateur", () => {
    const onEdit = vi.fn();
    const onOpenDossiers = vi.fn();
    render(<SocieteViewSheet open onOpenChange={vi.fn()} societe={societe} onEdit={onEdit} onOpenDossiers={onOpenDossiers} />);
    fireEvent.click(screen.getByRole("button", { name: "Modifier la société" }));
    fireEvent.click(screen.getByRole("button", { name: "Mes dossiers" }));
    expect(onEdit).toHaveBeenCalledWith(societe);
    expect(onOpenDossiers).toHaveBeenCalledWith(societe);
    expect(screen.queryByText("Responsables et délégués")).toBeNull();
  });
});
