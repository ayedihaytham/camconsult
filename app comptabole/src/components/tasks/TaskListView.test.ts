import { describe, expect, it } from "vitest";
import type { TacheStatut } from "@/types";
import { groupTaskListPage } from "./TaskListView";
import type { PresentedTask } from "./taskTypes";

function task(id: number, status: TacheStatut): PresentedTask {
  const timestamp = "2026-09-18T12:00:00.000Z";

  return {
    task: {
      id: String(id),
      titre: `Tâche ${id}`,
      description: "",
      societeId: "societe-1",
      assigneId: null,
      statut: status,
      creePar: "me",
      creeLe: timestamp,
      majLe: timestamp,
      termineLe: status === "termine" ? timestamp : null,
      origine: "cabinet",
      module: null,
    },
    columnId: status,
    societeName: "Atlas Conseil SARL",
    assigneeName: "Non assignée",
    assigneeInitials: "—",
    assigneeOnline: null,
  };
}

function dataset(size: number) {
  const statuses: TacheStatut[] = ["a_faire", "en_cours", "termine"];
  return Array.from({ length: size }, (_, index) =>
    task(index + 1, statuses[index % statuses.length]),
  );
}

describe("groupTaskListPage", () => {
  it.each([0, 1, 9, 10, 11, 20, 24])(
    "ne rend jamais plus que la page reçue pour %i tâches",
    (size) => {
      const allTasks = dataset(size);
      const visibleTasks = allTasks.slice(0, 10);
      const groups = groupTaskListPage(visibleTasks, allTasks);

      expect(groups.flatMap((group) => group.tasks)).toHaveLength(
        Math.min(size, 10),
      );
    },
  );

  it("groupe après pagination et conserve les comptes filtrés complets", () => {
    const allTasks = [
      ...Array.from({ length: 6 }, (_, index) => task(index, "a_faire")),
      ...Array.from({ length: 9 }, (_, index) => task(10 + index, "en_cours")),
      ...Array.from({ length: 9 }, (_, index) => task(30 + index, "termine")),
    ];
    const visibleTasks = [
      ...allTasks.slice(0, 4),
      ...allTasks.slice(6, 9),
      ...allTasks.slice(15, 18),
    ];

    const groups = groupTaskListPage(visibleTasks, allTasks);

    expect(
      groups.map(({ status, totalCount, tasks }) => ({
        status,
        totalCount,
        visibleCount: tasks.length,
      })),
    ).toEqual([
      { status: "a_faire", totalCount: 6, visibleCount: 4 },
      { status: "en_cours", totalCount: 9, visibleCount: 3 },
      { status: "termine", totalCount: 9, visibleCount: 3 },
    ]);
  });

  it("masque les groupes absents de la page courante", () => {
    const allTasks = dataset(20);
    const visibleTasks = allTasks
      .filter((item) => item.task.statut === "termine")
      .slice(0, 5);

    expect(
      groupTaskListPage(visibleTasks, allTasks).map((group) => group.status),
    ).toEqual(["termine"]);
  });
});
