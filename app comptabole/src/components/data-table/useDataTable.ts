import { useEffect, useState } from "react";
import {
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type ColumnDef,
  type PaginationState,
  type SortingState,
  type Updater,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table";
import { clampPageIndex } from "./pagination";
import { DATA_TABLE_PAGE_SIZE } from "./types";

interface UseDataTableOptions<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  getRowId?: (row: TData) => string;
  pageSize?: number;
  resetKey?: string;
}

export function useDataTable<TData>({
  columns,
  data,
  getRowId,
  pageSize = DATA_TABLE_PAGE_SIZE,
  resetKey,
}: UseDataTableOptions<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize,
  });

  useEffect(() => {
    setPagination((current) => ({ ...current, pageIndex: 0, pageSize }));
  }, [pageSize, resetKey]);

  useEffect(() => {
    setPagination((current) => {
      const pageIndex = clampPageIndex(
        current.pageIndex,
        data.length,
        pageSize,
      );

      return pageIndex === current.pageIndex && current.pageSize === pageSize
        ? current
        : { pageIndex, pageSize };
    });
  }, [data.length, pageSize]);

  function onPaginationChange(updater: Updater<PaginationState>) {
    setPagination((current) => {
      const next = typeof updater === "function" ? updater(current) : updater;
      return {
        pageIndex: clampPageIndex(next.pageIndex, data.length, pageSize),
        pageSize,
      };
    });
  }

  const table = useReactTable({
    columns,
    data,
    getRowId,
    state: { sorting, columnVisibility, pagination },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    autoResetPageIndex: false,
  });

  return table;
}

