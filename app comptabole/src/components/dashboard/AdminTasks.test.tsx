// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AdminTasksTab } from "./tabs/AdminTasksTab";
import { buildDashboardData } from "@/lib/dashboard/dashboardData";
import { dashboardInput, employee, NOW, task } from "@/lib/dashboard/dashboardFixtures.test-support";

const droits = vi.hoisted(() => ({ canManageCollaborateurs: true, isResponsableSociete: false, isDelegue: false, employeId: null as string | null }));
const setTacheStatut = vi.hoisted(() => vi.fn(async (_id: string, _statut: string) => {}));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => droits }));
vi.mock("@/store/data", () => ({ useData: (selector: (state: unknown) => unknown) => selector({ setTacheStatut }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
import { toast } from "sonner";

beforeEach(() => {
  Object.assign(droits, { canManageCollaborateurs: true, isResponsableSociete: false, isDelegue: false, employeId: null });
  setTacheStatut.mockClear();
  vi.mocked(toast.success).mockClear();
});
afterEach(cleanup);

const monter = (taches = [task("a", "a_faire"), task("b", "en_cours"), task("c", "termine")], extra = {}) =>
  render(<MemoryRouter><AdminTasksTab data={buildDashboardData(dashboardInput({ taches, ...extra }))} now={NOW} /></MemoryRouter>);

describe("onglet Tâches du cabinet : actions de statut", () => {
  it("Commencer, Terminer et Rouvrir changent le statut par le magasin et préviennent (avec « Annuler » pour le cabinet)", async () => {
    monter();
    fireEvent.click(screen.getByRole("button", { name: "Commencer : Travail a" }));
    await waitFor(() => expect(setTacheStatut).toHaveBeenCalledWith("a", "en_cours"));
    fireEvent.click(screen.getByRole("button", { name: "Terminer : Travail b" }));
    await waitFor(() => expect(setTacheStatut).toHaveBeenCalledWith("b", "termine"));
    fireEvent.click(screen.getByRole("button", { name: "Rouvrir : Travail c" }));
    await waitFor(() => expect(setTacheStatut).toHaveBeenCalledWith("c", "en_cours"));
    expect(toast.success).toHaveBeenCalledWith("Tâche en cours", expect.objectContaining({ description: "Travail a" }));
    const options = vi.mocked(toast.success).mock.calls[0][1] as { action?: { label: string; onClick: () => void } };
    options.action?.onClick();
    expect(setTacheStatut).toHaveBeenLastCalledWith("a", "a_faire");
  });

  it("sans droit de gestion : aucune action ; assigné : peut avancer mais pas rouvrir", () => {
    Object.assign(droits, { canManageCollaborateurs: false });
    const { unmount } = monter();
    expect(screen.queryAllByRole("button", { name: /^(Commencer|Terminer|Rouvrir)/ })).toHaveLength(0);
    unmount();
    Object.assign(droits, { employeId: "emp-1" });
    monter();
    expect(screen.getByRole("button", { name: "Commencer : Travail a" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Terminer : Travail b" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Rouvrir : Travail c" })).toBeNull();
  });

  it("une tâche de société reste en lecture seule pour le cabinet, avec son indication", () => {
    monter([{ ...task("soc", "a_faire"), origine: "societe" }, task("cab", "a_faire")], { collaborateurs: [employee()] });
    expect(screen.getByText("Tâche de société (lecture seule au cabinet)")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Commencer : Travail soc" })).toBeNull();
    expect(screen.getByRole("button", { name: "Commencer : Travail cab" })).toBeTruthy();
  });
});

describe("onglet Tâches du cabinet : affichage", () => {
  it("fin prévue : affichée si renseignée, en rouge « en retard » une fois dépassée, jamais pour une tâche terminée", () => {
    monter([{ ...task("late", "en_cours"), finPrevue: "2026-09-20", debutPrevu: "2026-09-01" }, { ...task("ok", "a_faire"), finPrevue: "2026-10-20", debutPrevu: "2026-10-01" }, { ...task("fini", "termine"), finPrevue: "2026-09-01", debutPrevu: "2026-08-01" }, task("none", "a_faire")]);
    expect(screen.getByText(/Fin prévue 20\/09\/2026 · en retard/)).toBeTruthy();
    expect(screen.getByText("Fin prévue 20/10/2026")).toBeTruthy();
    expect(screen.getAllByText(/Fin prévue/)).toHaveLength(2);
  });

  it("le filtre par collaborateur ne montre que ses tâches, et un second clic le retire", () => {
    const { container } = monter([task("a", "a_faire", "emp-1"), task("b", "a_faire", "emp-2")], { collaborateurs: [employee("emp-1"), employee("emp-2")] });
    expect(container.querySelectorAll(".atk-card")).toHaveLength(2);
    const filtre = screen.getAllByRole("button", { name: /1 ouverte/ })[0];
    fireEvent.click(filtre);
    expect(container.querySelectorAll(".atk-card")).toHaveLength(1);
    fireEvent.click(filtre);
    expect(container.querySelectorAll(".atk-card")).toHaveLength(2);
  });

  it("la colonne Terminées se limite à trois cartes, puis « Voir les N autres »", () => {
    const { container } = monter(Array.from({ length: 5 }, (_, i) => task(`d${i}`, "termine")));
    expect(container.querySelectorAll(".atk-card")).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "Voir les 2 autres" }));
    expect(container.querySelectorAll(".atk-card")).toHaveLength(5);
    fireEvent.click(screen.getByRole("button", { name: "Réduire" }));
    expect(container.querySelectorAll(".atk-card")).toHaveLength(3);
  });

  it("aucune tâche : état vide qui propose la première création (ouvre le formulaire de la page Tâches)", () => {
    monter([]);
    expect(screen.getByRole("heading", { name: "Aucune tâche pour le moment" })).toBeTruthy();
    expect(screen.getAllByRole("link", { name: /Créer la première tâche/ })[0].getAttribute("href")).toBe("/taches?nouvelle=1");
    expect(screen.queryByRole("group", { name: "Filtrer par collaborateur" })).toBeNull();
  });

  it("recherche sans résultat : message clair", () => {
    monter();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "introuvable" } });
    expect(screen.getByText(/Aucune tâche ne correspond/)).toBeTruthy();
  });
});
