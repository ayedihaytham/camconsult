import type { ComponentProps, ReactNode } from "react";
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
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      {...props}
      className={cn(
        "overflow-hidden rounded-[14px] border border-primary/10 bg-card shadow-[0_1px_2px_hsl(var(--primary)/0.05),0_12px_32px_-18px_hsl(var(--primary)/0.18)]",
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
    <div className="flex items-baseline justify-between gap-3 border-b border-primary/10 px-[18px] py-3.5">
      <h2 className="font-display text-[0.95rem] font-extrabold text-primary">{title}</h2>
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
      className="text-xs font-bold text-primary underline underline-offset-2 transition-colors hover:text-primary/80"
    >
      {children}
    </button>
  );
}
