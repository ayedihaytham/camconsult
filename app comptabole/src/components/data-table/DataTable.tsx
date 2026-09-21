import { Fragment, type ComponentProps, type ReactNode } from "react";
import {
  flexRender,
  type Row,
  type Table as TanstackTable,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { DataTableSkeleton } from "./DataTableSkeleton";

interface DataTableProps<TData> extends ComponentProps<"div"> {
  /** Opt-in desktop density for ledger views with compact multi-line rows. */
  desktopDensity?: "default" | "compact";
  emptyMessage: string;
  footer?: ReactNode;
  getRowClassName?: (row: Row<TData>) => string | undefined;
  isLoading?: boolean;
  isRowExpanded?: (row: Row<TData>) => boolean;
  mobileRow?: (row: Row<TData>) => ReactNode;
  mobileFooter?: ReactNode;
  onRowClick?: (row: Row<TData>) => void;
  renderSubComponent?: (row: Row<TData>) => ReactNode;
  table: TanstackTable<TData>;
}

export function DataTable<TData>({
  desktopDensity = "default",
  table,
  emptyMessage,
  footer,
  getRowClassName,
  isLoading = false,
  isRowExpanded,
  mobileRow,
  mobileFooter,
  onRowClick,
  renderSubComponent,
  className,
  ...props
}: DataTableProps<TData>) {
  const isCompactDesktop = desktopDensity === "compact";
  if (isLoading) {
    return (
      <DataTableSkeleton
        columnCount={table.getVisibleLeafColumns().length}
        rowCount={table.getState().pagination.pageSize}
        className={className}
      />
    );
  }

  const rows = table.getRowModel().rows;

  return (
    <div className={cn("min-w-0", className)} {...props}>
      <div className="hidden overflow-hidden rounded-lg border border-border bg-card lg:block">
        <Table className="table-fixed">
          <TableHeader
            className="bg-muted/35 [&_th]:!h-9 [&_th]:!px-3 [&_th]:!text-xs [&_th]:!font-semibold [&_th]:!normal-case [&_th]:!tracking-normal"
          >
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow
                key={headerGroup.id}
                className="bg-muted/40 hover:bg-muted/40"
              >
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    colSpan={header.colSpan}
                    className={header.column.columnDef.meta?.headerClassName}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.length > 0 ? (
              rows.map((row) => (
                <Fragment key={row.id}>
                  <TableRow
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn(
                      "group bg-card hover:bg-muted/30",
                      isCompactDesktop
                        ? "h-[52px] [&>td]:align-middle"
                        : "h-12",
                      onRowClick && "cursor-pointer",
                      getRowClassName?.(row),
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          "min-w-0 px-3",
                          isCompactDesktop ? "py-1" : "py-1.5",
                          cell.column.columnDef.meta?.cellClassName,
                        )}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                  {renderSubComponent && isRowExpanded?.(row) && (
                    <TableRow className="bg-muted/15 hover:bg-muted/15">
                      <TableCell
                        colSpan={table.getVisibleLeafColumns().length}
                        className="p-0"
                      >
                        {renderSubComponent(row)}
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))
            ) : (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={table.getVisibleLeafColumns().length}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        {footer && (
          <div
            className={cn(
              "border-t border-border/70 px-3",
              isCompactDesktop ? "py-1" : "py-2",
            )}
          >
            {footer}
          </div>
        )}
      </div>

      <div className="space-y-2 lg:hidden">
        {rows.length > 0 ? (
          rows.map((row) =>
            mobileRow ? (
              <div key={row.id}>{mobileRow(row)}</div>
            ) : (
              <div
                key={row.id}
                className="space-y-2 rounded-xl border border-border bg-card p-4"
              >
                {row.getVisibleCells().map((cell) => (
                  <div key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </div>
                ))}
              </div>
            ),
          )
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
            {emptyMessage}
          </div>
        )}
        {mobileFooter && <div className="pt-1">{mobileFooter}</div>}
      </div>
    </div>
  );
}
