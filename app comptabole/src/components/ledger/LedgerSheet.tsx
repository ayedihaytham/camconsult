import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * « Feuille » — conteneur de carte générique (coins arrondis, ombre douce),
 * se détache du canevas gris-ardoise (bg-muted, posé par AppLayout) plutôt
 * que d'un fond blanc identique. `overflow-hidden` pour que le contenu
 * (en-têtes de LedgerTable, bandeaux colorés…) respecte les coins arrondis.
 */
export function LedgerSheet({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-border bg-card shadow-card",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function LedgerSheetHeader({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border px-[18px] py-3.5">
      <h2 className="text-[0.86rem] font-bold text-foreground">{title}</h2>
      {action}
    </div>
  );
}

export function LedgerSheetLink({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-xs font-bold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground hover:underline"
    >
      {children}
    </button>
  );
}
