import { CircleHelp } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { usePageTour } from "./TourProvider";

/** Aide de la barre du haut : une icône, et — tant que la visite de la page n'a pas été vue — une bulle ancrée dessous (rien ne se pose sur le contenu). */
export function TourHelpButton() {
  const { tour, contextTour, invitation, dismissInvitation, start, startContext } = usePageTour();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [bubble, setBubble] = useState(invitation);
  useEffect(() => setBubble(invitation), [invitation]);
  if (!tour) return null;

  function lancer() {
    setBubble(false);
    if (contextTour) startContext(triggerRef.current);
    else start(triggerRef.current);
  }

  return (
    <Popover open={bubble && invitation} onOpenChange={setBubble}>
      <PopoverAnchor asChild>
        <button
          ref={triggerRef}
          type="button"
          aria-label={`Aide · ${tour.title}`}
          aria-expanded={invitation ? bubble : undefined}
          title="Aide"
          onClick={() => (invitation ? setBubble((open) => !open) : lancer())}
          className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-white/20 bg-white/5 text-sidebar-foreground/90 transition-colors hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar"
        >
          <CircleHelp className="h-[18px] w-[18px]" aria-hidden="true" />
          {invitation && <span className="absolute -right-0.5 -top-0.5 size-[9px] rounded-full bg-accent ring-2 ring-sidebar motion-safe:animate-pulse" aria-hidden="true" />}
        </button>
      </PopoverAnchor>
      <PopoverContent align="end" sideOffset={12} aria-label="Découvrir cette page" className="w-[272px] rounded-xl border-0 bg-card p-4 shadow-[0_18px_40px_-12px_hsl(var(--primary)/0.45),0_0_0_1px_hsl(var(--primary)/0.08)]">
        <p className="text-sm font-semibold text-primary">Découvrir cette page</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Une courte visite vous montre les commandes utiles.</p>
        <div className="mt-3 flex items-center gap-1.5">
          <button
            type="button"
            className="min-h-9 rounded-lg bg-primary px-3.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={lancer}
          >
            Lancer la visite
          </button>
          <button
            type="button"
            className="min-h-9 rounded-lg px-2.5 text-xs text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={dismissInvitation}
          >
            Plus tard
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
