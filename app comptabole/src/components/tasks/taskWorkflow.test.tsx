import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Tache, TacheStatut } from "@/types";
import { TaskNextAction } from "./TaskNextAction";
import { TaskStatusBadge } from "./TaskStatusBadge";
import { getNextTaskStatus, getTaskActivity, summarizeTasks } from "./taskTypes";

function task(statut: TacheStatut): Tache {
  return {
    id: "task-1",
    titre: "Contrôler les écritures",
    description: "",
    societeId: "societe-1",
    assigneId: "employee-1",
    statut,
    creePar: "admin-1",
    creeLe: "2026-09-18T10:00:00.000Z",
    majLe: "2026-09-19T10:00:00.000Z",
    termineLe: statut === "termine" ? "2026-09-20T10:00:00.000Z" : null,
  };
}

describe("Work Ledger task rules", () => {
  it("derives open tasks from à faire and en cours only", () => {
    expect(summarizeTasks([task("a_faire"), task("en_cours"), task("termine")]))
      .toEqual({ open: 2, todo: 1, doing: 1, done: 1 });
  });

  it("offers only the immediate next transition when the existing permission check allows it", () => {
    const allowed = vi.fn(() => true);
    expect(getNextTaskStatus(task("a_faire"), allowed)).toBe("en_cours");
    expect(getNextTaskStatus(task("en_cours"), allowed)).toBe("termine");
    expect(getNextTaskStatus(task("termine"), allowed)).toBeNull();
    expect(getNextTaskStatus(task("a_faire"), () => false)).toBeNull();
  });

  it("labels the actual completion event, falling back to update when completion is absent", () => {
    expect(getTaskActivity(task("termine")).label).toMatch(/^Terminée /);
    expect(getTaskActivity({ ...task("termine"), termineLe: null }).label).toMatch(/^Mise à jour /);
  });

  it("renders En cours as informational, never warning, and keeps a named action", () => {
    const badge = renderToStaticMarkup(<TaskStatusBadge status="en_cours" />);
    const action = renderToStaticMarkup(
      <TaskNextAction task={task("a_faire")} canChangeStatus={() => true} onStatusChange={vi.fn()} isPending={false} />,
    );
    expect(badge).toContain("En cours");
    expect(badge).not.toContain("warning");
    expect(action).toContain('aria-label="Passer en cours : Contrôler les écritures"');
  });
});
