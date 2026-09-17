import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface LedgerPageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  breadcrumb?: ReactNode;
  className?: string;
}

/** Même rôle que PageHeader (titre + description + actions), typographie Ledger. */
export function LedgerPageHeader({
  title,
  description,
  actions,
  breadcrumb,
  className,
}: LedgerPageHeaderProps) {
  return (
    <div className={cn("mb-1.5 space-y-2.5", className)}>
      {breadcrumb}
      {/* Titre/description masqués visuellement (déjà affichés dans la
          topbar) — gardés en sr-only pour l'accessibilité (contour de
          document, lecteurs d'écran) plutôt que supprimés du DOM. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="sr-only">{title}</h1>
          {description && <p className="sr-only">{description}</p>}
        </div>
        {actions && (
          <div className="flex flex-shrink-0 flex-wrap items-center gap-2 no-print">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
