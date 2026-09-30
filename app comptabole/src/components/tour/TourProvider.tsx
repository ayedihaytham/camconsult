import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useLocation } from "react-router-dom";
import { HelpCircle } from "lucide-react";
import { safeLocalStorage } from "@/lib/safeStorage";
import { useAuth } from "@/store/auth";
import { getPageTour, type Tour } from "./tourRegistry";
import {
  nextAvailableStep,
  tourStorageKey,
  visibleTourTarget,
} from "./tourCore";

type TourContextValue = {
  tour: Tour | null;
  contextTour: Tour | null;
  setContextTour: (tour: Tour | null) => void;
  start: (trigger?: HTMLElement | null) => void;
  startContext: (trigger?: HTMLElement | null) => void;
};

const TourContext = createContext<TourContextValue | null>(null);
const NO_TOUR: TourContextValue = { tour: null, contextTour: null, setContextTour: () => {}, start: () => {}, startContext: () => {} };

export function usePageTour() {
  return useContext(TourContext) ?? NO_TOUR;
}

function useMobileTour() {
  const [mobile, setMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 1024,
  );
  useEffect(() => {
    const update = () => setMobile(window.innerWidth < 1024);
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return mobile;
}

export function TourProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const session = useAuth((state) => state.session);
  const mobile = useMobileTour();
  const tour = useMemo(
    () => getPageTour(pathname, session),
    [pathname, session],
  );
  const storageKey = tour ? tourStorageKey(tour, session) : null;
  const [invitation, setInvitation] = useState(false);
  const [contextTour, setContextTour] = useState<Tour | null>(null);
  const [activeTour, setActiveTour] = useState<Tour | null>(null);
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setOpen(false);
    setActiveTour(null);
    setStepIndex(0);
    setRect(null);
    setInvitation(
      Boolean(storageKey && safeLocalStorage.getItem(storageKey) !== "done"),
    );
  }, [storageKey, pathname]);

  const dismissInvitation = useCallback(() => {
    if (storageKey) safeLocalStorage.setItem(storageKey, "done");
    setInvitation(false);
  }, [storageKey]);

  const close = useCallback(() => {
    setOpen(false);
    setRect(null);
    if (activeTour) safeLocalStorage.setItem(tourStorageKey(activeTour, session), "done");
    setInvitation(Boolean(storageKey && activeTour?.id !== tour?.id && safeLocalStorage.getItem(storageKey) !== "done"));
    setActiveTour(null);
  }, [activeTour, session, storageKey, tour]);

  const start = useCallback(
    (trigger?: HTMLElement | null) => {
      if (!tour) return;
      returnFocus.current =
        trigger ??
        (document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null);
      setInvitation(false);
      setActiveTour(tour);
      setStepIndex(0);
      setOpen(true);
    },
    [tour],
  );

  const startContext = useCallback((trigger?: HTMLElement | null) => {
    if (!contextTour) return;
    returnFocus.current = trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    setInvitation(false);
    setActiveTour(contextTour);
    setStepIndex(0);
    setOpen(true);
  }, [contextTour]);

  const step = activeTour?.steps[stepIndex];

  useEffect(() => {
    if (!open || !activeTour) return;
    const match = nextAvailableStep(activeTour.steps, stepIndex, mobile, 1);
    if (!match) {
      close();
      return;
    }
    if (match.index !== stepIndex) {
      setStepIndex(match.index);
      return;
    }
    const reducedMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches ?? false;
    match.target.scrollIntoView({
      block: "center",
      behavior: reducedMotion ? "instant" : "smooth",
    });
    const update = () => {
      if (!visibleTourTarget(activeTour.steps[match.index], mobile)) {
        setStepIndex((current) => current + 1);
        return;
      }
      const nextRect = match.target.getBoundingClientRect();
      setRect((previous) => previous && previous.left === nextRect.left && previous.top === nextRect.top && previous.width === nextRect.width && previous.height === nextRect.height ? previous : nextRect);
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    resizeObserver?.observe(match.target);
    const mutationObserver = new MutationObserver(update);
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["hidden", "style", "class"],
    });
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      resizeObserver?.disconnect();
      mutationObserver.disconnect();
    };
  }, [open, activeTour, stepIndex, mobile, close]);

  const move = (direction: 1 | -1) => {
    if (!activeTour) return;
    const match = nextAvailableStep(
      activeTour.steps,
      stepIndex + direction,
      mobile,
      direction,
    );
    if (match) setStepIndex(match.index);
    else if (direction === 1) close();
  };

  const viewportWidth =
    typeof window === "undefined" ? 1024 : window.innerWidth;
  const viewportHeight =
    typeof window === "undefined" ? 768 : window.innerHeight;
  const cardWidth = Math.min(360, viewportWidth - 32);
  const cardLeft = rect
    ? Math.max(16, Math.min(rect.left, viewportWidth - cardWidth - 16))
    : 16;
  const cardTop = rect
    ? rect.bottom < viewportHeight * 0.55
      ? Math.max(16, Math.min(viewportHeight - 230, rect.bottom + 14))
      : Math.max(16, rect.top - 210)
    : 16;

  return (
    <TourContext.Provider value={{ tour, contextTour, setContextTour, start, startContext }}>
      {children}
      {tour && invitation && !open && (
        <aside
          className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] right-3 z-40 w-[min(22rem,calc(100vw-1.5rem))] rounded-lg border border-border bg-card p-3 shadow-pop"
          aria-label="Découvrir cette page"
        >
          <div className="flex items-start gap-2">
            <HelpCircle
              className="mt-0.5 size-4 shrink-0 text-primary"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold">Découvrir cette page</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Une courte visite vous montre les commandes utiles.
              </p>
            </div>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              className="min-h-11 rounded px-3 text-xs text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={dismissInvitation}
            >
              Plus tard
            </button>
            <button
              type="button"
              className="min-h-11 rounded bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={(event) => start(event.currentTarget)}
            >
              Lancer la visite
            </button>
          </div>
        </aside>
      )}
      <DialogPrimitive.Root
        open={open}
        onOpenChange={(next) => {
          if (!next) close();
        }}
      >
        {open && activeTour && step && rect && (
          <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay
              className="fixed inset-0 z-50"
              onPointerDown={(event) => event.preventDefault()}
            >
              <span
                className="pointer-events-none absolute rounded-md border-2 border-accent"
                aria-hidden="true"
                style={{
                  left: Math.max(0, rect.left - 4),
                  top: Math.max(0, rect.top - 4),
                  width: rect.width + 8,
                  height: rect.height + 8,
                  boxShadow: "0 0 0 200vmax hsl(var(--primary) / 0.62)",
                }}
              />
            </DialogPrimitive.Overlay>
            <DialogPrimitive.Content
              className="fixed z-[60] max-h-[calc(100dvh-2rem)] w-[min(22.5rem,calc(100vw-2rem))] overflow-y-auto rounded-lg border border-border bg-card p-4 text-foreground shadow-pop focus:outline-none max-lg:bottom-[calc(1rem+env(safe-area-inset-bottom,0px))]"
              style={
                mobile
                  ? { left: 16 }
                  : { left: cardLeft, top: cardTop, width: cardWidth }
              }
              aria-describedby="tour-description"
              onCloseAutoFocus={(event) => {
                event.preventDefault();
                returnFocus.current?.focus();
              }}
            >
              <p
                className="text-[11px] font-semibold uppercase tracking-[0.08em] text-primary"
                aria-live="polite"
              >
                Étape {stepIndex + 1} sur {activeTour.steps.length}
              </p>
              <DialogPrimitive.Title className="mt-1 text-base font-semibold">
                {step.title}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description
                id="tour-description"
                className="mt-1.5 text-sm leading-relaxed text-muted-foreground"
              >
                {step.body}
              </DialogPrimitive.Description>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  className="min-h-11 rounded px-2 text-xs text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={close}
                >
                  Quitter
                </button>
                <div className="flex gap-2">
                  {stepIndex > 0 && (
                    <button
                      type="button"
                      className="min-h-11 rounded border border-input px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => move(-1)}
                    >
                      Précédent
                    </button>
                  )}
                  <button
                    type="button"
                    className="min-h-11 rounded bg-primary px-3 text-sm font-medium text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => move(1)}
                  >
                    {nextAvailableStep(activeTour.steps, stepIndex + 1, mobile, 1)
                      ? "Suivant"
                      : "Terminer"}
                  </button>
                </div>
              </div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        )}
      </DialogPrimitive.Root>
    </TourContext.Provider>
  );
}
