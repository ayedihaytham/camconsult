import { CircleHelp } from "lucide-react";
import { useRef } from "react";
import { usePageTour } from "./TourProvider";

export function TourHelpButton({
  placement = "desktop-fab",
}: {
  placement?: "topbar" | "desktop-fab";
}) {
  const { tour, contextTour, start, startContext } = usePageTour();
  const triggerRef = useRef<HTMLButtonElement>(null);
  if (!tour) return null;

  return (
    <button
      ref={triggerRef}
      type="button"
      aria-label={`Aide · ${tour.title}`}
      title="Aide"
      onClick={() => {
        if (contextTour) startContext(triggerRef.current);
        else start(triggerRef.current);
      }}
      className={
        placement === "topbar"
          ? "flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-lg px-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
          : "fixed right-4 bottom-4 z-40 hidden h-12 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground shadow-lg transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 lg:flex"
      }
    >
      <span>Aide</span>
      <CircleHelp className="size-5" aria-hidden="true" />
    </button>
  );
}
