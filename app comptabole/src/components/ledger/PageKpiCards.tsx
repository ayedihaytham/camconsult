import { cn } from "@/lib/utils";
import { SqueletteOr } from "./Chargement";
import type { LedgerCompactMetric } from "./LedgerCompactHeader";

const TON = { default: "text-primary", success: "text-[#246549]", warning: "text-[#8a5a0b]", destructive: "text-destructive" } as const;

/** Cartes de chiffres sous l'en-tête de page (maquette : Facturé, Encaissé, Impayé, À signer) ; cliquables quand elles filtrent. */
export function PageKpiCards({ metrics, className }: { metrics: LedgerCompactMetric[]; className?: string }) {
  if (metrics.length === 0) return null;
  return (
    <dl className={cn("mb-3 grid grid-cols-2 gap-2 sm:mb-4 sm:gap-3 lg:grid-cols-[repeat(auto-fit,minmax(11rem,1fr))]", className)}>
      {metrics.map((m) => {
        const interactif = Boolean(m.onSelect);
        return (
          <div
            key={m.label}
            {...(interactif
              ? {
                  role: "button",
                  tabIndex: 0,
                  "aria-pressed": Boolean(m.active),
                  onClick: m.onSelect,
                  onKeyDown: (e: React.KeyboardEvent) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      m.onSelect?.();
                    }
                  },
                }
              : {})}
            className={cn(
              "flex flex-col gap-1.5 rounded-[14px] border border-primary/10 bg-card px-3 py-2.5 sm:px-4 sm:py-3.5 shadow-[0_1px_2px_hsl(var(--primary)/0.05),0_12px_32px_-18px_hsl(var(--primary)/0.18)]",
              interactif && "cursor-pointer transition-colors hover:bg-[#F5F8FD] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              m.active && "ring-2 ring-[#C9A96A]",
            )}
          >
            <dt className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{m.label}</dt>
            <dd className={cn("m-0 font-display text-[1.3rem] font-extrabold sm:text-[1.7rem] leading-none tracking-tight tabular-nums", TON[m.tone ?? "default"])}>
              {m.loading ? <><span className="sr-only">Chargement</span><SqueletteOr className="inline-block h-6 w-16" /></> : m.value}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
