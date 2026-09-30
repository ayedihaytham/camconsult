import { Plus, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ModuleBannerTitle } from "./ModuleBannerTitle";

export interface SignatureLedgerMetric {
  label: string;
  value: number;
  tone?: "default" | "success" | "warning" | "destructive";
  loading?: boolean;
}

interface SignatureLedgerBannerProps {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  description: string;
  metrics: SignatureLedgerMetric[];
  contextLabel?: string;
  action?: { label: string; onClick: () => void };
  variant?: "registry" | "process" | "compact";
  titleId?: string;
  className?: string;
}

/** Shared visual grammar only; the page supplies scoped metrics and permissions. */
export function SignatureLedgerBanner({
  icon,
  eyebrow,
  title,
  description,
  metrics,
  contextLabel,
  action,
  variant = "registry",
  titleId,
  className,
}: SignatureLedgerBannerProps) {
  return (
    <header
      data-tour="page-identity"
      className={cn(
        "signature-ledger",
        variant === "process" && "signature-ledger--process",
        variant === "compact" && "signature-ledger--compact",
        className,
      )}
      aria-labelledby={titleId}
    >
      <div className="signature-ledger__identity">
        <p className="signature-ledger__eyebrow">{eyebrow}</p>
        <ModuleBannerTitle
          id={titleId}
          icon={icon}
          className="signature-ledger__title"
        >
          {title}
        </ModuleBannerTitle>
        <p className="signature-ledger__description">{description}</p>
      </div>

      <div className="signature-ledger__signature">
        <span className="signature-ledger__registration" aria-hidden="true">
          <i /><i /><i /><i />
        </span>
        {variant === "compact" && contextLabel && (
          <span className="signature-ledger__compact-context">{contextLabel}</span>
        )}
        {action && (
          <Button
            data-tour="page-primary-action"
            type="button"
            variant="outline"
            size="sm"
            className="signature-ledger__action"
            onClick={action.onClick}
          >
            <Plus className="size-4" aria-hidden="true" />
            {action.label}
          </Button>
        )}
      </div>

      {variant !== "compact" && (metrics.length > 0 || contextLabel) && (
        <dl className="signature-ledger__metrics">
          {metrics.map(({ label, value, tone = "default", loading }) => (
            <div className={cn("signature-ledger__metric", `signature-ledger__metric--${tone}`)} key={label}>
              <dt>{label}</dt>
              <dd>
                {loading ? <Skeleton className="h-5 w-8 bg-primary-foreground/15" /> : value}
              </dd>
            </div>
          ))}
          {contextLabel && (
            <div className="signature-ledger__context">
              <dt className="sr-only">Portée</dt>
              <dd>{contextLabel}</dd>
            </div>
          )}
        </dl>
      )}
    </header>
  );
}
