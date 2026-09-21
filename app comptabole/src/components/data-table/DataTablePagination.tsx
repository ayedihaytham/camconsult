import type { ComponentProps } from "react";
import type { Table } from "@tanstack/react-table";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getPaginationRange } from "./pagination";

interface DataTablePaginationProps<TData> extends ComponentProps<"div"> {
  itemLabel?: string;
  table: Table<TData>;
  variant?: "full" | "controls" | "count" | "metadata" | "mobile";
}

export function DataTablePagination<TData>({
  table,
  itemLabel = "éléments",
  variant = "full",
  className,
  ...props
}: DataTablePaginationProps<TData>) {
  const totalItems = table.getPrePaginationRowModel().rows.length;
  const { pageIndex, pageSize } = table.getState().pagination;
  const range = getPaginationRange(totalItems, pageIndex, pageSize);
  const isMobile = variant === "mobile";

  if (variant === "metadata") {
    return (
      <div
        className={cn(
          "whitespace-nowrap text-xs text-muted-foreground",
          className,
        )}
        {...props}
      >
        {totalItems} {itemLabel}
      </div>
    );
  }

  if (variant === "count") {
    return (
      <div
        className={cn("text-xs text-muted-foreground", className)}
        {...props}
      >
        {range.firstItem}–{range.lastItem} sur {totalItems} {itemLabel}
      </div>
    );
  }

  if (range.pageCount <= 1) {
    if (variant === "mobile") {
      return (
        <div
          className={cn(
            "flex min-w-0 items-center border-t border-border/70 px-1 pb-1 pt-2 text-xs text-muted-foreground",
            className,
          )}
          {...props}
        >
          <span className="truncate">
            {range.firstItem}–{range.lastItem} sur {totalItems} {itemLabel}
          </span>
        </div>
      );
    }
    return null;
  }

  const controls = (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        className={cn(
          "shadow-none",
          isMobile ? "hidden" : "hidden h-9 w-9 sm:inline-flex",
        )}
        aria-label="Première page"
        disabled={!table.getCanPreviousPage()}
        onClick={() => table.setPageIndex(0)}
      >
        <ChevronsLeft className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        className={cn(
          "shadow-none",
          isMobile ? "h-8 w-8" : "h-9 w-9",
        )}
        aria-label="Page précédente"
        disabled={!table.getCanPreviousPage()}
        onClick={() => table.previousPage()}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <div
        className={cn(
          "flex items-center gap-1.5 px-1 text-xs text-muted-foreground",
          isMobile ? "h-8" : "h-9",
        )}
      >
        <Input
          key={range.pageIndex}
          type="number"
          min={1}
          max={range.pageCount}
          defaultValue={range.pageIndex + 1}
          aria-label="Aller à la page"
          className={cn(
            "px-1 text-center text-xs font-medium text-foreground shadow-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
            isMobile ? "h-8 w-10" : "h-9 w-11",
          )}
          onChange={(event) => {
            const page = Number.parseInt(event.target.value, 10);
            if (page >= 1 && page <= range.pageCount) {
              table.setPageIndex(page - 1);
            }
          }}
        />
        <span>/ {range.pageCount}</span>
      </div>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        className={cn(
          "shadow-none",
          isMobile ? "h-8 w-8" : "h-9 w-9",
        )}
        aria-label="Page suivante"
        disabled={!table.getCanNextPage()}
        onClick={() => table.nextPage()}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        className={cn(
          "shadow-none",
          isMobile ? "hidden" : "hidden h-9 w-9 sm:inline-flex",
        )}
        aria-label="Dernière page"
        disabled={!table.getCanNextPage()}
        onClick={() => table.setPageIndex(range.pageCount - 1)}
      >
        <ChevronsRight className="h-4 w-4" />
      </Button>
    </div>
  );

  if (variant === "controls") {
    return (
      <div className={cn("flex items-center", className)} {...props}>
        {controls}
      </div>
    );
  }

  if (variant === "mobile") {
    return (
      <div
        className={cn(
          "flex items-center justify-between gap-3 border-t border-border/70 px-1 pb-1 pt-2 text-xs text-muted-foreground",
          className,
        )}
        {...props}
      >
        <span className="min-w-0 truncate">
          {range.firstItem}–{range.lastItem} sur {totalItems} {itemLabel}
        </span>
        {controls}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
      {...props}
    >
      <span>
        {range.firstItem}–{range.lastItem} sur {totalItems} {itemLabel}
      </span>
      {controls}
    </div>
  );
}
