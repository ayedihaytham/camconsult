// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { DeadlineCalendar } from "./DeadlineCalendar";
import { DeadlinesTab } from "../tabs/DeadlinesTab";
import { buildDashboardData } from "@/lib/dashboard/dashboardData";
import { collection, dashboardInput } from "@/lib/dashboard/dashboardFixtures.test-support";

afterEach(cleanup);
const now = new Date(2026, 9, 11, 10);
const deadlines = buildDashboardData(dashboardInput({ now, collectes: [collection("late", "2026-10-10"), collection("today", "2026-10-11"), collection("another", "2026-10-11"), collection("later", "2026-11-04"), collection("closed", "2026-10-11", "valide")] })).deadlines;
const day = (label: string) => screen.getByRole("button", { name: label });

describe("calendrier des échéances", () => {
  it("affiche le mois et les collectes de la date sélectionnée, hors dossiers validés", () => {
    render(<MemoryRouter><DeadlineCalendar deadlines={deadlines} now={now} /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "octobre 2026" })).toBeTruthy();
    const today = day("dimanche 11 octobre 2026, 2 échéances");
    expect(today.getAttribute("aria-current")).toBe("date");
    expect(today.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(["/collectes/today", "/collectes/another"]);
    fireEvent.click(day("samedi 10 octobre 2026, 1 échéance"));
    expect(screen.getByRole("link").getAttribute("href")).toBe("/collectes/late");
  });

  it("change de mois et permet de revenir à aujourd'hui ou à une date en retard", () => {
    render(<MemoryRouter><DeadlineCalendar deadlines={deadlines} now={now} /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Mois suivant" }));
    expect(screen.getByRole("heading", { name: "novembre 2026" })).toBeTruthy();
    fireEvent.click(day("mercredi 4 novembre 2026, 1 échéance"));
    expect(screen.getByRole("link").getAttribute("href")).toBe("/collectes/later");
    fireEvent.click(screen.getByRole("button", { name: "Aujourd’hui" }));
    expect(day("dimanche 11 octobre 2026, 2 échéances").getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "1 échéance en retard" }));
    expect(screen.getByRole("link").getAttribute("href")).toBe("/collectes/late");
  });

  it("déplace la sélection et le focus au clavier, y compris entre deux mois", () => {
    render(<MemoryRouter><DeadlineCalendar deadlines={deadlines} now={new Date(2026, 9, 31)} /></MemoryRouter>);
    const selected = day("samedi 31 octobre 2026, 0 échéance");
    fireEvent.keyDown(selected, { key: "ArrowRight" });
    const next = day("dimanche 1 novembre 2026, 0 échéance");
    expect(next.getAttribute("aria-pressed")).toBe("true");
    expect(document.activeElement).toBe(next);
    expect(within(screen.getByRole("group", { name: "Calendrier des échéances" })).getAllByRole("button").filter((button) => button.tabIndex === 0)).toHaveLength(1);
  });

  it("n'affiche pas de faux calendrier vide quand la source est indisponible", () => {
    const onRetry = vi.fn();
    render(<MemoryRouter><DeadlinesTab deadlines={deadlines} now={now} calendar loading={false} error onRetry={onRetry} /></MemoryRouter>);
    expect(screen.queryByRole("group", { name: "Calendrier des échéances" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
