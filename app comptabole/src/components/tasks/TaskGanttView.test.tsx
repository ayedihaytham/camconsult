// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { TaskGanttView } from "./TaskGanttView";
import { presentTasks } from "./taskTypes";
import { task } from "@/lib/dashboard/dashboardFixtures.test-support";

vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ isAdmin: false, isResponsableSociete: false }) }));
afterEach(cleanup);
const raw = [{ ...task("planned"), titre: "Contrôle TVA", debutPrevu: "2026-10-05", finPrevue: "2026-10-14" }, { ...task("legacy"), titre: "Rapprochement bancaire" }];
const tasks = presentTasks({ tasks: raw, societesById: new Map(), collaborateurs: [], collaboratorPresence: new Map(), statusOverrides: {} });
function mount(editable = true) {
  const onEdit = vi.fn();
  const result = render(<TaskGanttView tasks={tasks} now={new Date(2026, 9, 11)} canManage={editable} canEditTask={() => editable} canChangeStatus={() => false} pendingTaskIds={new Set()} onStatusChange={vi.fn()} onEdit={onEdit} onDelete={vi.fn()} />);
  return { ...result, onEdit };
}
describe("Gantt des tâches", () => {
  it("trace seulement les périodes prévues et propose les tâches non planifiées", () => {
    const { container, onEdit } = mount();
    expect(container.querySelectorAll(".tasks-gantt-bar")).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "Non planifiées 1" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Planifier : Rapprochement bancaire" }));
    expect(onEdit).toHaveBeenCalledWith(raw[1]);
    fireEvent.click(screen.getByRole("button", { name: /Modifier la planification : Contrôle TVA/ }));
    expect(onEdit).toHaveBeenLastCalledWith(raw[0]);
  });
  it("permet de retrouver une tâche hors période et de changer d'échelle", () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Période suivante" }));
    expect(screen.getByText("novembre 2026")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Afficher sa période/ }));
    expect(screen.getByText("octobre 2026")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Semaine" }));
    expect(screen.getByRole("button", { name: "Semaine" }).getAttribute("aria-pressed")).toBe("true");
  });
  it("conserve les périodes visibles en lecture seule sans permettre leur modification", () => {
    const { container } = mount(false);
    expect(container.querySelectorAll(".tasks-gantt-bar")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /Modifier la planification|Planifier :/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Actions pour/ })).toBeNull();
  });
});
