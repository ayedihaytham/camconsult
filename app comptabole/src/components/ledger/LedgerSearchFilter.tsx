import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Filter, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetBody,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface LedgerSearchFilterProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  searchLabel: string;
  filterLabel: string;
  activeFilterCount: number;
  onReset: () => void;
  children: ReactNode;
  onClearSearch?: () => void;
  className?: string;
}

function FilterPanel({
  children,
  activeFilterCount,
  onReset,
}: Pick<LedgerSearchFilterProps, "children" | "activeFilterCount" | "onReset">) {
  return (
    <div className="flex min-w-0 flex-col gap-3">
      {children}
      {activeFilterCount > 0 && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="min-h-9 w-fit px-2 text-xs text-primary"
          onClick={onReset}
        >
          Réinitialiser
        </Button>
      )}
    </div>
  );
}

export function LedgerSearchFilter({
  value,
  onValueChange,
  placeholder,
  searchLabel,
  filterLabel,
  activeFilterCount,
  onReset,
  children,
  onClearSearch,
  className,
}: LedgerSearchFilterProps) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    setOpen(false);
  }, [isMobile]);

  const control = (
    <div
      className={cn(
        "flex h-11 min-w-0 w-full items-center rounded-md border border-input bg-card transition-colors focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20 lg:h-9",
        className,
      )}
    >
      <Search className="ml-3 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <Input
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        placeholder={placeholder}
        aria-label={searchLabel}
        className="h-full min-w-0 flex-1 rounded-none border-0 bg-transparent px-2 shadow-none focus-visible:border-transparent focus-visible:ring-0"
      />
      {value && onClearSearch && (
        <button
          type="button"
          onClick={onClearSearch}
          aria-label="Effacer la recherche"
          className="flex size-9 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      )}
      <Button
        ref={filterButtonRef}
        type="button"
        variant="ghost"
        size="icon"
        className={cn(
          "relative h-full w-11 shrink-0 rounded-none border-l border-input text-muted-foreground hover:bg-muted/70 hover:text-foreground focus-visible:z-10 lg:w-10",
          open && "bg-muted text-foreground",
          activeFilterCount > 0 && "text-primary",
        )}
        aria-label={`${filterLabel}${activeFilterCount > 0 ? ` (${activeFilterCount} critères actifs)` : ""}`}
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="dialog"
        title={filterLabel}
        onClick={() => setOpen((current) => !current)}
      >
        <Filter className="size-4" aria-hidden="true" />
        {activeFilterCount > 0 && (
          <span className="absolute right-0 top-0 z-10 flex h-3.5 min-w-3.5 -translate-y-1/3 translate-x-1/3 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold leading-none text-primary-foreground tabular-nums">
            {activeFilterCount}
          </span>
        )}
      </Button>
    </div>
  );

  if (isMobile) {
    return (
      <>
        {control}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent
            side="bottom"
            id={panelId}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              filterButtonRef.current?.focus();
            }}
            className="max-h-[80dvh] gap-0 rounded-t-xl px-0 pb-0"
          >
            <SheetHeader className="px-4 py-3">
              <SheetTitle>Filtres</SheetTitle>
            </SheetHeader>
            <SheetBody className="px-4 py-4">
              {children}
            </SheetBody>
            <SheetFooter className="mt-0 flex-row items-center justify-between gap-2 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
              {activeFilterCount > 0 ? (
                <Button type="button" variant="ghost" size="sm" className="min-h-11" onClick={onReset}>
                  Réinitialiser
                </Button>
              ) : <span />}
              <SheetClose asChild>
                <Button type="button" size="sm" className="h-11 px-4">Terminer</Button>
              </SheetClose>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>{control}</PopoverAnchor>
      <PopoverContent
        id={panelId}
        aria-labelledby={`${panelId}-title`}
        align="start"
        side="bottom"
        sideOffset={6}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          filterButtonRef.current?.focus();
        }}
        className="w-[min(22rem,calc(100vw-2rem))] p-3.5"
      >
        <div className="mb-3 border-b border-border pb-2">
          <h2 id={`${panelId}-title`} className="text-sm font-semibold">Filtres</h2>
        </div>
        <FilterPanel
          activeFilterCount={activeFilterCount}
          onReset={onReset}
        >
          {children}
        </FilterPanel>
      </PopoverContent>
    </Popover>
  );
}
