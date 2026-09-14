import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatNumber } from "@/lib/utils";
import type { DataTableColumn } from "@/components/common/DataTable";

/**
 * Tableau dense — carte arrondie avec en-tête en bandeau doux (plus le
 * filet noir 2px / renforcé toutes les 5 lignes de la direction Ledger Rule
 * d'origine, voir DESIGN-SYSTEM.md §4 pour l'historique). Même API de
 * colonnes que DataTable (réutilise son type `DataTableColumn`) pour rester
 * un remplacement direct dans les écrans migrés ; logique de tri /
 * pagination / sélection réimplémentée ici pour ne jamais toucher au
 * fichier DataTable.tsx partagé par des écrans non migrés (Journal, Employés,
 * Structuration).
 *
 * - `onRowClick` = action principale (clic direct sur la ligne) ; les
 *   actions secondaires/destructrices vont dans une colonne dédiée
 *   (typiquement un <LedgerRowMenu/>, ou des icônes directes s'il n'y en a
 *   que 1-2 — voir DESIGN-SYSTEM.md §4).
 */

interface LedgerTableProps<T> {
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

export function LedgerTable<T>({
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
}: LedgerTableProps<T>) {
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
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-secondary/50">
              {enableSelection && (
                <th className="w-10 border-b border-border py-3 pl-4">
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
                </th>
              )}
              {columns.map((col) => {
                const isSorted = sort?.columnId === col.id;
                return (
                  <th
                    key={col.id}
                    className={cn(
                      "whitespace-nowrap border-b border-border px-3 py-3 text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground",
                      alignClass[col.align ?? "left"],
                      col.headerClassName,
                    )}
                  >
                    {col.sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(col.id)}
                        className={cn(
                          "inline-flex items-center gap-1 transition-colors hover:text-foreground",
                          col.align === "right" && "flex-row-reverse",
                          isSorted && "text-foreground",
                        )}
                      >
                        {col.header}
                        {isSorted ? (
                          sort?.direction === "asc" ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : (
                            <ArrowDown className="h-3 w-3" />
                          )
                        ) : (
                          <ChevronsUpDown className="h-3 w-3 opacity-40" />
                        )}
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: pageSize }).map((_, i) => (
                <tr key={i} className="border-b border-border">
                  {enableSelection && (
                    <td className="py-2.5 pl-4">
                      <Skeleton className="h-4 w-4" />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td key={col.id} className="px-3 py-2.5">
                      <Skeleton className="h-4 w-full max-w-[140px]" />
                    </td>
                  ))}
                </tr>
              ))
            ) : pageRows.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="p-0">
                  {emptyState ?? (
                    <div className="py-12 text-center text-sm text-muted-foreground">
                      Aucun résultat.
                    </div>
                  )}
                </td>
              </tr>
            ) : (
              pageRows.map((row) => {
                const id = getRowId(row);
                const selected = selectedIds.includes(id);
                return (
                  <tr
                    key={id}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn(
                      "border-b border-border/70 last:border-b-0 transition-colors",
                      onRowClick && "cursor-pointer hover:bg-secondary/50",
                      selected && "bg-accent/[0.06]",
                    )}
                  >
                    {enableSelection && (
                      <td className="pl-4" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selected}
                          onCheckedChange={() => toggleRow(id)}
                          aria-label="Sélectionner la ligne"
                        />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td
                        key={col.id}
                        className={cn(
                          "px-3 py-2.5",
                          alignClass[col.align ?? "left"],
                          col.className,
                        )}
                      >
                        {col.cell(row)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col items-center justify-between gap-3 border-t border-border bg-secondary/30 px-4 py-3 text-xs text-muted-foreground sm:flex-row">
        <div>
          {enableSelection && selectedIds.length > 0 ? (
            <span className="font-semibold text-foreground">
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
          <button
            type="button"
            disabled={currentPage === 0}
            onClick={() => setPage(currentPage - 1)}
            className="rounded-full border border-border bg-card px-3 py-1.5 font-medium text-foreground shadow-sm transition-colors hover:bg-secondary disabled:cursor-default disabled:opacity-40 disabled:shadow-none"
          >
            ‹ Précédent
          </button>
          <span className="px-1 font-medium">
            Page {currentPage + 1} / {pageCount}
          </span>
          <button
            type="button"
            disabled={currentPage >= pageCount - 1}
            onClick={() => setPage(currentPage + 1)}
            className="rounded-full border border-border bg-card px-3 py-1.5 font-medium text-foreground shadow-sm transition-colors hover:bg-secondary disabled:cursor-default disabled:opacity-40 disabled:shadow-none"
          >
            Suivant ›
          </button>
        </div>
      </div>
    </div>
  );
}
