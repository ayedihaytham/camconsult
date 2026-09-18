import {
  Fragment,
  useEffect,
  useMemo,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { ArrowDown, ArrowUp, ChevronDown, ChevronsUpDown, GripVertical } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type Modifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
 * - `enableColumnReorder` / `enableColumnResize` / `enableDensityToggle`
 *   sont opt-in (par défaut désactivés) : aucun autre écran migré n'est
 *   affecté tant qu'il ne les active pas explicitement.
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
  /** Glisser-déposer les en-têtes pour réordonner les colonnes (colonne
   * "actions" toujours épinglée à droite, non réordonnable). */
  enableColumnReorder?: boolean;
  /** Poignée de redimensionnement sur le bord droit de chaque en-tête. */
  enableColumnResize?: boolean;
  /** Bascule Confortable / Compact affichée au-dessus du tableau. */
  enableDensityToggle?: boolean;
  /** Ligne expansible : chevron en première colonne, déplie un panneau sous
   * la ligne (accordéon inline) sans quitter la page. État contrôlé par
   * l'appelant, comme la sélection. */
  expandedIds?: string[];
  onExpandedIdsChange?: (ids: string[]) => void;
  renderExpanded?: (row: T) => ReactNode;
}

type SortState = { columnId: string; direction: "asc" | "desc" } | null;
type Density = "comfortable" | "compact";

const alignClass = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
} as const;

const MIN_COL_WIDTH = 88;
const MAX_COL_WIDTH = 520;

/** Neutralise le déplacement vertical pendant le drag d'un en-tête : on ne
 * réordonne qu'horizontalement, la colonne ne doit pas "flotter". */
const restrictToHorizontalAxis: Modifier = ({ transform }) => ({
  ...transform,
  y: 0,
});

