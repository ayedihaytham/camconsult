// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CollecteFormDrawer } from "./CollecteFormDrawer";
import { COLLECTE_TABS } from "@/lib/collecte/tabs";

vi.mock("@/store/data", () => ({ useSocietes: () => [{ id: "soc-1", raisonSociale: "Société test" }] }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ canSeeSociete: () => true }) }));
afterEach(cleanup);

function renderForm(extra: Partial<React.ComponentProps<typeof CollecteFormDrawer>> = {}) {
  const onCreate = vi.fn().mockResolvedValue(undefined);
  const onOpenChange = vi.fn();
  const result = render(<CollecteFormDrawer open onOpenChange={onOpenChange} onCreate={onCreate} defaultSocieteId="soc-1" {...extra} />);
  return { ...result, onCreate, onOpenChange };
}

describe("CollecteFormDrawer : sélection de tableaux", () => {
  it("commence sans sélection et transmet uniquement les cartes choisies", async () => {
    const { onCreate } = renderForm();
    expect(screen.getAllByRole("checkbox", { checked: false })).toHaveLength(COLLECTE_TABS.length);
    fireEvent.click(screen.getByText("Virements reçus"));
    expect(screen.getByRole("checkbox", { name: "Virements reçus" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Créer la collecte" }));
    await waitFor(() => expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({
      societeId: "soc-1", onglets: ["virements_recus"],
    })));
  });

  it("sélectionne une famille sans sélectionner les autres tableaux", async () => {
    const { onCreate } = renderForm();
    fireEvent.click(screen.getByRole("button", { name: "Tout cocher : État des virements" }));
    expect(screen.getAllByRole("checkbox", { checked: true })).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "Créer la collecte" }));
    await waitFor(() => expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ onglets: ["virements_recus", "virements_emis", "virements_salaire"] })));
  });

  it("empêche une création sans tableau puis permet de corriger la sélection", async () => {
    const { onCreate } = renderForm();
    fireEvent.click(screen.getByRole("button", { name: "Créer la collecte" }));
    expect(screen.getByRole("alert").textContent).toBe("Sélectionnez au moins un tableau.");
    expect(onCreate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("checkbox", { name: "Souche de chèques" }));
    fireEvent.click(screen.getByRole("button", { name: "Créer la collecte" }));
    await waitFor(() => expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ onglets: ["souche_cheques"] })));
  });

  it("conserve la sélection et les paramètres existants en mode édition", async () => {
    const initial = { societeId: "soc-1", periode: "T3 2026", onglets: ["virements_recus"], devise: "EUR", echeance: "2026-10-20", relanceCadenceJours: 5 };
    const { onCreate } = renderForm({ initial });
    expect(screen.getAllByRole("checkbox", { checked: true })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(onCreate).toHaveBeenCalledWith(initial));
  });

  it("réinitialise la sélection quand une nouvelle création est rouverte", () => {
    const { rerender, onCreate, onOpenChange } = renderForm();
    fireEvent.click(screen.getByRole("checkbox", { name: "Virements reçus" }));
    rerender(<CollecteFormDrawer open={false} onCreate={onCreate} onOpenChange={onOpenChange} />);
    rerender(<CollecteFormDrawer open onCreate={onCreate} onOpenChange={onOpenChange} />);
    expect(screen.queryByRole("checkbox", { checked: true })).toBeNull();
    expect(screen.getAllByRole("checkbox", { checked: false })).toHaveLength(COLLECTE_TABS.length);
  });
});

describe("CollecteFormDrawer : période obligatoire", () => {
  it("propose le mois courant par défaut, des raccourcis, et refuse une période vide", async () => {
    const { onCreate } = renderForm();
    const champ = screen.getByLabelText(/Période concernée/) as HTMLInputElement;
    expect(champ.value).toMatch(/^[A-ZÉÛ][a-zéû]+ \d{4}$/);
    expect(screen.getByRole("group", { name: "Périodes proposées" })).toBeTruthy();
    fireEvent.click(screen.getByText("Virements reçus"));
    fireEvent.change(champ, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Créer la collecte" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/La période est obligatoire/);
    expect(onCreate).not.toHaveBeenCalled();
    const raccourci = screen.getByRole("group", { name: "Périodes proposées" }).querySelectorAll("button")[2];
    fireEvent.click(raccourci);
    expect(champ.value).toBe(raccourci.textContent);
  });
});
