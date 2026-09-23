import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface SignatureLedgerMetric {
  label: string;
  value: number;
  tone?: "default" | "success" | "warning" | "destructive";
  loading?: boolean;
}

interface SignatureLedgerBannerProps {
  eyebrow: string;
  title: string;
  description: string;
  metrics: SignatureLedgerMetric[];
  action?: { label: string; onClick: () => void };
  variant?: "registry" | "process";
  titleId?: string;
  className?: string;
}

/** Shared visual grammar only; the page supplies scoped metrics and permissions. */
export function SignatureLedgerBanner({
  eyebrow,
  title,
  description,
  metrics,
  action,
  variant = "registry",
  titleId,
  className,
}: SignatureLedgerBannerProps) {
  return (
    <header
      className={cn("signature-ledger", variant === "process" && "signature-ledger--process", className)}
      aria-labelledby={titleId}
    >
      <div className="signature-ledger__identity">
        <p className="signature-ledger__eyebrow">{eyebrow}</p>
        <h1 id={titleId} className="signature-ledger__title">{title}</h1>
        <p className="signature-ledger__description">{description}</p>
      </div>

      <div className="signature-ledger__signature">
        <span className="signature-ledger__registration" aria-hidden="true">
          <i /><i /><i /><i />
        </span>
        {action && (
          <Button
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

      <dl className="signature-ledger__metrics">
        {metrics.map(({ label, value, tone = "default", loading }) => (
          <div className={cn("signature-ledger__metric", `signature-ledger__metric--${tone}`)} key={label}>
            <dt>{label}</dt>
            <dd>
              {loading ? <Skeleton className="h-5 w-8 bg-primary-foreground/15" /> : value}
            </dd>
          </div>
        ))}
      </dl>
    </header>
  );
}
