import type { ComponentProps } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface DataTableSkeletonProps extends ComponentProps<"div"> {
  columnCount: number;
  rowCount?: number;
  variant?: "table" | "register";
}

export function DataTableSkeleton({
  columnCount,
  rowCount = 10,
  variant = "table",
  className,
  ...props
}: DataTableSkeletonProps) {
  const rows = Math.min(10, Math.max(1, rowCount));

  return (
    <div className={cn("w-full", className)} {...props}>
      <div
        className={cn(
          "hidden lg:block",
          variant === "register"
            ? "overflow-hidden border-y border-border/80 bg-transparent"
            : "overflow-hidden rounded-xl border border-border bg-card",
        )}
      >
        <Table>
          <TableHeader
            className={
              variant === "register"
                ? "[&_tr]:h-0 [&_th]:h-0 [&_th]:overflow-hidden [&_th]:border-0 [&_th]:p-0"
                : undefined
            }
          >
            <TableRow className="hover:bg-transparent">
              {Array.from({ length: columnCount }).map((_, index) => (
                <TableHead key={index}>
                  {variant === "table" && <Skeleton className="h-4 w-20" />}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: rows }).map((_, rowIndex) => (
              <TableRow
                key={rowIndex}
                className={cn(
                  "hover:bg-transparent",
                  variant === "register" && "h-[50px]",
                )}
              >
                {Array.from({ length: columnCount }).map((_, cellIndex) => (
                  <TableCell key={cellIndex}>
                    <Skeleton className="h-5 w-full max-w-40" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div
        className={cn(
          "lg:hidden",
          variant === "register" ? "space-y-0" : "space-y-2",
        )}
      >
        {Array.from({ length: Math.min(rows, 4) }).map((_, index) => (
          <div
            key={index}
            className={cn(
              variant === "register"
                ? "border-b border-border/80 px-1 py-3"
                : "rounded-xl border border-border bg-card p-4",
            )}
          >
            <div className="flex items-center gap-2.5">
              {variant === "register" && (
                <Skeleton className="size-9 shrink-0 rounded-lg" />
              )}
              <div className="min-w-0 flex-1">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="mt-2 h-3 w-full" />
              </div>
            </div>
            <Skeleton className="mt-2 h-3 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}
