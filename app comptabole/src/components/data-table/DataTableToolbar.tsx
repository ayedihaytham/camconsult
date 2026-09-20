import type { ComponentProps, ReactNode } from "react";
import type { Table } from "@tanstack/react-table";
import { cn } from "@/lib/utils";
import { DataTableViewOptions } from "./DataTableViewOptions";

interface DataTableToolbarProps<TData> extends ComponentProps<"div"> {
  ariaLabel?: string;
  compact?: boolean;
  leading: ReactNode;
  primaryAction?: ReactNode;
  showViewOptions?: boolean;
  table: Table<TData>;
  trailing?: ReactNode;
}

export function DataTableToolbar<TData>({
  ariaLabel = "Outils du tableau",
  compact = false,
  leading,
  primaryAction,
  showViewOptions = false,
  table,
  trailing,
  children,
  className,
  ...props
}: DataTableToolbarProps<TData>) {
  return (
    <div
      role="toolbar"
      aria-label={ariaLabel}
      className={cn(
        compact
          ? "flex w-full flex-wrap items-center gap-2"
          : "flex flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between",
        className,
      )}
      {...props}
    >
      {compact ? (
        <>
          <div className="flex min-w-0 flex-1 flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
            {leading}
            {children}
          </div>
          <div className="ml-auto hidden items-center gap-2 lg:flex">
            {trailing}
            {showViewOptions && <DataTableViewOptions table={table} />}
            {primaryAction}
          </div>
        </>
      ) : (
        <>
          {leading}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {children}
            {trailing}
            {showViewOptions && <DataTableViewOptions table={table} />}
            {primaryAction}
          </div>
        </>
      )}
    </div>
  );
}
