import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Tache, TacheStatut } from "@/types";
import { TaskNextAction } from "./TaskNextAction";
import { TaskStatusBadge } from "./TaskStatusBadge";
import { getNextTaskStatus, getTaskActivity, getTaskPlanning, societeInitiales, summarizeTasks } from "./taskTypes";

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
    origine: "cabinet",
    module: null,
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

describe("planning d'une carte", () => {
  const aujourdhui = new Date(2026, 9, 12); // 12 octobre 2026
  const planifiee = (statut: TacheStatut, debutPrevu: string, finPrevue: string) => ({ ...task(statut), debutPrevu, finPrevue });

  it("ne planifie rien sans les deux dates", () => {
    expect(getTaskPlanning(task("a_faire"), aujourdhui)).toBeNull();
    expect(getTaskPlanning({ ...task("a_faire"), debutPrevu: "2026-10-10" }, aujourdhui)).toBeNull();
  });

  it("dit où on en est entre le début et la fin prévus", () => {
    expect(getTaskPlanning(planifiee("en_cours", "2026-10-10", "2026-10-20"), aujourdhui)).toMatchObject({ plage: "10 – 20 oct.", label: "Fin dans 8 j", tone: "muted", progress: 20 });
    expect(getTaskPlanning(planifiee("en_cours", "2026-10-10", "2026-10-14"), aujourdhui)).toMatchObject({ label: "Fin dans 2 j", tone: "warn" });
    expect(getTaskPlanning(planifiee("en_cours", "2026-10-01", "2026-10-09"), aujourdhui)).toMatchObject({ label: "Fin dépassée de 3 j", tone: "bad", progress: 100 });
    expect(getTaskPlanning(planifiee("a_faire", "2026-10-14", "2026-10-24"), aujourdhui)).toMatchObject({ label: "Débute dans 2 j", progress: 0 });
  });

  it("une tâche terminée n'est jamais en retard", () => {
    const fait = { ...planifiee("termine", "2026-10-01", "2026-10-09"), termineLe: "2026-10-11T08:00:00.000Z" };
    expect(getTaskPlanning(fait, aujourdhui)).toMatchObject({ label: "Terminée le 11 oct.", tone: "ok", progress: 100 });
  });

  it("tire les initiales d'une société", () => {
    expect(societeInitiales("05-I CARGO LINE")).toBe("IC");
    expect(societeInitiales("ha")).toBe("H");
  });
});
