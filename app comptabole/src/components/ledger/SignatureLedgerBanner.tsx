import type { ReactNode } from "react";
import { Plus, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LedgerCompactHeader } from "./LedgerCompactHeader";

export interface SignatureLedgerMetric {
  label: string;
  value: number | string;
  tone?: "default" | "success" | "warning" | "destructive";
  loading?: boolean;
  /** Icône affichée avant le chiffre. */
  icon?: LucideIcon;
  /** Compteur-filtre cliquable. */
  onSelect?: () => void;
  active?: boolean;
}

interface SignatureLedgerBannerProps {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  description: string;
  metrics: SignatureLedgerMetric[];
  contextLabel?: string;
  action?: { label: string; onClick: () => void };
  /** Plusieurs actions libres (ex. Excel + Nouveau mouvement) à la place de `action`. */
  actions?: ReactNode;
  variant?: "registry" | "process" | "compact";
  titleId?: string;
  className?: string;
}

/** Shared visual grammar only; the page supplies scoped metrics and permissions. */
export function SignatureLedgerBanner({
  eyebrow,
  title,
  description,
  metrics,
  contextLabel,
  action,
  actions,
  variant = "registry",
  titleId,
  className,
}: SignatureLedgerBannerProps) {
  return (
    <LedgerCompactHeader
      className={cn(
        "signature-ledger",
        variant === "process" && "signature-ledger--process",
        variant === "compact" && "signature-ledger--compact",
        className,
      )}
      titleId={titleId}
      eyebrow={eyebrow}
      title={title}
      description={description}
      contextLabel={contextLabel}
      metrics={variant === "compact" ? [] : metrics}
      actions={actions ?? (action && (
          <Button
            data-tour="page-primary-action"
            type="button"
            variant="outline"
            size="sm"
            className="module-banner__create"
            onClick={action.onClick}
          >
            <Plus className="size-4" aria-hidden="true" />
            {action.label}
          </Button>
        ))}
    />
  );
}
