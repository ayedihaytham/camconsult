// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { Collecte, Employe, Societe } from "@/types";
import { SocieteViewSheet } from "./SocieteViewSheet";

const { addEmploye, updateEmploye, deleteEmployes, etat, droits } = vi.hoisted(() => ({
  addEmploye: vi.fn(),
  updateEmploye: vi.fn().mockResolvedValue(undefined),
  deleteEmployes: vi.fn(),
  etat: { employes: [] as unknown[], collectes: [] as unknown[] },
  droits: { isAdmin: true, canManageCollaborateurs: true, isCollaborateur: false },
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
const societe = { id: "s1", raisonSociale: "CAM", theme: "PME", rne: "311221M", tva: "311221M", statut: "actif", creeLe: "2026-11-18T08:00:00Z", telephone: "20000000", email: "contact@cam.tn", adresse: "afran" } as Societe;

vi.mock("@/store/data", () => ({
  useData: (selector: (state: Record<string, unknown>) => unknown) => selector({ addEmploye, updateEmploye, deleteEmployes }),
  useSocieteEmployes: () => etat.employes,
  useSocieteById: () => societe,
}));
vi.mock("@/store/collectes", () => ({
  useCollectes: (selector: (state: { list: unknown[] }) => unknown) => selector({ list: etat.collectes }),
}));
vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({ ...droits, can: () => true }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

beforeEach(() => {
  etat.employes = [responsable];
  etat.collectes = [];
  Object.assign(droits, { isAdmin: true, canManageCollaborateurs: true, isCollaborateur: false });
  addEmploye.mockReset().mockResolvedValue(undefined);
});
afterEach(cleanup);

const ouvrir = (props: Partial<React.ComponentProps<typeof SocieteViewSheet>> = {}) =>
  render(<SocieteViewSheet open onOpenChange={vi.fn()} societe={societe} onOpenDossiers={vi.fn()} {...props} />);

describe("compte de société : tout se passe dans la même carte", () => {
  it("ouvre la modification dans la carte, Enregistrer grisé jusqu'à la première modification", async () => {
    ouvrir();
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

  it("l'email est obligatoire, et « Lien d'accès » apparaît pour l'adresse enregistrée", () => {
    ouvrir();
    fireEvent.click(screen.getByRole("button", { name: "Modifier haytham ayedi" }));
    const carte = within(screen.getByRole("dialog"));
    expect(carte.getByRole("button", { name: /Lien d'accès/ })).toBeTruthy();
    fireEvent.change(carte.getByLabelText(/Email/), { target: { value: "" } });
    expect(carte.queryByRole("button", { name: /Lien d'accès/ })).toBeNull();
    expect(carte.getByText("Email requis.")).toBeTruthy();
    fireEvent.change(carte.getByLabelText(/Email/), { target: { value: "pas-un-email" } });
    expect(carte.getByText("Email invalide.")).toBeTruthy();
  });

  it("« Ajouter » remplace la fiche par le formulaire dans la MÊME carte (une seule fenêtre), et la flèche ramène à la fiche", () => {
    ouvrir();
    fireEvent.click(screen.getByRole("button", { name: "Ajouter" }));
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    const carte = within(screen.getByRole("dialog"));
    expect(carte.getByText("Nouveau responsable")).toBeTruthy();
    expect(carte.queryByLabelText(/Mot de passe/)).toBeNull();
    expect(carte.getByText(/lien d.accès à usage unique/)).toBeTruthy();
    expect(carte.getByText("Prénom et nom requis.")).toBeTruthy();
    expect(carte.getByLabelText("Étape 1 sur 2")).toBeTruthy();
    fireEvent.click(carte.getByRole("radio", { name: /Délégué/ }));
    expect(carte.getByText("Nouveau délégué")).toBeTruthy();
    expect(screen.queryByText("Coordonnées")).toBeNull();
    fireEvent.click(carte.getByRole("button", { name: "Retour à la fiche" }));
    expect(screen.getByText("Coordonnées")).toBeTruthy();
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
  });

  it("après l'enregistrement, « Accès créé » s'affiche dans la même carte avec le lien, et « Ajouter un autre » rouvre le formulaire", async () => {
    addEmploye.mockResolvedValue({ lienAcces: "https://cabinet.example.test/activation?jeton=abc", emailEnvoi: "envoye" });
    ouvrir();
    fireEvent.click(screen.getByRole("button", { name: "Ajouter" }));
    const carte = within(screen.getByRole("dialog"));
    fireEvent.change(carte.getByLabelText(/Prénom/), { target: { value: "Sami" } });
    fireEvent.change(carte.getByLabelText(/Nom/), { target: { value: "Trabelsi" } });
    fireEvent.change(carte.getByLabelText(/Email/), { target: { value: "sami@societe.tn" } });
    fireEvent.click(carte.getByRole("button", { name: "Ajouter le responsable" }));
    await waitFor(() => expect(screen.getByText("Accès créé")).toBeTruthy());
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect((screen.getByLabelText("Lien d'accès") as HTMLInputElement).value).toBe("https://cabinet.example.test/activation?jeton=abc");
    expect(screen.getByText(/aussi été envoyé par email/)).toBeTruthy();
    expect(screen.getByLabelText("Étape 2 sur 2")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Ajouter un autre/ }));
    expect(screen.getByText("Nouveau responsable")).toBeTruthy();
    expect((screen.getByLabelText(/Prénom/) as HTMLInputElement).value).toBe("");
  });

  it("« Terminer » ramène à la fiche, et fermer la carte repart de la fiche à la réouverture", async () => {
    addEmploye.mockResolvedValue({ lienAcces: "https://cabinet.example.test/activation?jeton=abc", emailEnvoi: "smtp" });
    const { rerender } = ouvrir();
    fireEvent.click(screen.getByRole("button", { name: "Ajouter" }));
    const carte = within(screen.getByRole("dialog"));
    fireEvent.change(carte.getByLabelText(/Prénom/), { target: { value: "Sami" } });
    fireEvent.change(carte.getByLabelText(/Nom/), { target: { value: "Trabelsi" } });
    fireEvent.change(carte.getByLabelText(/Email/), { target: { value: "sami@societe.tn" } });
    fireEvent.click(carte.getByRole("button", { name: "Ajouter le responsable" }));
    await waitFor(() => expect(screen.getByText("Accès créé")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Terminer" }));
    expect(screen.getByText("Coordonnées")).toBeTruthy();
    // Formulaire resté ouvert, puis carte fermée et rouverte : on retrouve la fiche.
    fireEvent.click(screen.getByRole("button", { name: "Ajouter" }));
    expect(screen.getByText("Nouveau responsable")).toBeTruthy();
    rerender(<SocieteViewSheet open={false} onOpenChange={vi.fn()} societe={societe} />);
    rerender(<SocieteViewSheet open onOpenChange={vi.fn()} societe={societe} />);
    expect(screen.getByText("Coordonnées")).toBeTruthy();
  });
});

describe("fiche : cadre « Pour démarrer »", () => {
  it("société neuve : propose d'ajouter le responsable et de créer la première collecte, avec raccourcis", () => {
    etat.employes = [];
    droits.isCollaborateur = true;
    const onCreerCollecte = vi.fn();
    ouvrir({ onCreerCollecte });
    const cadre = within(screen.getByRole("region", { name: "Pour démarrer" }));
    expect(cadre.getByText("1 sur 3")).toBeTruthy();
    fireEvent.click(cadre.getByRole("button", { name: /Créer/ }));
    expect(onCreerCollecte).toHaveBeenCalledWith(societe);
    fireEvent.click(cadre.getByRole("button", { name: /Ajouter/ }));
    expect(screen.getByText("Nouveau responsable")).toBeTruthy();
  });

  it("disparaît quand le responsable existe et qu'une collecte est créée", () => {
    droits.isCollaborateur = true;
    etat.collectes = [{ id: "c1", societeId: "s1" } as Collecte];
    ouvrir({ onCreerCollecte: vi.fn() });
    expect(screen.queryByRole("region", { name: "Pour démarrer" })).toBeNull();
  });

  it("ne propose que les étapes que la personne peut accomplir (sans droit sur les comptes ni les collectes : pas de cadre)", () => {
    etat.employes = [];
    Object.assign(droits, { isAdmin: false, canManageCollaborateurs: false, isCollaborateur: false });
    ouvrir({ onCreerCollecte: vi.fn() });
    expect(screen.queryByRole("region", { name: "Pour démarrer" })).toBeNull();
  });
});
