import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface FinancialIdentityHeaderProps {
  eyebrow: string;
  title: string;
  description: string;
  monogram?: string;
  details?: { label: string; value: ReactNode }[];
  actions?: ReactNode;
  variant?: "default" | "dossier";
  className?: string;
}

/** Compact navy identity surface shared by the financial register and dossier. */
export function FinancialIdentityHeader({
  eyebrow,
  title,
  description,
  monogram,
  details = [],
  actions,
  variant = "default",
  className,
}: FinancialIdentityHeaderProps) {
  if (variant === "dossier") {
    return (
      <header className={cn("border border-primary/15 bg-primary text-primary-foreground", className)}>
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-4 px-4 py-3 sm:min-h-[76px] sm:gap-y-3 sm:px-[18px]">
          <div className="flex min-w-0 items-center gap-3">
            {monogram && (
              <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center border border-primary-foreground/25 bg-primary-foreground/10 font-mono text-xs font-semibold tracking-wide">
                {monogram}
              </span>
            )}
            <div className="min-w-0">
              <p className="sr-only">{eyebrow}</p>
              <h2 className="truncate text-lg font-semibold leading-tight tracking-tight">{title}</h2>
              <p className="sr-only">{description}</p>
              {details.length > 0 && (
                <p className="mt-1 truncate text-[0.7rem] text-primary-foreground/75">
                  {details.map(({ label, value }, index) => (
                    <span key={label}>{index > 0 && <span aria-hidden="true"> · </span>}{label} {value || "—"}</span>
                  ))}
                </p>
              )}
            </div>
          </div>
          {actions && <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto">{actions}</div>}
        </div>
      </header>
    );
  }

  return (
    <header
      className={cn(
        "overflow-hidden border border-primary/15 bg-primary text-primary-foreground",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-4 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          {monogram && (
            <span
              aria-hidden="true"
              className="grid size-10 shrink-0 place-items-center border border-primary-foreground/25 bg-primary-foreground/10 font-mono text-sm font-semibold tracking-wide text-primary-foreground"
            >
              {monogram}
            </span>
          )}
          <div className="min-w-0">
            <p className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-accent">
              {eyebrow}
            </p>
            <h2 className="truncate text-lg font-semibold leading-tight tracking-tight sm:text-xl">
              {title}
            </h2>
            <p className="mt-0.5 text-xs text-primary-foreground/75">{description}</p>
          </div>
        </div>

        {details.length > 0 && (
          <dl className="grid min-w-0 grid-cols-2 gap-x-5 gap-y-1 border-t border-primary-foreground/15 pt-2 text-xs sm:ml-4 sm:grid-cols-none sm:grid-flow-col sm:gap-x-6 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
            {details.map(({ label, value }) => (
              <div key={label} className="min-w-0">
                <dt className="text-[0.62rem] uppercase tracking-wide text-primary-foreground/60">
                  {label}
                </dt>
                <dd className="truncate font-medium text-primary-foreground">{value || "—"}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
      <div aria-hidden="true" className="h-px bg-accent/90" />
    </header>
  );
}
