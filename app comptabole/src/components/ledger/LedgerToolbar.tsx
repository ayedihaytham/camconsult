import type { ReactNode } from "react";
import { Download, Printer, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ExportFormat } from "@/lib/export";

interface LedgerToolbarProps {
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

/** Même rôle que DataTableToolbar, habillage Ledger (recherche soulignée,
 * actions secondaires en texte tracké plutôt qu'en boutons pleins). */
export function LedgerToolbar({
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
}: LedgerToolbarProps) {
  return (
    <div className="mb-0 space-y-3 py-4 no-print">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-1 flex-wrap items-end gap-3">
          <label className="flex min-w-[230px] items-center gap-2 rounded-full border border-transparent bg-secondary/70 px-3.5 py-2 transition-colors focus-within:border-input focus-within:bg-card">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
            {search && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="shrink-0 text-muted-foreground hover:text-foreground"
                aria-label="Effacer la recherche"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </label>
          {filters}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onExport && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="rounded-full">
                  <Download className="h-3.5 w-3.5" />
                  Exporter
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-2xl">
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
            <Button variant="outline" size="sm" className="rounded-full" onClick={onPrint}>
              <Printer className="h-3.5 w-3.5" />
              Imprimer
            </Button>
          )}
          {primaryAction}
        </div>
      </div>

      {selectedCount > 0 && (
        <div className="flex items-center justify-between rounded-2xl border border-accent/25 bg-accent/[0.07] px-4 py-2.5 text-sm shadow-sm animate-fade-in">
          <span className="font-semibold text-foreground">
            {selectedCount} ligne{selectedCount > 1 ? "s" : ""} sélectionnée
            {selectedCount > 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-2">
            {onDeleteSelected && (
              <Button
                variant="outline"
                size="sm"
                className="rounded-full border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={onDeleteSelected}
              >
                Supprimer
              </Button>
            )}
            {onClearSelection && (
              <Button variant="ghost" size="sm" className="rounded-full" onClick={onClearSelection}>
                Annuler
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
