import { DATA_TABLE_PAGE_SIZE } from "./types";

export function getPageCount(
  totalItems: number,
  pageSize = DATA_TABLE_PAGE_SIZE,
) {
  return Math.max(1, Math.ceil(totalItems / pageSize));
}

export function clampPageIndex(
  requestedPageIndex: number,
  totalItems: number,
  pageSize = DATA_TABLE_PAGE_SIZE,
) {
  return Math.min(
    Math.max(0, requestedPageIndex),
    getPageCount(totalItems, pageSize) - 1,
  );
}

export function getPaginationRange(
  totalItems: number,
  pageIndex: number,
  pageSize = DATA_TABLE_PAGE_SIZE,
) {
  const safePageIndex = clampPageIndex(pageIndex, totalItems, pageSize);
  const firstItem = totalItems === 0 ? 0 : safePageIndex * pageSize + 1;

  return {
    firstItem,
    lastItem: Math.min(firstItem + pageSize - 1, totalItems),
    pageCount: getPageCount(totalItems, pageSize),
    pageIndex: safePageIndex,
  };
}

