import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import "./module-banner.css";

export interface LedgerCompactMetric {
  label: string;
  value: ReactNode;
  loading?: boolean;
  tone?: "default" | "success" | "warning" | "destructive";
  kind?: "count" | "detail";
}

/** Bandeau marine épuré des pages de module : repère, titre, action à droite et compteurs sur une ligne. */
export function LedgerCompactHeader({ eyebrow, title, metrics, actions, description, contextLabel, children, titleAs: Title = "h1", titleId, tourTarget = "page-identity", className }: {
  eyebrow: ReactNode;
  title: string;
  metrics: LedgerCompactMetric[];
  actions?: ReactNode;
  description?: ReactNode;
  contextLabel?: string;
  children?: ReactNode;
  titleAs?: "h1" | "h2";
  titleId?: string;
  tourTarget?: string;
  className?: string;
}) {
  return (
    <header data-tour={tourTarget} aria-labelledby={titleId} className={cn("module-banner", className)}>
      <div className="module-banner__top">
        <div className="module-banner__identity">
          <p className="module-banner__eyebrow">{eyebrow}</p>
          <Title id={titleId} className="module-banner__title">{title}</Title>
          {description && <p className="module-banner__description">{description}</p>}
          {contextLabel && <p className="module-banner__context">{contextLabel}</p>}
        </div>
        {actions && <div className="module-banner__actions no-print">{actions}</div>}
      </div>
      {metrics.length > 0 && (
        <dl className="module-banner__metrics">
          {metrics.map((metric) => (
            <div key={metric.label} className={cn("module-banner__metric", `module-banner__metric--${metric.tone ?? "default"}`, metric.kind === "detail" && "module-banner__metric--detail")}>
              <dt>{metric.label}</dt>
              <dd>{metric.loading ? <><span className="sr-only">Chargement</span><Skeleton aria-hidden="true" className="h-5 w-8 bg-primary-foreground/20 motion-reduce:animate-none" /></> : metric.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {children && <div className="module-banner__footer">{children}</div>}
    </header>
  );
}
