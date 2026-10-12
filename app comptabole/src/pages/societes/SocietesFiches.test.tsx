// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { Collecte, Employe, Societe } from "@/types";
import { SocietesFiches, type SocieteIndicateurs } from "./SocietesFiches";

afterEach(cleanup);

const societe = (id: string, raisonSociale: string, extra: Partial<Societe> = {}): Societe => ({
  id,
  raisonSociale,
  rne: "1234567A",
  tva: "",
  theme: "PME",
  code: `CLI-000${id}`,
  statut: "actif",
  telephone: "71 000 000",
  email: "contact@cam.tn",
  adresse: "",
  creeLe: "2026-09-24T08:00:00.000Z",
  ...extra,
});

const SOCIETES = [societe("1", "CAM"), societe("2", "05-I CARGO LINE", { statut: "en_attente" })];
const INDICATEURS = new Map<string, SocieteIndicateurs>([
  ["1", { taches: 0, collectes: 1, aExaminer: 0, dossiers: 9, contacts: 1 }],
  ["2", { taches: 2, collectes: 1, aExaminer: 3, dossiers: 46, contacts: 0 }],
]);
const COLLECTES = [{ id: "c1", societeId: "1", periode: "Octobre 2026", statut: "brouillon" }] as unknown as Collecte[];
const CONTACTS = [
  { id: "e1", nom: "Aye", prenom: "Hay", role: "societe_employe", societeId: "1", delegue: false },
] as unknown as Employe[];

function afficher(extra: Partial<Parameters<typeof SocietesFiches>[0]> = {}) {
  const onSelect = vi.fn();
  render(
    <SocietesFiches
      societes={SOCIETES}
      selectedId="1"
      onSelect={onSelect}
      indicateurs={INDICATEURS}
      collectes={COLLECTES}
      employes={CONTACTS}
      isAdmin={false}
      canEdit
      isLoading={false}
      emptyMessage="Aucune société."
      menuActions={() => []}
      onEdit={vi.fn()}
      onOpenDossiers={vi.fn()}
      onOpenCollecte={vi.fn()}
      {...extra}
    />,
  );
  return { onSelect };
}

describe("registre en liste et fiche", () => {
  it("montre la fiche de la société choisie avec ses chiffres, ses contacts et ses collectes", () => {
    afficher();
    expect(screen.getByRole("heading", { name: "CAM" })).toBeTruthy();
    expect(screen.getByText("Tâches en cours")).toBeTruthy();
    expect(screen.getByText("Collectes ouvertes")).toBeTruthy();
    expect(screen.getByText("Hay Aye")).toBeTruthy();
    expect(screen.getByText("Octobre 2026")).toBeTruthy();
  });

  it("change de société en un clic et signale les tableaux à examiner", () => {
    const { onSelect } = afficher();
    const liste = within(screen.getByRole("list", { name: "Sociétés" }));
    expect(liste.getByTitle("3 tableaux à examiner").textContent).toBe("3");
    fireEvent.click(liste.getByRole("button", { name: /05-I CARGO LINE/ }));
    expect(onSelect).toHaveBeenCalledWith("2");
  });

  it("n'affiche ni tâches ni collectes quand le profil ne les voit pas", () => {
    afficher({ indicateurs: new Map([["1", { taches: null, collectes: null, aExaminer: 0, dossiers: 9, contacts: 1 }]]) });
    expect(screen.queryByText("Tâches en cours")).toBeNull();
    expect(screen.queryByText("Collectes ouvertes")).toBeNull();
    expect(screen.queryByText("Collectes en cours")).toBeNull();
  });

  it("propose Modifier seulement avec le droit de modification", () => {
    afficher({ canEdit: false });
    expect(screen.queryByRole("button", { name: "Modifier" })).toBeNull();
    expect(screen.getByRole("button", { name: "Mes dossiers" })).toBeTruthy();
  });
});
