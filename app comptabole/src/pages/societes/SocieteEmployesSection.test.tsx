// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { Employe, Societe } from "@/types";
import { SocieteEmployesSection } from "./SocieteEmployesSection";

const { addEmploye, updateEmploye, deleteEmployes } = vi.hoisted(() => ({
  addEmploye: vi.fn().mockResolvedValue(undefined),
  updateEmploye: vi.fn().mockResolvedValue(undefined),
  deleteEmployes: vi.fn(),
}));

const responsable = {
  id: "e1",
  prenom: "haytham",
  nom: "ayedi",
  identifiant: "h.ayedi",
  email: "haythamayedi5@gmail.com",
  role: "societe_employe",
  societeId: "s1",
  statut: "actif",
  delegue: false,
  doitChangerMotDePasse: true,
} as unknown as Employe;
const societe = { id: "s1", raisonSociale: "CAM" } as Societe;

vi.mock("@/store/data", () => ({
  useData: (selector: (state: Record<string, unknown>) => unknown) => selector({ addEmploye, updateEmploye, deleteEmployes }),
  useSocieteEmployes: () => [responsable],
  useSocieteById: () => societe,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

afterEach(cleanup);

describe("compte de société en carte", () => {
  it("ouvre la modification dans une carte, Enregistrer grisé jusqu'à la première modification", async () => {
    render(<SocieteEmployesSection societeId="s1" />);
    expect(screen.getByText("Doit changer son mot de passe")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Modifier haytham ayedi" }));
    const carte = within(screen.getByRole("dialog"));
    expect(carte.getByText("Modifier le responsable")).toBeTruthy();
    expect(carte.getByText("Donne les tâches")).toBeTruthy();
    expect(carte.getByText("Aucune modification en attente")).toBeTruthy();
    expect((carte.getByRole("button", { name: "Enregistrer" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(carte.getByLabelText(/Prénom/), { target: { value: "Haytham" } });
    await waitFor(() => expect((carte.getByRole("button", { name: "Enregistrer" }) as HTMLButtonElement).disabled).toBe(false));
    expect(carte.getByText("Modifications non enregistrées")).toBeTruthy();
    fireEvent.click(carte.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(updateEmploye).toHaveBeenCalledWith("e1", expect.objectContaining({ prenom: "Haytham", nom: "ayedi", identifiant: "h.ayedi" })));
  });

  it("l'email est obligatoire, et « Envoyer un email » apparaît pour une adresse valide", async () => {
    render(<SocieteEmployesSection societeId="s1" />);
    fireEvent.click(screen.getByRole("button", { name: "Modifier haytham ayedi" }));
    const carte = within(screen.getByRole("dialog"));
    expect(carte.getByRole("link", { name: "Envoyer un email à haythamayedi5@gmail.com" }).getAttribute("href")).toBe("mailto:haythamayedi5@gmail.com");
    fireEvent.change(carte.getByLabelText(/Email/), { target: { value: "" } });
    expect(carte.queryByRole("link", { name: /Envoyer un email/ })).toBeNull();
    expect(carte.getByText("Email requis.")).toBeTruthy();
    fireEvent.change(carte.getByLabelText(/Email/), { target: { value: "pas-un-email" } });
    expect(carte.getByText("Email invalide.")).toBeTruthy();
  });

  it("à l'ajout, propose le mot de passe avec Générer et dit ce qui manque", () => {
    render(<SocieteEmployesSection societeId="s1" />);
    fireEvent.click(screen.getByRole("button", { name: "Ajouter" }));
    const carte = within(screen.getByRole("dialog"));
    expect(carte.getByText("Nouveau responsable")).toBeTruthy();
    expect(carte.getByRole("button", { name: "Générer un mot de passe" })).toBeTruthy();
    expect(carte.getByText("Prénom et nom requis.")).toBeTruthy();
    fireEvent.click(carte.getByRole("radio", { name: /Délégué/ }));
    expect(carte.getByText("Nouveau délégué")).toBeTruthy();
  });
});