function ResizeHandle({
  colId,
  onResize,
}: {
  colId: string;
  onResize: (id: string, width: number) => void;
}) {
  function handlePointerDown(e: ReactPointerEvent<HTMLSpanElement>) {
    e.preventDefault();
    e.stopPropagation();
    const th = e.currentTarget.closest("th");
    const startWidth = th?.getBoundingClientRect().width ?? 160;
    const startX = e.clientX;
    function onMove(ev: PointerEvent) {
      const next = Math.min(
        MAX_COL_WIDTH,
        Math.max(MIN_COL_WIDTH, startWidth + (ev.clientX - startX)),
      );
      onResize(colId, next);
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  return (
    <span
      onPointerDown={handlePointerDown}
      className="group/resize absolute right-0 top-1/2 z-10 h-6 w-3 -translate-y-1/2 cursor-col-resize touch-none select-none"
      aria-hidden
    >
      <span className="mx-auto block h-full w-px bg-border transition-colors group-hover/resize:bg-accent" />
    </span>
  );
}

function SortableTh({
  id,
  align,
  headerClassName,
  width,
  resizable,
  onResize,
  children,
}: {
  id: string;
  align: "left" | "right" | "center";
  headerClassName?: string;
  width?: number;
  resizable?: boolean;
  onResize?: (id: string, width: number) => void;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  return (
    <th
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        width: width ? `${width}px` : undefined,
      }}
      className={cn(
        "relative whitespace-nowrap border-b border-border px-3 py-3 text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground",
        alignClass[align],
        isDragging && "z-20 bg-secondary",
        headerClassName,
      )}
    >
      <div className={cn("flex items-center gap-1", align === "right" && "flex-row-reverse")}>
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="shrink-0 cursor-grab touch-none rounded text-muted-foreground/30 transition-colors hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 active:cursor-grabbing"
          aria-label="Réordonner la colonne (glisser, ou flèches gauche/droite au clavier)"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        {children}
      </div>
      {resizable && onResize && <ResizeHandle colId={id} onResize={onResize} />}
    </th>
  );
}

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
  enableColumnReorder = false,
  enableColumnResize = false,
  enableDensityToggle = false,
  expandedIds = [],
  onExpandedIdsChange,
  renderExpanded,
}: LedgerTableProps<T>) {
  const [sort, setSort] = useState<SortState>(initialSort ?? null);
  const [page, setPage] = useState(0);
  const [density, setDensity] = useState<Density>("comfortable");
  const reorderableIds = useMemo(
    () => columns.filter((c) => !c.fixed).map((c) => c.id),
    [columns],
  );
  const [colOrder, setColOrder] = useState<string[]>(() => reorderableIds);
  const [colWidths, setColWidths] = useState<Record<string, number>>({});

  // Recale l'ordre si l'ensemble des colonnes réordonnables change (nouvelles
  // colonnes ajoutées à la fin, colonnes retirées simplement oubliées) —
  // sans jamais réinitialiser l'ordre déjà choisi par l'utilisateur.
  useEffect(() => {
    setColOrder((prev) => {
      const kept = prev.filter((id) => reorderableIds.includes(id));
      const added = reorderableIds.filter((id) => !kept.includes(id));
      return kept.length === reorderableIds.length && added.length === 0
        ? prev
        : [...kept, ...added];
    });
  }, [reorderableIds]);

  const orderedColumns = useMemo(() => {
    if (!enableColumnReorder) return columns;
    const byId = new Map(columns.map((c) => [c.id, c]));
    const sorted = colOrder
      .map((id) => byId.get(id))
      .filter((c): c is DataTableColumn<T> => Boolean(c));
    return [...sorted, ...columns.filter((c) => c.fixed)];
  }, [columns, colOrder, enableColumnReorder]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setColOrder((prev) => {
      const oldIndex = prev.indexOf(String(active.id));
      const newIndex = prev.indexOf(String(over.id));
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  }

  function handleResize(id: string, width: number) {
    setColWidths((prev) => ({ ...prev, [id]: width }));
  }

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

  function toggleExpanded(id: string) {
    if (!onExpandedIdsChange) return;
    onExpandedIdsChange(
      expandedIds.includes(id)
        ? expandedIds.filter((x) => x !== id)
        : [...expandedIds, id],
    );
  }

  const colSpan =
    columns.length + (enableSelection ? 1 : 0) + (renderExpanded ? 1 : 0);
  const headerPad = density === "compact" ? "py-1.5" : "py-3";
  const cellPad = density === "compact" ? "py-1" : "py-2.5";

  function headerContent(col: DataTableColumn<T>) {
    const isSorted = sort?.columnId === col.id;
    if (!col.sortable) return <span className="truncate">{col.header}</span>;
    return (
      <button
        type="button"
        onClick={() => toggleSort(col.id)}
        className={cn(
          "inline-flex items-center gap-1 truncate transition-colors hover:text-foreground",
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
    );
  }

  return (
    <div>
      {enableDensityToggle && (
        <div className="flex justify-end border-b border-border bg-secondary/30 px-3 py-1.5">
          <div className="inline-flex items-center gap-0.5 rounded-full bg-secondary/70 p-0.5 text-xs">
            {(["comfortable", "compact"] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDensity(d)}
                aria-pressed={density === d}
                className={cn(
                  "rounded-full px-2.5 py-1 font-medium transition-colors",
                  density === d
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {d === "comfortable" ? "Confortable" : "Compact"}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-secondary/50">
              {renderExpanded && (
                <th className={cn("w-8 border-b border-border pl-3", headerPad)} />
              )}
              {enableSelection && (
                <th className={cn("w-10 border-b border-border pl-4", headerPad)}>
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
                    className="transition-all duration-200 data-[state=checked]:rounded-full data-[state=checked]:scale-110"
                  />
                </th>
              )}
              {enableColumnReorder ? (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                  modifiers={[restrictToHorizontalAxis]}
                >
                  <SortableContext items={colOrder} strategy={horizontalListSortingStrategy}>
                    {orderedColumns.map((col) =>
                      col.fixed ? (
                        <th
                          key={col.id}
                          style={{
                            width: colWidths[col.id] ? `${colWidths[col.id]}px` : undefined,
                          }}
                          className={cn(
                            "whitespace-nowrap border-b border-border px-3 text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground",
                            headerPad,
                            alignClass[col.align ?? "left"],
                            col.headerClassName,
                          )}
                        >
                          {headerContent(col)}
                        </th>
                      ) : (
                        <SortableTh
                          key={col.id}
                          id={col.id}
                          align={col.align ?? "left"}
                          headerClassName={cn(headerPad, col.headerClassName)}
                          width={colWidths[col.id]}
                          resizable={enableColumnResize}
                          onResize={handleResize}
                        >
                          {headerContent(col)}
                        </SortableTh>
                      ),
                    )}
                  </SortableContext>
                </DndContext>
              ) : (
                orderedColumns.map((col) => (
                  <th
                    key={col.id}
                    style={{
                      width: colWidths[col.id] ? `${colWidths[col.id]}px` : undefined,
                    }}
                    className={cn(
                      "relative whitespace-nowrap border-b border-border px-3 text-[0.66rem] font-bold uppercase tracking-wide text-muted-foreground",
                      headerPad,
                      alignClass[col.align ?? "left"],
                      col.headerClassName,
                    )}
                  >
                    {headerContent(col)}
                    {enableColumnResize && !col.fixed && (
                      <ResizeHandle colId={col.id} onResize={handleResize} />
                    )}
                  </th>
                ))
              )}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: pageSize }).map((_, i) => (
                <tr key={i} className="border-b border-border">
                  {renderExpanded && (
                    <td className="pl-3">
                      <Skeleton className="h-4 w-4" />
                    </td>
                  )}
                  {enableSelection && (
                    <td className="py-2.5 pl-4">
                      <Skeleton className="h-4 w-4" />
                    </td>
                  )}
                  {orderedColumns.map((col) => (
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
                const expanded = Boolean(renderExpanded) && expandedIds.includes(id);
                return (
                  <Fragment key={id}>
                    <tr
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                      className={cn(
                        "group relative border-b border-border/70 transition-all duration-200 ease-out",
                        !expanded && "last:border-b-0",
                        onRowClick && "cursor-pointer",
                        selected
                          ? "bg-accent/[0.06]"
                          : "hover:z-10 hover:-translate-y-px hover:bg-card hover:[filter:drop-shadow(0_4px_10px_rgba(15,23,42,0.12))]",
                      )}
                    >
                      {renderExpanded && (
                        <td className="pl-3" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => toggleExpanded(id)}
                            aria-expanded={expanded}
                            aria-label={expanded ? "Réduire" : "Détails rapides"}
                            className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                          >
                            <ChevronDown
                              className={cn(
                                "h-3.5 w-3.5 transition-transform duration-200",
                                expanded && "rotate-180",
                              )}
                            />
                          </button>
                        </td>
                      )}
                      {enableSelection && (
                        <td className="pl-4" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selected}
                            onCheckedChange={() => toggleRow(id)}
                            aria-label="Sélectionner la ligne"
                            className="transition-all duration-200 data-[state=checked]:rounded-full data-[state=checked]:scale-110"
                          />
                        </td>
                      )}
                      {orderedColumns.map((col) => (
                        <td
                          key={col.id}
                          style={{
                            width: colWidths[col.id] ? `${colWidths[col.id]}px` : undefined,
                          }}
                          className={cn(
                            "px-3",
                            cellPad,
                            alignClass[col.align ?? "left"],
                            col.className,
                          )}
                        >
                          {col.cell(row)}
                        </td>
                      ))}
                    </tr>
                    {expanded && renderExpanded && (
                      <tr className="border-b border-border/70 last:border-b-0">
                        <td colSpan={colSpan} className="animate-in fade-in slide-in-from-top-1 bg-secondary/20 p-0 duration-200">
                          {renderExpanded(row)}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col items-center justify-between gap-2 border-t border-border bg-secondary/30 px-3 py-2.5 text-xs text-muted-foreground sm:flex-row sm:px-4">
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
