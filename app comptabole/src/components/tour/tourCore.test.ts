// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { nextAvailableStep, tourStorageKey, visibleTourTarget } from "./tourCore";
import type { Tour } from "./tourRegistry";
import type { Session } from "@/store/auth";

const tour: Tour = { id: "grille-affectat", version: 2, title: "Grille", steps: [] };

afterEach(() => { document.body.innerHTML = ""; });

describe("shared guided tour targeting", () => {
  it("isolates completion by account, tour, and version", () => {
    const employee = { employeId: "emp-1" } as Session;
    expect(tourStorageKey(tour, employee)).toBe("camconsult:visite-guidee:emp-1:grille-affectat:v2");
    expect(tourStorageKey({ ...tour, version: 3 }, employee)).not.toBe(tourStorageKey(tour, employee));
    expect(tourStorageKey(tour, { employeId: "emp-2" } as Session)).not.toBe(tourStorageKey(tour, employee));
    expect(tourStorageKey(tour, { employeId: null, nom: "Cabinet" } as Session)).toContain("admin%3Aprincipal");
  });

  it("chooses visible responsive anchors and skips missing steps", () => {
    const desktop = document.createElement("div");
    desktop.dataset.tour = "desktop";
    desktop.getClientRects = () => ({ length: 1 } as DOMRectList);
    const mobile = document.createElement("div");
    mobile.dataset.tour = "mobile";
    mobile.getClientRects = () => ({ length: 1 } as DOMRectList);
    document.body.append(desktop, mobile);
    const steps = [
      { target: "missing", title: "Absent", body: "" },
      { target: { desktop: "desktop", mobile: "mobile" }, title: "Visible", body: "" },
    ];
    expect(visibleTourTarget(steps[1], false)).toBe(desktop);
    expect(visibleTourTarget(steps[1], true)).toBe(mobile);
    expect(nextAvailableStep(steps, 0, true, 1)?.index).toBe(1);
    mobile.style.display = "none";
    expect(nextAvailableStep(steps, 0, true, 1)).toBeNull();
  });
});
