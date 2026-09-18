import type { ComponentProps } from "react";
import type { Column } from "@tanstack/react-table";
import {
  ChevronDown,
  ChevronsUpDown,
  ChevronUp,
  EyeOff,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface DataTableColumnHeaderProps<TData, TValue>
  extends ComponentProps<"div"> {
  column: Column<TData, TValue>;
  title: string;
}

export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  className,
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!(column.getCanSort() || column.getCanHide())) {
    return <div className={className}>{title}</div>;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "-ml-2 h-8 rounded-md px-2 text-xs font-semibold shadow-none",
            className,
          )}
        >
          {title}
          {column.getCanSort() &&
            (column.getIsSorted() === "desc" ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : column.getIsSorted() === "asc" ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
            ))}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {column.getCanSort() && (
          <>
            <DropdownMenuCheckboxItem
              checked={column.getIsSorted() === "asc"}
              onSelect={() => column.toggleSorting(false)}
            >
              <ChevronUp className="h-4 w-4" />
              Croissant
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={column.getIsSorted() === "desc"}
              onSelect={() => column.toggleSorting(true)}
            >
              <ChevronDown className="h-4 w-4" />
              Décroissant
            </DropdownMenuCheckboxItem>
            {column.getIsSorted() && (
              <DropdownMenuItem onSelect={() => column.clearSorting()}>
                <X className="h-4 w-4" />
                Réinitialiser
              </DropdownMenuItem>
            )}
          </>
        )}
        {column.getCanHide() && (
          <DropdownMenuItem onSelect={() => column.toggleVisibility(false)}>
            <EyeOff className="h-4 w-4" />
            Masquer
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

