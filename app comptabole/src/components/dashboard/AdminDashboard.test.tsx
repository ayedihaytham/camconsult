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
  it("shows four bounded domains and puts team and activity in their tabs", () => {
    const { container } = render(<MemoryRouter><DashboardTabs {...props} /></MemoryRouter>);
    for (const name of ["Collectes du jour", "Travail à avancer", "Prochaines échéances", "Messages à lire"]) expect(screen.getByRole("tab", { name: new RegExp(`^${name}`) })).toBeTruthy();
    for (const name of ["Aujourd’hui", "À traiter", "Équipe"]) expect(screen.getByRole("heading", { name })).toBeTruthy();
    const summary = screen.getByRole("navigation", { name: "L'essentiel du cabinet" });
    expect(within(summary).getAllByRole("link")).toHaveLength(4);
    expect(container.querySelectorAll('[data-tour="dashboard-tasks"] li')).toHaveLength(3);
    expect(container.querySelector(".dashboard-resume")).toBeNull();
    expect(container.querySelector(".dashboard-rail")).toBeNull();
    expect(screen.getByRole("tab", { name: "Équipe" })).toBeTruthy();
  });

  it("keeps usable tasks and permission-gated messages while collection counts are unavailable", () => {
    const { container } = render(<MemoryRouter><AdminOverviewTab data={data} loading={false} error canUseMessaging={false} /></MemoryRouter>);
    expect(screen.getAllByText("Indisponible")).toHaveLength(2);
    expect(screen.getByText("Travail task-0")).toBeTruthy();
    expect(container.querySelector('[data-tour="dashboard-communication"]')).toBeNull();
    expect(screen.queryByText("Messages non lus")).toBeNull();
    expect(screen.queryByText("Aucune collecte prévue à cette date.")).toBeNull();
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
    tour?.steps.filter((step) => step.target !== "dashboard-summary").forEach((step) => expect(container.querySelector(`[data-tour="${step.target}"]`)).toBeTruthy());
  });

  it("defaults the weekday boxes to today and changes the dated previews when another day is chosen", () => {
    const { container } = render(<MemoryRouter><DashboardTabs {...props} /></MemoryRouter>);
    const today = screen.getByRole("button", { name: "30/09/2026, 0 collecte" });
    expect(today.getAttribute("aria-current")).toBe("date");
    expect(screen.getByRole("button", { name: "30/09/2026, 0 collecte" }).getAttribute("aria-pressed")).toBe("true");
    const collectionPanel = container.querySelector('[data-tour="dashboard-attention"]') as HTMLElement;
    expect(within(collectionPanel).getByText("Aucune collecte prévue à cette date.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "01/10/2026, 1 collecte" }));
    expect(screen.getByRole("button", { name: "01/10/2026, 1 collecte" }).getAttribute("aria-pressed")).toBe("true");
    expect(collectionPanel.querySelector('a[href="/collectes/review"]')).toBeTruthy();
    expect(container.querySelector('[data-tour="dashboard-transmissions"] a[href="/collectes/review"]')).toBeNull();
    expect(screen.getByText("Travail task-0")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Sept jours suivants" }));
    expect(screen.getByRole("button", { name: "07/10/2026, 0 collecte" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Aujourd’hui" }));
    expect(screen.getByRole("button", { name: "30/09/2026, 0 collecte" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("does not show stale day counts when collections fail to load", () => {
    render(<MemoryRouter><DashboardTabs {...props} collectesError /></MemoryRouter>);
    expect(screen.getByRole("button", { name: "01/10/2026, collectes indisponibles" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "01/10/2026, 1 collecte" })).toBeNull();
  });
});
