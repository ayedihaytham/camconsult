// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { TourProvider, usePageTour } from "./TourProvider";

vi.mock("@/store/auth", () => ({
  useAuth: (select: (state: { session: { employeId: string } }) => unknown) => select({ session: { employeId: "tour-test" } }),
}));

function Harness() {
  const { start } = usePageTour();
  return <>
    <button onClick={(event) => start(event.currentTarget)}>Relancer</button>
    <div data-tour="page-workspace">Tableau de bord</div>
    <div data-tour="dashboard-summary">Bandeau du bureau</div>
  </>;
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  HTMLElement.prototype.scrollIntoView = vi.fn();
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue({ length: 1 } as DOMRectList);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("guided tour lifecycle", () => {
  it("offers a first visit once, skips absent targets, and remains replayable", async () => {
    render(<MemoryRouter><TourProvider><Harness /></TourProvider></MemoryRouter>);
    expect(await screen.findByText("Découvrir cette page")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Lancer la visite" }));
    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Votre tableau de bord")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Suivant" }));
    await waitFor(() => expect(screen.getByText("Repérer l’essentiel")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Terminer" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(localStorage.getItem("camconsult:visite-guidee:tour-test:dashboard:v3")).toBe("done");
    expect(screen.queryByText("Découvrir cette page")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Relancer" }));
    expect(await screen.findByRole("dialog")).toBeTruthy();
  });

  it("closes on Escape without invoking the highlighted control", async () => {
    const action = vi.fn();
    render(<MemoryRouter><TourProvider><Harness /><button onClick={action}>Action sensible</button></TourProvider></MemoryRouter>);
    const trigger = await screen.findByRole("button", { name: "Relancer" });
    trigger.focus();
    fireEvent.click(trigger);
    expect(await screen.findByRole("dialog")).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(action).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(trigger);
  });
});
