import { useEffect, useState, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { TopbarSlot } from "@/components/layout/TopbarSlot";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { LedgerCompactMetric } from "./LedgerCompactHeader";
import "./page-head.css";

/** Vrai quand la fenêtre est assez large pour la barre du haut complète (les boutons d'action y sont rendus à partir de lg). */
function useBarreComplete() {
  const lire = () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(min-width: 1024px)").matches;
  const [complete, setComplete] = useState(lire);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia("(min-width: 1024px)");
    const suivre = () => setComplete(mql.matches);
    suivre();
    mql.addEventListener("change", suivre);
    return () => mql.removeEventListener("change", suivre);
  }, []);
  return complete;
}

const TON = { default: "text-primary", success: "text-success", warning: "text-warning", destructive: "text-destructive" } as const;

/**
 * En-tête commun des pages de module : le titre est celui de la barre du haut (fil d'Ariane), la description et les boutons d'action
 * se placent dans cette barre ; les chiffres forment une rangée discrète en haut de la page (cliquables quand ils filtrent).
 * Sur petit écran, la barre du haut n'a pas de place : les boutons restent dans la page.
 */
export function PageHeaderBar({
  title,
  description,
  metrics = [],
  actions,
  action,
  titleId,
  className,
  actionsSurPetitEcran = true,
}: {
  title: string;
  description?: ReactNode;
  metrics?: LedgerCompactMetric[];
  /** Plusieurs boutons libres ; tous sont rendus en contour dans la barre du haut. */
  actions?: ReactNode;
  /** Bouton principal (or) de la page. */
  action?: { label: string; onClick: () => void };
  titleId?: string;
  className?: string;
  /** Faux : sur petit écran les boutons ne sont pas répétés dans la page (la page a déjà son bouton flottant). */
  actionsSurPetitEcran?: boolean;
}) {
  const barreComplete = useBarreComplete();
  const boutons = actions ?? (action && (
    <button
      data-tour="page-primary-action"
      type="button"
      onClick={action.onClick}
      aria-label={action.label}
      className="flex h-9 items-center gap-2 rounded-lg bg-accent px-3.5 text-[13px] font-semibold text-primary transition-colors hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar"
    >
      <Plus className="size-4" aria-hidden="true" />
      <span className="hidden xl:inline">{action.label}</span>
    </button>
  ));
  return (
    <header className={cn("page-head", className)} aria-labelledby={titleId}>
      <h1 id={titleId} className="sr-only">{title}</h1>
      {description && (
        <TopbarSlot zone="description" sinonSurPlace>
          <span data-tour="page-identity" className="hidden whitespace-nowrap border-l border-white/20 pl-3.5 text-[13px] text-sidebar-muted min-[1700px]:inline">{description}</span>
        </TopbarSlot>
      )}
      {boutons && (barreComplete ? (
        <TopbarSlot zone="actions" sinonSurPlace>
          <div className="page-head-actions page-head-actions--bar no-print">{boutons}</div>
        </TopbarSlot>
      ) : (
        actionsSurPetitEcran && <div className="page-head-actions page-head-actions--inline no-print">{boutons}</div>
      ))}
      {metrics.length > 0 && (
        <dl className="page-head-figs">
          {metrics.map((m) => {
            const interactif = Boolean(m.onSelect);
            return (
              <div
                key={m.label}
                className={cn("page-head-fig", interactif && "page-head-fig--interactive")}
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
              >
                <dt>{m.label}</dt>
                <dd className={cn(TON[m.tone ?? "default"], m.kind === "detail" && "page-head-fig__detail")}>
                  {m.icon && <m.icon className="mr-2 inline size-4 align-[-2px] opacity-70" aria-hidden="true" />}
                  {m.loading ? <><span className="sr-only">Chargement</span><Skeleton aria-hidden="true" className="inline-block h-5 w-8 align-middle motion-reduce:animate-none" /></> : m.value}
                </dd>
              </div>
            );
          })}
        </dl>
      )}
    </header>
  );
}
