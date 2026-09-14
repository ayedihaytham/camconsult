import { useMemo, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatNumber } from "@/lib/utils";

export interface DataTableColumn<T> {
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  sortAccessor?: (row: T) => string | number | Date;
  sortable?: boolean;
  className?: string;
  headerClassName?: string;
  align?: "left" | "right" | "center";
  /** Épingle la colonne au bord droit (reste visible au scroll horizontal). */
  stickyRight?: boolean;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  getRowId: (row: T) => string;
  enableSelection?: boolean;
  selectedIds?: string[];
  onSelectedIdsChange?: (ids: string[]) => void;
  onRowClick?: (row: T) => void;
  pageSize?: number;
  initialSort?: { columnId: string; direction: "asc" | "desc" };
  emptyState?: ReactNode;
  isLoading?: boolean;
}

type SortState = { columnId: string; direction: "asc" | "desc" } | null;

const alignClass = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
} as const;

export function DataTable<T>({
  columns,
  data,
  getRowId,
  enableSelection = false,
  selectedIds = [],
  onSelectedIdsChange,
  onRowClick,
  pageSize = 8,
  initialSort,
  emptyState,
  isLoading = false,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<SortState>(initialSort ?? null);
  const [page, setPage] = useState(0);

  const sortedData = useMemo(() => {
    if (!sort) return data;
    const col = columns.find((c) => c.id === sort.columnId);
    if (!col?.sortAccessor) return data;
    const acc = col.sortAccessor;
    const dir = sort.direction === "asc" ? 1 : -1;
    return [...data].sort((a, b) => {
      const va = acc(a);
      const vb = acc(b);
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
  }, [data, sort, columns]);

  const pageCount = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const pageRows = sortedData.slice(
    currentPage * pageSize,
    currentPage * pageSize + pageSize,
  );

  const pageIds = pageRows.map(getRowId);
  const allPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));
  const somePageSelected = pageIds.some((id) => selectedIds.includes(id));

  function toggleSort(columnId: string) {
    setSort((prev) => {
      if (prev?.columnId !== columnId) return { columnId, direction: "asc" };
      if (prev.direction === "asc") return { columnId, direction: "desc" };
      return null;
    });
  }

  function toggleRow(id: string) {
    if (!onSelectedIdsChange) return;
    onSelectedIdsChange(
      selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id],
    );
  }

  function togglePage() {
    if (!onSelectedIdsChange) return;
    if (allPageSelected) {
      onSelectedIdsChange(selectedIds.filter((id) => !pageIds.includes(id)));
    } else {
      onSelectedIdsChange([...new Set([...selectedIds, ...pageIds])]);
    }
  }

  const colSpan = columns.length + (enableSelection ? 1 : 0);

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-card">
      <Table>
        <TableHeader className="bg-muted/40">
          <TableRow className="hover:bg-transparent even:bg-transparent">
            {enableSelection && (
              <TableHead className="w-10 pl-4">
                <Checkbox
                  checked={
                    allPageSelected
                      ? true
                      : somePageSelected
                        ? "indeterminate"
                        : false
                  }
                  onCheckedChange={togglePage}
                  aria-label="Tout sélectionner"
                />
              </TableHead>
            )}
            {columns.map((col) => {
              const isSorted = sort?.columnId === col.id;
              return (
                <TableHead
                  key={col.id}
                  className={cn(
                    alignClass[col.align ?? "left"],
                    col.stickyRight &&
                      "sticky right-0 z-20 bg-muted shadow-[-8px_0_8px_-6px_rgba(15,44,76,0.08)]",
                    col.headerClassName,
                  )}
                >
                  {col.sortable ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(col.id)}
                      className={cn(
                        "-ml-1 inline-flex items-center gap-1 rounded px-1 py-0.5 text-xs font-semibold uppercase tracking-wide transition-colors hover:text-foreground",
                        col.align === "right" && "ml-auto flex-row-reverse",
                        isSorted && "text-foreground",
                      )}
                    >
                      {col.header}
                      {isSorted ? (
                        sort?.direction === "asc" ? (
                          <ArrowUp className="h-3.5 w-3.5" />
                        ) : (
                          <ArrowDown className="h-3.5 w-3.5" />
                        )
                      ) : (
                        <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
                      )}
                    </button>
                  ) : (
                    col.header
                  )}
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: pageSize }).map((_, i) => (
              <TableRow key={i} className="even:bg-transparent">
                {enableSelection && (
                  <TableCell className="pl-4">
                    <Skeleton className="h-4 w-4" />
                  </TableCell>
                )}
                {columns.map((col) => (
                  <TableCell key={col.id}>
                    <Skeleton className="h-4 w-full max-w-[140px]" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : pageRows.length === 0 ? (
            <TableRow className="even:bg-transparent hover:bg-transparent">
              <TableCell colSpan={colSpan} className="p-0">
                {emptyState ?? (
                  <div className="py-12 text-center text-sm text-muted-foreground">
                    Aucun résultat.
                  </div>
                )}
              </TableCell>
            </TableRow>
          ) : (
            pageRows.map((row) => {
              const id = getRowId(row);
              const selected = selectedIds.includes(id);
              return (
                <TableRow
                  key={id}
                  data-state={selected ? "selected" : undefined}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(onRowClick && "cursor-pointer")}
                >
                  {enableSelection && (
                    <TableCell
                      className="pl-4"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Checkbox
                        checked={selected}
                        onCheckedChange={() => toggleRow(id)}
                        aria-label="Sélectionner la ligne"
                      />
                    </TableCell>
                  )}
                  {columns.map((col) => (
                    <TableCell
                      key={col.id}
                      className={cn(
                        alignClass[col.align ?? "left"],
                        col.stickyRight &&
                          "sticky right-0 z-10 bg-card shadow-[-8px_0_8px_-6px_rgba(15,44,76,0.08)]",
                        col.className,
                      )}
                    >
                      {col.cell(row)}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      <div className="flex flex-col items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm text-muted-foreground sm:flex-row">
        <div>
          {enableSelection && selectedIds.length > 0 ? (
            <span className="font-medium text-foreground">
              {formatNumber(selectedIds.length)} sélectionné
              {selectedIds.length > 1 ? "s" : ""}
            </span>
          ) : (
            <span>
              {formatNumber(sortedData.length)} élément
              {sortedData.length > 1 ? "s" : ""}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span>
            Page {currentPage + 1} / {pageCount}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            disabled={currentPage === 0}
            onClick={() => setPage(currentPage - 1)}
            aria-label="Page précédente"
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            disabled={currentPage >= pageCount - 1}
            onClick={() => setPage(currentPage + 1)}
            aria-label="Page suivante"
          >
            <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  );
}
