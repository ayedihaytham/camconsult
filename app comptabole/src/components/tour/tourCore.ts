import type { Session } from "@/store/auth";
import type { Tour, TourStep } from "./tourRegistry";

export function tourStorageKey(tour: Tour, session: Session | null) {
  const account = session?.employeId ?? "admin:principal";
  return `camconsult:visite-guidee:${encodeURIComponent(account)}:${tour.id}:v${tour.version}`;
}

export function visibleTourTarget(
  step: TourStep,
  mobile: boolean,
  root: ParentNode = document,
): HTMLElement | null {
  const name =
    typeof step.target === "string"
      ? step.target
      : mobile
        ? step.target.mobile
        : step.target.desktop;
  if (!name) return null;
  const matches = root.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`);
  return (
    Array.from(matches).find((node) => {
      if (node.getClientRects().length === 0) return false;
      const style = getComputedStyle(node);
      return style.display !== "none" && style.visibility !== "hidden";
    }) ?? null
  );
}

export function nextAvailableStep(
  steps: TourStep[],
  start: number,
  mobile: boolean,
  direction: 1 | -1,
  root: ParentNode = document,
) {
  for (
    let index = start;
    index >= 0 && index < steps.length;
    index += direction
  ) {
    const target = visibleTourTarget(steps[index], mobile, root);
    if (target) return { index, target };
  }
  return null;
}
