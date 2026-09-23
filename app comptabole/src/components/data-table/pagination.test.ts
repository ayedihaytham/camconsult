import { describe, expect, it } from "vitest";
import {
  clampPageIndex,
  getPageCount,
  getPaginationRange,
} from "./pagination";
import { DATA_TABLE_PAGE_SIZE } from "./types";

describe("data-table pagination", () => {
  it.each([
    { count: 0, pages: 1 },
    { count: 1, pages: 1 },
    { count: 9, pages: 1 },
    { count: 10, pages: 1 },
    { count: 11, pages: 2 },
    { count: 20, pages: 2 },
    { count: 21, pages: 3 },
    { count: 54, pages: 6 },
  ])("calcule $pages page(s) pour $count élément(s)", ({ count, pages }) => {
    expect(getPageCount(count)).toBe(pages);
  });

  it("utilise une taille fixe de dix éléments", () => {
    expect(DATA_TABLE_PAGE_SIZE).toBe(10);
    expect(getPaginationRange(21, 0)).toMatchObject({
      firstItem: 1,
      lastItem: 10,
    });
    expect(getPaginationRange(21, 2)).toMatchObject({
      firstItem: 21,
      lastItem: 21,
    });
  });

  it("calcule les pages et borne l'index avec la taille compacte", () => {
    expect(getPageCount(16, 6)).toBe(3);
    expect(clampPageIndex(2, 16, 6)).toBe(2);
    expect(clampPageIndex(2, 12, 6)).toBe(1);
    expect(getPaginationRange(6, 0, 6)).toMatchObject({
      firstItem: 1,
      lastItem: 6,
      pageCount: 1,
      pageIndex: 0,
    });
  });

  it("ramène une page invalide sur la dernière page disponible", () => {
    expect(clampPageIndex(4, 11)).toBe(1);
  });

  it("revient à la page précédente après suppression du dernier élément", () => {
    expect(clampPageIndex(2, 21)).toBe(2);
    expect(clampPageIndex(2, 20)).toBe(1);
  });
});
