import { describe, expect, it } from "vitest";
import { paginateTasks, TASKS_PAGE_SIZE } from "./taskPagination";

const tasks = (count: number) =>
  Array.from({ length: count }, (_, index) => `task-${index + 1}`);

describe("paginateTasks", () => {
  it.each([0, 1, 9, 10])(
    "conserve au plus une page pour %i tâche(s)",
    (count) => {
      const result = paginateTasks(tasks(count), 1);

      expect(result.items).toHaveLength(count);
      expect(result.totalPages).toBe(1);
      expect(result.items.length).toBeLessThanOrEqual(TASKS_PAGE_SIZE);
    },
  );

  it.each([
    { count: 11, totalPages: 2, lastPageSize: 1 },
    { count: 20, totalPages: 2, lastPageSize: 10 },
    { count: 21, totalPages: 3, lastPageSize: 1 },
    { count: 54, totalPages: 6, lastPageSize: 4 },
  ])(
    "découpe $count tâches en $totalPages pages",
    ({ count, totalPages, lastPageSize }) => {
      const first = paginateTasks(tasks(count), 1);
      const last = paginateTasks(tasks(count), totalPages);

      expect(first.items).toHaveLength(10);
      expect(last.items).toHaveLength(lastPageSize);
      expect(first.totalPages).toBe(totalPages);
      expect(last.lastItem).toBe(count);
    },
  );

  it("ramène une page devenue invalide sur la dernière page disponible", () => {
    const result = paginateTasks(tasks(11), 4);

    expect(result.page).toBe(2);
    expect(result.items).toEqual(["task-11"]);
  });
});
