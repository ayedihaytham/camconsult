// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AdminOverviewTab } from "./tabs/AdminOverviewTab";
import { TasksTab } from "./tabs/TasksTab";
import { DashboardTabs } from "./DashboardTabs";
import { buildDashboardData } from "@/lib/dashboard/dashboardData";
import { collection, dashboardInput, NOW, session, task } from "@/lib/dashboard/dashboardFixtures.test-support";
import { getPageTour } from "@/components/tour/tourRegistry";
vi.mock("@/hooks/use-media-query", () => ({ useMediaQuery: () => false }));

afterEach(cleanup);
const input = dashboardInput({ collectes: [collection("review", "2026-10-01", "transmis"), collection("overdue", "2026-09-29")], taches: Array.from({ length: 7 }, (_, i) => task(`task-${i}`, i === 6 ? "termine" : i > 2 ? "a_faire" : "en_cours")) });
const data = buildDashboardData(input);
const props = { data, now: NOW, canUseMessaging: true, collectesLoading: false, collectesError: false, onRetryCollectes: () => {}, adminDataLoading: false, adminDataError: false, onRetryAdminData: () => {} };

describe("Admin Dashboard briefing", () => {
  it("shows the fused summary: indicators, portfolio, review register and week, without the former registers or tab rail", () => {
    const { container } = render(<MemoryRouter><DashboardTabs {...props} /></MemoryRouter>);
    for (const name of ["Synthèse", "Portefeuille clients", "Échéancier"]) expect(screen.getByRole("tab", { name: new RegExp(`^${name}`) })).toBeTruthy();
    expect(container.querySelectorAll(".ve-chemise")).toHaveLength(4);
    expect(container.querySelector('[data-tour="dashboard-portefeuille"]')).toBeTruthy();
    expect(container.querySelector('[data-tour="dashboard-triage"]')).toBeTruthy();
    expect(container.querySelector('[data-tour="dashboard-deadline-strip"]')).toBeTruthy();
    expect(container.querySelector(".bureau-verdict")).toBeNull();
    expect(container.querySelector(".bureau-registres")).toBeNull();
    expect(screen.queryByRole("tab", { name: "Tâches" })).toBeNull();
    expect(screen.queryByRole("tab", { name: "Mon bureau" })).toBeNull();
    expect(container.querySelector(".dashboard-rail")).toBeNull();
  });

  it("keeps the dedicated views reachable by address, with the tab rail shown there", () => {
    render(<MemoryRouter initialEntries={["/?tab=team"]}><DashboardTabs {...props} /></MemoryRouter>);
    expect(screen.getByRole("tab", { name: "Mon bureau" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Équipe" }).getAttribute("aria-selected")).toBe("true");
  });

  it("shows no false zero while collection counts are unavailable, and hides messages without permission", () => {
    const { container } = render(<MemoryRouter><AdminOverviewTab data={data} loading={false} error canUseMessaging={false} /></MemoryRouter>);
    expect(container.querySelector(".ve-chemise b")?.textContent).toBe("…");
    expect(screen.getByText("Le registre de révision est indisponible.")).toBeTruthy();
    expect(container.querySelector('[data-tour="dashboard-communication"]')).toBeNull();
    expect(screen.queryByText("Échanges clients")).toBeNull();
  });

  it("opens a monthly calendar from the deadline tab", () => {
    render(<MemoryRouter initialEntries={["/?tab=deadlines"]}><DashboardTabs {...props} /></MemoryRouter>);
    expect(screen.getByRole("group", { name: "Calendrier des échéances" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Mois suivant" })).toBeTruthy();
  });

  it("shows every admin task in its state column, searches them, and keeps the real counts", () => {
    const { container } = render(<MemoryRouter><TasksTab data={data} /></MemoryRouter>);
    const colonne = (cible: string) => container.querySelector(`[data-tour="${cible}"]`) as HTMLElement;
    expect(within(colonne("dashboard-task-ongoing")).getAllByRole("article")).toHaveLength(3);
    expect(within(colonne("dashboard-task-todo")).getAllByRole("article")).toHaveLength(3);
    expect(within(colonne("dashboard-task-completed")).getAllByRole("article")).toHaveLength(1);
    expect(screen.getByRole("img", { name: "1 terminée, 3 en cours, 3 à faire" })).toBeTruthy();
    expect(container.querySelector('[data-tour="dashboard-task-resume"]')).toBeNull();
    fireEvent.change(screen.getByRole("searchbox", { name: "Rechercher une tâche" }), { target: { value: "task-4" } });
    expect(container.querySelectorAll(".atk-card")).toHaveLength(1);
    expect(screen.getByText("Travail task-4")).toBeTruthy();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Liste" }));
    expect(container.querySelectorAll(".atk-row")).toHaveLength(7);
    expect(screen.getByText("Travail task-6")).toBeTruthy();
  });

  it("uses a separate admin walkthrough that describes the new briefing", () => {
    const { container } = render(<MemoryRouter><DashboardTabs {...props} /></MemoryRouter>);
    const tour = getPageTour("/", session());
    expect(tour?.id).toBe("dashboard-admin");
    tour?.steps.filter((step) => !["dashboard-summary", "dashboard-resume"].includes(String(step.target))).forEach((step) => expect(container.querySelector(`[data-tour="${String(step.target)}"]`)).toBeTruthy());
  });

  it("defaults the week to today and lists the chosen day's deadlines", () => {
    render(<MemoryRouter><DashboardTabs {...props} /></MemoryRouter>);
    const today = screen.getByRole("button", { name: "30/09/2026, 0 échéance" });
    expect(today.getAttribute("aria-current")).toBe("date");
    expect(screen.getByText("Aucune échéance le 30/09/2026.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "01/10/2026, 1 échéance" }));
    expect(screen.getByRole("button", { name: "01/10/2026, 1 échéance" }).getAttribute("aria-pressed")).toBe("true");
    expect(document.querySelector('.ve-agenda a[href="/collectes/review"]')).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "01/10/2026, 1 échéance" }));
    expect(screen.getByRole("button", { name: "01/10/2026, 1 échéance" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("does not show stale day counts when collections fail to load", () => {
    render(<MemoryRouter><DashboardTabs {...props} collectesError /></MemoryRouter>);
    expect(screen.queryByRole("button", { name: "01/10/2026, 1 échéance" })).toBeNull();
    expect(screen.getByRole("button", { name: "01/10/2026, 0 échéance" })).toBeTruthy();
  });

});
