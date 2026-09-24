import type { Table } from "@tanstack/react-table";
import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function DataTableViewOptions<TData>({
  table,
  placement = "standalone",
}: {
  table: Table<TData>;
  placement?: "standalone" | "submenu";
}) {
  const columns = table
    .getAllColumns()
    .filter((column) => column.getCanHide() && column.accessorFn);

  if (columns.length === 0) return null;

  const options = columns.map((column) => (
    <DropdownMenuCheckboxItem
      key={column.id}
      checked={column.getIsVisible()}
      onCheckedChange={(visible) => column.toggleVisibility(visible)}
    >
      {column.columnDef.meta?.label ?? column.id}
    </DropdownMenuCheckboxItem>
  ));

  if (placement === "submenu") {
    return (
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <Settings2 className="h-4 w-4" />
          Colonnes
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="w-48">
          <DropdownMenuLabel>Colonnes visibles</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {options}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    );
  }

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
        {options}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
