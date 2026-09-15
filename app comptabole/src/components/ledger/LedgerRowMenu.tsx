import type { RowAction } from "@/components/common/RowActions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/**
 * Menu « ⋯ » pour les actions secondaires/destructrices d'une ligne de
 * tableau dense. L'action principale (la plus fréquente) reste un clic
 * direct sur la ligne, jamais cachée ici — n'utiliser ce menu que pour les
 * lignes à 3 actions ou plus ; en dessous, garder des icônes directes (voir
 * DESIGN-SYSTEM.md §4).
 */
export function LedgerRowMenu({ actions }: { actions: RowAction[] }) {
  if (actions.length === 0) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          aria-label="Actions"
          className="flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-accent/10 hover:text-primary"
        >
          <span className="flex flex-col items-center gap-[2.5px]">
            <span className="h-[3px] w-[3px] rounded-full bg-current" />
            <span className="h-[3px] w-[3px] rounded-full bg-current" />
            <span className="h-[3px] w-[3px] rounded-full bg-current" />
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-44 rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {actions.map((action, i) => (
          <div key={action.label}>
            {action.destructive && i > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem
              onClick={action.onClick}
              className={cn(
                action.destructive && "text-destructive focus:text-destructive",
              )}
            >
              <action.icon className="h-4 w-4" />
              {action.label}
            </DropdownMenuItem>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
