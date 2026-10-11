import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface LedgerCompactMetric {
  label: string;
  value: number | string;
  loading?: boolean;
}

/** Bandeau marine épuré des pages de module : repère, titre, action à droite et compteurs sur une ligne. */
export function LedgerCompactHeader({ eyebrow, title, metrics, actions, className }: {
  eyebrow: string;
  title: string;
  metrics: LedgerCompactMetric[];
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("rounded-lg bg-primary px-5 pt-4 text-primary-foreground", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-accent">{eyebrow}</p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight">{title}</h1>
        </div>
        {actions}
      </div>
      {metrics.length > 0 && (
        <dl className="mt-3 flex flex-wrap border-t border-primary-foreground/15">
          {metrics.map((metric, index) => (
            <div key={metric.label} className={cn("flex items-baseline gap-2 py-3 pr-5", index > 0 && "border-l border-primary-foreground/15 pl-5")}>
              <dd className="font-serif text-xl font-bold tabular-nums">{metric.loading ? "…" : metric.value}</dd>
              <dt className="text-[11px] font-bold uppercase tracking-[0.09em]">{metric.label}</dt>
            </div>
          ))}
        </dl>
      )}
    </header>
  );
}
