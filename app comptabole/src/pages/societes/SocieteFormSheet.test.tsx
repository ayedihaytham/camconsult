// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Societe } from "@/types";
import { SocieteFormSheet } from "./SocieteFormSheet";

afterEach(cleanup);

const societe: Societe = {
  id: "1",
  raisonSociale: "CAM",
  rne: "1234567A",
  tva: "jldsfn",
  theme: "PME",
  code: "CLI-0001",
  statut: "actif",
  telephone: "",
  email: "contact@cam.tn",
  adresse: "Sfax",
  creeLe: "2026-10-12T08:00:00.000Z",
};

describe("carte de société", () => {
  it("en modification, Enregistrer reste grisé tant que rien ne change, puis envoie les valeurs", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<SocieteFormSheet open onOpenChange={vi.fn()} societe={societe} nextCode="CLI-0002" onSubmit={onSubmit} />);
    const enregistrer = screen.getByRole("button", { name: "Enregistrer" }) as HTMLButtonElement;
    expect(enregistrer.disabled).toBe(true);
    expect(screen.getByText("Aucune modification en attente")).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "Inactif" }));
    await waitFor(() => expect((screen.getByRole("button", { name: "Enregistrer" }) as HTMLButtonElement).disabled).toBe(false));
    expect(screen.getByText("Modifications non enregistrées")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ raisonSociale: "CAM", statut: "inactif", theme: "PME", code: "CLI-0001" });
  });

  it("en ajout, demande le RNE et la TVA et propose les types en pastilles", async () => {
    const onSubmit = vi.fn();
    render(<SocieteFormSheet open onOpenChange={vi.fn()} societe={null} nextCode="CLI-0002" onSubmit={onSubmit} />);
    expect(screen.getByText("Renseignez les informations de la nouvelle société cliente.")).toBeTruthy();
    expect(screen.queryByLabelText(/Code interne/)).toBeNull();
    expect(screen.getByText("Raison sociale, RNE et TVA requis")).toBeTruthy();
    expect(screen.getAllByRole("radio").length).toBe(8); // 5 types + 3 statuts
    fireEvent.click(screen.getByRole("button", { name: "Créer la société" }));
    await waitFor(() => expect(screen.getByText("Raison sociale requise")).toBeTruthy());
    expect(screen.getByText("RNE requis")).toBeTruthy();
    expect(screen.getByText("Numéro de TVA requis")).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
