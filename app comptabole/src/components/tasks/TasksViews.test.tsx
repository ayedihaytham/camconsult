// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TasksKanban } from "@/components/uitripled/kanban-board-shadcnui";
import { task } from "@/lib/dashboard/dashboardFixtures.test-support";

vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ isAdmin: true, isResponsableSociete: false }) }));
beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() }));
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1440 });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const tasks = [{ ...task("todo", "a_faire"), titre: "Contrôle TVA" }, { ...task("active"), titre: "Rapprochement bancaire" }];
function mount(onStatusChange = vi.fn().mockResolvedValue(undefined)) {
  return render(<TasksKanban tasks={tasks} hasAnyTasks activeFilterCount={0} societes={[]} collaborateurs={[]} collaboratorPresence={new Map()} description="Travail du cabinet" summary={{ open: 2, todo: 1, doing: 1, done: 0 }} canManage canEditTask={() => true} canChangeStatus={() => true} onStatusChange={onStatusChange} onCreate={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} filterControls={null} filterKey="all" onResetFilters={vi.fn()} />);
}
describe("vues des tâches", () => {
  it("partage la recherche entre Kanban, Liste et Gantt", () => {
    mount();
    fireEvent.change(screen.getAllByLabelText("Rechercher une tâche")[0], { target: { value: "TVA" } });
    fireEvent.click(screen.getByRole("button", { name: "Gantt" }));
    expect(screen.getByText("Contrôle TVA")).toBeTruthy();
    expect(screen.queryByText("Rapprochement bancaire")).toBeNull();
    expect(screen.getByRole("button", { name: "Gantt" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Liste" }));
    expect(screen.getAllByText("Contrôle TVA").length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText("Rechercher une tâche")[0].getAttribute("value")).toBe("TVA");
  });
  it("sépare les poignées de déplacement des actions et restaure le statut après un échec", async () => {
    const onStatusChange = vi.fn().mockRejectedValue(new Error("Connexion"));
    const { container } = mount(onStatusChange);
    expect(screen.getByRole("button", { name: "Déplacer la tâche : Contrôle TVA" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Passer en cours : Contrôle TVA" }));
    await waitFor(() => expect(onStatusChange).toHaveBeenCalledWith(tasks[0], "en_cours"));
    await waitFor(() => expect(screen.getByRole("button", { name: "Passer en cours : Contrôle TVA" }).hasAttribute("disabled")).toBe(false));
    const todoColumn = container.querySelectorAll(".task-board-column")[0];
    expect(todoColumn.textContent).toContain("Contrôle TVA");
  });
});
