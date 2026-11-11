import type { RowAction } from "@/components/common/RowActions";
import { cn } from "@/lib/utils";
import { LedgerRowMenu } from "./LedgerRowMenu";

/**
 * Actions d'une ligne de tableau (maquette) : une icône-bouton par action, à droite de la ligne, avec son nom en infobulle et pour les lecteurs d'écran.
 * Sur petit écran, où les icônes ne tiennent pas, le menu « ⋯ » reprend les mêmes actions.
 */
export function LedgerRowIcons({ actions }: { actions: RowAction[] }) {
  if (actions.length === 0) return null;
  return (
    <>
      <div className="hidden items-center justify-end gap-0.5 lg:flex" role="group" aria-label="Actions de la ligne">
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            title={action.label}
            aria-label={action.label}
            onClick={(event) => {
              event.stopPropagation();
              action.onClick();
            }}
            className={cn(
              "flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              action.destructive && "hover:bg-destructive/10 hover:text-destructive",
            )}
          >
            <action.icon className="size-4" aria-hidden="true" />
          </button>
        ))}
      </div>
      <div className="lg:hidden">
        <LedgerRowMenu actions={actions} />
      </div>
    </>
  );
}
