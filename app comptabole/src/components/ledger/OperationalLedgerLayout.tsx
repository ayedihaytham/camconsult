import type { ReactNode } from "react";
import type { Table } from "@tanstack/react-table";
import { cn } from "@/lib/utils";
import { DataTablePagination } from "@/components/data-table/DataTablePagination";

interface OperationalLedgerPageProps {
  children: ReactNode;
  className?: string;
}

/** Shared page frame; mobile rhythm is defined by the primitives below. */
export function OperationalLedgerPage({
  children,
  className,
}: OperationalLedgerPageProps) {
  return (
    <div
      className={cn(
        "operational-ledger-page flex w-full min-w-0 flex-col lg:gap-3",
        className,
      )}
    >
      {children}
    </div>
  );
}

interface OperationalLedgerToolbarProps {
  search: ReactNode;
  resultCount?: string;
  tools?: ReactNode;
  label: string;
}

/** Common desktop utility row; module controls and search semantics stay local. */
export function OperationalLedgerToolbar({
  search,
  resultCount,
  tools,
  label,
}: OperationalLedgerToolbarProps) {
  return (
    <div
      role="toolbar"
      aria-label={label}
      className="operational-ledger-toolbar hidden min-w-0 items-center gap-2 border-y border-border/80 bg-secondary/45 px-2 py-1 lg:flex"
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <div className="min-w-0 flex-1">{search}</div>
        {resultCount && (
          <span className="shrink-0 whitespace-nowrap text-xs tabular-nums text-muted-foreground">
            {resultCount}
          </span>
        )}
      </div>
      {tools && (
        <div className="ml-auto flex shrink-0 items-center gap-2">{tools}</div>
      )}
    </div>
  );
}

interface OperationalContentHeaderProps {
  children: ReactNode;
  className?: string;
}

/** Shared title/context band for registry and work-surface headers. */
export function OperationalContentHeader({
  children,
  className,
}: OperationalContentHeaderProps) {
  return (
    <div
      className={cn(
        "operational-ledger-content-header flex min-w-0 items-center justify-between gap-3 border-b border-border/80 bg-card px-3 py-1 sm:px-4 lg:min-h-10 lg:px-3",
        className,
      )}
    >
      {children}
    </div>
  );
}

interface OperationalMobileUtilityProps {
  children: ReactNode;
  label: string;
  className?: string;
}

/** Shared edge-to-edge mobile search/filter region. */
export function OperationalMobileUtility({
  children,
  label,
  className,
}: OperationalMobileUtilityProps) {
  return (
    <div
      role="toolbar"
      aria-label={label}
      className={cn(
        "operational-mobile-utility mt-2 min-w-0 bg-card px-3 py-2 lg:hidden",
        className,
      )}
    >
      <div className="min-w-0">{children}</div>
    </div>
  );
}

interface OperationalMobileHeaderProps {
  children: ReactNode;
  className?: string;
}

/** One compact header geometry for mobile registers and work queues. */
export function OperationalMobileHeader({
  children,
  className,
}: OperationalMobileHeaderProps) {
  return (
    <div
      className={cn(
        "operational-mobile-header mt-1 flex min-h-10 min-w-0 items-center justify-between gap-3 border-b border-border/80 bg-card px-3 py-1 lg:hidden",
        className,
      )}
    >
      {children}
    </div>
  );
}

interface OperationalMobilePaginationProps<TData> {
  table: Table<TData>;
  itemLabel: string;
  className?: string;
}

/** Shared post-register mobile pagination and quiet result count. */
export function OperationalMobilePagination<TData>({
  table,
  itemLabel,
  className,
}: OperationalMobilePaginationProps<TData>) {
  return (
    <div
      className={cn(
        "operational-mobile-pagination min-w-0 bg-card px-3 lg:hidden",
        className,
      )}
    >
      <DataTablePagination
        table={table}
        itemLabel={itemLabel}
        variant="mobile"
        className="px-0"
      />
    </div>
  );
}
