// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { TasksTab } from "./tabs/TasksTab";
import { buildDashboardData } from "@/lib/dashboard/dashboardData";
import { dashboardInput, task, employee } from "@/lib/dashboard/dashboardFixtures.test-support";
import { getPageTour } from "@/components/tour/tourRegistry";

afterEach(cleanup);
function mount(input = dashboardInput()) {
  const data = buildDashboardData(input);
  return { data, ...render(<MemoryRouter><TasksTab data={data} /></MemoryRouter>) };
}
describe("Dashboard Tâches workspace", () => {
  it("promotes the deterministic active task while keeping the complete registers and routes", () => {
    const { data, container } = mount();
    expect(container.querySelector(".tasks-workspace-header")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Tâches" })).toBeNull();
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(screen.queryByRole("button", { name: "Filtrer" })).toBeNull();
    // Le sélecteur Ouvertes / Terminées ouvre l'espace de travail, dans la rangée qui porte aussi le résumé.
    const premier = container.querySelector(".dashboard-tasks-workspace")?.firstElementChild;
    expect(premier?.classList.contains("tasks-lens-row")).toBe(true);
    expect(premier?.querySelector('[data-tour="dashboard-task-lens"]')).not.toBeNull();
    const dossier = container.querySelector('[data-tour="dashboard-task-resume"]') as HTMLElement;
    expect(within(dossier).getByRole("heading").textContent).toBe(data.resumeTask?.titre);
    expect(within(dossier).getByRole("link", { name: "Reprendre" }).getAttribute("href")).toBe("/taches");
    expect(container.querySelectorAll('[data-tour="dashboard-task-ongoing"] li')).toHaveLength(2);
    expect(container.querySelectorAll('[data-tour="dashboard-task-todo"] li')).toHaveLength(1);
    container.querySelectorAll(".tasks-register-row").forEach((link) => expect(link.getAttribute("href")).toBe("/taches"));
  });
  it("switches full accessible task lists and preserves real summary counts", () => {
    const { container } = mount(dashboardInput({ taches: [task("active"), task("todo", "a_faire"), task("done", "termine")] }));
    expect(screen.getByText("2 tâches ouvertes")).toBeTruthy();
    expect(screen.getByText("1 en cours")).toBeTruthy();
    expect(screen.getByText("1 à faire")).toBeTruthy();
    expect(container.querySelectorAll(".tasks-register-row")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Terminées 1" }));
    expect(container.querySelector(".tasks-register-row")?.textContent).toContain("Travail done");
    expect(container.querySelectorAll(".tasks-register-row")).toHaveLength(1);
    expect(container.querySelector('[data-tour="dashboard-task-resume"]')).toBeNull();
  });
  it("keeps accessible colleagues and company-origin read-only work separate from personal tasks", () => {
    const { container } = mount(dashboardInput({ role: "collaborateur", viewerEmployeId: "emp-1", collaborateurs: [employee(), employee("emp-2")], taches: [task("own"), { ...task("other", "en_cours", "emp-2"), origine: "societe" }] }));
    const other = container.querySelector('[data-tour="dashboard-task-other"]') as HTMLElement;
    expect(within(other).getByText("Travail other")).toBeTruthy();
    expect(within(other).getByText("Tâche de société (lecture seule au cabinet)")).toBeTruthy();
    expect(container.querySelector('[data-tour="dashboard-task-resume"]')?.textContent).toContain("Travail own");
  });
  it("offers the Tasks walkthrough only on its tab and exposes all open-work targets", () => {
    const { container } = mount();
    const tour = getPageTour("/", null, "?tab=tasks");
    expect(tour?.id).toBe("dashboard-tasks");
    expect(getPageTour("/", null)?.version).toBe(3);
    tour?.steps.filter((step) => step.target !== "dashboard-task-completed").forEach((step) => expect(container.querySelector(`[data-tour="${step.target}"]`)).toBeTruthy());
  });
});
