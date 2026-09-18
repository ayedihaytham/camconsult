export const TASKS_PAGE_SIZE = 10;

export interface TaskPage<T> {
  items: T[];
  page: number;
  totalPages: number;
  totalItems: number;
  firstItem: number;
  lastItem: number;
}

export function paginateTasks<T>(
  items: T[],
  requestedPage: number,
  pageSize = TASKS_PAGE_SIZE,
): TaskPage<T> {
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  const startIndex = (page - 1) * pageSize;

  return {
    items: items.slice(startIndex, startIndex + pageSize),
    page,
    totalPages,
    totalItems,
    firstItem: totalItems === 0 ? 0 : startIndex + 1,
    lastItem: Math.min(startIndex + pageSize, totalItems),
  };
}
