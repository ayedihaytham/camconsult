import type { ReactNode } from "react";
import { ChevronDown, Download, Printer, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ExportFormat } from "@/lib/export";

interface DataTableToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  onExport?: (format: ExportFormat) => void;
  onPrint?: () => void;
  filters?: ReactNode;
  primaryAction?: ReactNode;
  selectedCount?: number;
  onDeleteSelected?: () => void;
  onClearSelection?: () => void;
}

export function DataTableToolbar({
  search,
  onSearchChange,
  searchPlaceholder = "Rechercher…",
  onExport,
  onPrint,
  filters,
  primaryAction,
  selectedCount = 0,
  onDeleteSelected,
  onClearSelection,
}: DataTableToolbarProps) {
  return (
    <div className="mb-3 space-y-3 no-print">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="pl-8"
            />
            {search && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Effacer la recherche"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {filters}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onExport && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4" />
                  Exporter
                  <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onExport("csv")}>
                  Format CSV (.csv)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onExport("xlsx")}>
                  Format Excel (.xlsx)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {onPrint && (
            <Button variant="outline" size="sm" onClick={onPrint}>
              <Printer className="h-4 w-4" />
              Imprimer
            </Button>
          )}
          {primaryAction}
        </div>
      </div>

      {selectedCount > 0 && (
        <div className="flex items-center justify-between rounded-md border border-border bg-secondary/60 px-3 py-2 text-sm animate-fade-in">
          <span className="font-medium">
            {selectedCount} ligne{selectedCount > 1 ? "s" : ""} sélectionnée
            {selectedCount > 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-2">
            {onDeleteSelected && (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={onDeleteSelected}
              >
                <Trash2 className="h-4 w-4" />
                Supprimer
              </Button>
            )}
            {onClearSelection && (
              <Button variant="ghost" size="sm" onClick={onClearSelection}>
                Annuler
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
