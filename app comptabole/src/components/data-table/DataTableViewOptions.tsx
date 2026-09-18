import type { Table } from "@tanstack/react-table";
import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function DataTableViewOptions<TData>({
  table,
}: {
  table: Table<TData>;
}) {
  const columns = table
    .getAllColumns()
    .filter((column) => column.getCanHide() && column.accessorFn);

  if (columns.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="hidden h-9 w-full shadow-none lg:inline-flex lg:w-auto"
          aria-label="Choisir les colonnes visibles"
        >
          <Settings2 className="h-4 w-4" />
          Colonnes
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Colonnes visibles</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {columns.map((column) => (
          <DropdownMenuCheckboxItem
            key={column.id}
            checked={column.getIsVisible()}
            onCheckedChange={(visible) => column.toggleVisibility(visible)}
          >
            {column.columnDef.meta?.label ?? column.id}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
