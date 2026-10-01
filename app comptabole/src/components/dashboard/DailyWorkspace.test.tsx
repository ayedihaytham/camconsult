// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { DashboardHeader } from "./DashboardHeader";
import { DashboardTabs } from "./DashboardTabs";
import { buildDashboardData } from "@/lib/dashboard/dashboardData";
import { dashboardInput, NOW, session } from "@/lib/dashboard/dashboardFixtures.test-support";
import { getPageTour } from "@/components/tour/tourRegistry";
import { TasksTab } from "./tabs/TasksTab";
import { AttentionTab } from "./tabs/AttentionTab";
import { ActivityTab } from "./tabs/ActivityTab";
import { DeadlinesTab } from "./tabs/DeadlinesTab";
import { CollectionTransmissions } from "./CollectionTransmissions";
import { task, collection } from "@/lib/dashboard/dashboardFixtures.test-support";

afterEach(cleanup);
const data = buildDashboardData(dashboardInput());
const base = { data, now: NOW, canUseMessaging: true, collectesLoading: false, collectesError: false, onRetryCollectes: () => {}, adminDataLoading: false, adminDataError: false, onRetryAdminData: () => {} };

describe("Daily Workspace UI contract", () => {
  it("exposes each overview section once for responsive composition", () => {
    const { container } = render(<MemoryRouter><DashboardTabs {...base} /></MemoryRouter>);
    expect(screen.getByRole("tab", { name: "Mon bureau" })).toBeTruthy();
    expect(screen.getAllByText("Travail first")).toHaveLength(1);
    const targets = ["dashboard-resume", "dashboard-transmissions", "dashboard-attention", "dashboard-tasks", "dashboard-communication"].map((target) => container.querySelector(`[data-tour="${target}"]`));
    targets.forEach((target) => expect(target).toBeTruthy());
    expect(container.querySelector('[data-tour="dashboard-deadline-strip"]')?.className).toContain("overflow-x-auto");
    expect(container.querySelectorAll(".dashboard-mobile-attention")).toHaveLength(1);
    expect(container.querySelectorAll(".dashboard-task-section--ongoing")).toHaveLength(1);
    expect(container.querySelectorAll(".dashboard-task-section--todo")).toHaveLength(1);
    expect(container.querySelector(".dashboard-resume-action")?.className).toContain("dashboard-resume-action");
    expect(screen.getByRole("link", { name: "Reprendre" }).getAttribute("href")).toBe("/taches");
    expect(screen.getAllByText("En cours").some((element) => element.className.includes("dashboard-badge--progress"))).toBe(true);
  });
  it("keeps the internal top area free of KPI presentation and preserves the banner and tabs", () => {
    const { container } = render(<MemoryRouter><DashboardHeader salutation="Bonjour Amira" dateLabel="Mercredi" {...base} loading={false} role="admin" canAddSociete /><DashboardTabs {...base} /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "Le travail du cabinet" })).toBeTruthy();
    expect(container.querySelector('[data-tour="dashboard-summary"] dl')).toBeNull();
    expect(container.querySelector('[aria-label="Accès aux modules"]')).toBeNull();
    ["Clients actifs", "Tâches ouvertes", "Échéances en retard"].forEach((label) => expect(screen.queryByText(label)).toBeNull());
    expect(screen.getByRole("tab", { name: "Échéances" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Reprendre" }).getAttribute("href")).toBe("/taches");
  });
  it("collection loading and errors preserve usable work and never report successful emptiness", () => {
    const { rerender } = render(<MemoryRouter><DashboardTabs {...base} collectesLoading /></MemoryRouter>);
    expect(screen.getByRole("status", { name: "Chargement des collectes" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Reprendre" })).toBeTruthy();
    rerender(<MemoryRouter><DashboardTabs {...base} collectesError /></MemoryRouter>);
    expect(screen.getByText("Collectes indisponibles")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Réessayer" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Reprendre" })).toBeTruthy();
    expect(screen.queryByText("Tout est à jour")).toBeNull();
  });
  it("date selection changes only transmissions and retains the work rows", () => {
    render(<MemoryRouter><DashboardTabs {...base} /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "01/10/2026, 0 collecte" }));
    expect(screen.getByText("Aucune transmission prévue.")).toBeTruthy();
    expect(screen.getByText("Travail second")).toBeTruthy();
  });
  it("does not expose admin or internal work views to other roles", () => {
    const collaborator = buildDashboardData(dashboardInput({ role: "collaborateur", viewerEmployeId: "emp-1" }));
    const { rerender } = render(<MemoryRouter initialEntries={["/?tab=team"]}><DashboardTabs {...base} data={collaborator} /></MemoryRouter>);
    expect(screen.queryByRole("tab", { name: "Équipe" })).toBeNull();
    expect(screen.getByRole("tab", { name: "Mon bureau" }).getAttribute("aria-selected")).toBe("true");
    rerender(<MemoryRouter><DashboardTabs {...base} data={buildDashboardData(dashboardInput({ role: "societe_employe" }))} /></MemoryRouter>);
    expect(screen.queryByRole("tab", { name: "Tâches" })).toBeNull();
    expect(screen.queryByRole("tab", { name: "Activité" })).toBeNull();
    expect(screen.queryByRole("tab", { name: "À traiter" })).toBeNull();
    expect(screen.getByRole("tab", { name: "Collectes" })).toBeTruthy();
  });
  it("provides all internal tour targets using the existing versioned registry", () => {
    const { container } = render(<MemoryRouter><div data-tour="page-workspace"><DashboardHeader salutation="Bonjour" dateLabel="Mercredi" data={data} now={NOW} loading={false} role="admin" canAddSociete canUseMessaging /><DashboardTabs {...base} /></div></MemoryRouter>);
    const tour = getPageTour("/", session());
    expect(tour?.version).toBe(2);
    tour?.steps.forEach((step) => { expect(typeof step.target).toBe("string"); expect(container.querySelector(`[data-tour="${step.target}"]`)).toBeTruthy(); });
    expect(getPageTour("/", session("societe_employe"))?.version).toBe(1);
  });
  it("keeps empty bureau states distinct and completed work available", () => {
    const empty = buildDashboardData(dashboardInput({ taches: [], collectes: [] }));
    const { rerender } = render(<MemoryRouter><DashboardTabs {...base} data={empty} /></MemoryRouter>);
    expect(screen.getByText(/Rien à reprendre/)).toBeTruthy();
    expect(screen.getByText("Aucune transmission prévue aujourd’hui.")).toBeTruthy();
    expect(screen.getByText("Aucune tâche à commencer dans ce périmètre.")).toBeTruthy();
    expect(screen.getByText("Aucun message non lu.")).toBeTruthy();
    rerender(<MemoryRouter><TasksTab data={buildDashboardData(dashboardInput({ taches: [task("finished", "termine")] }))} /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: /Terminées/ }));
    expect(screen.getByText("Travail finished")).toBeTruthy();
  });
  it("omits the cabinet/collaborator scope switch while keeping quick actions in the banner", () => {
    const { container } = render(<MemoryRouter><DashboardHeader salutation="Bonjour Amira" dateLabel="Mercredi" data={data} now={NOW} loading={false} role="admin" canAddSociete canUseMessaging /><DashboardTabs {...base} /></MemoryRouter>);
    expect(screen.queryByRole("button", { name: "Tout le cabinet" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Collaborateur" })).toBeNull();
    expect(container.querySelector("[data-tour=dashboard-scope]")).toBeNull();
    expect(screen.getByRole("button", { name: /Actions/ })).toBeTruthy();
  });
  it("attention search retains loaded results during a partial failure", () => {
    const partial = buildDashboardData(dashboardInput({ societes: [{ ...dashboardInput().societes[0], statut: "en_attente" }], collectes: [] }));
    render(<MemoryRouter><AttentionTab items={partial.attentionItems} loading={false} error /></MemoryRouter>);
    expect(screen.getByText("Société soc-1")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("Liste partielle");
    fireEvent.change(screen.getByLabelText("Rechercher un élément à traiter"), { target: { value: "introuvable" } });
    expect(screen.getByText("Aucun résultat parmi les éléments actuellement chargés.")).toBeTruthy();
    expect(screen.queryByText("Tout est à jour")).toBeNull();
  });
  it("prioritizes overdue, correction and review items in the bureau action center", () => {
    const actionData = buildDashboardData(dashboardInput({ collectes: [
      collection("late", "2026-09-29"),
      collection("fix", "2026-10-02", "a_corriger"),
      collection("review", "2026-10-03", "transmis"),
    ] }));
    const { container, rerender } = render(<MemoryRouter><DashboardTabs {...base} data={actionData} /></MemoryRouter>);
    expect(screen.getByRole("group", { name: "Résumé des éléments à traiter" })).toBeTruthy();
    const summary = container.querySelector(".dashboard-attention-summary");
    expect(summary?.textContent).toContain("1 en retard");
    expect(summary?.textContent).toContain("1 correction");
    expect(summary?.textContent).toContain("1 à examiner");
    expect(container.querySelectorAll(".dashboard-attention-preview")).toHaveLength(3);
    expect(screen.getByRole("link", { name: "Tout voir" }).getAttribute("href")).toBe("/?tab=attention");
    rerender(<MemoryRouter><DashboardTabs {...base} data={actionData} collectesError /></MemoryRouter>);
    expect(container.querySelector(".dashboard-attention-summary")).toBeNull();
  });
  it("retains the company-side header and its scoped KPIs", () => {
    const client = buildDashboardData(dashboardInput({ role: "societe_employe" }));
    const { container, rerender } = render(<MemoryRouter><DashboardHeader salutation="Bonjour" dateLabel="Mercredi" data={client} now={NOW} loading={false} role="societe_employe" canAddSociete={false} canUseMessaging /></MemoryRouter>);
    expect(container.querySelectorAll("dl dd")).toHaveLength(client.kpis.length);
    expect(screen.queryByRole("heading", { name: "Le travail du cabinet" })).toBeNull();
    rerender(<MemoryRouter><DashboardHeader salutation="Bonjour" dateLabel="Mercredi" data={client} now={NOW} loading={false} error role="societe_employe" canAddSociete={false} canUseMessaging /></MemoryRouter>);
    expect(screen.getAllByText("Indisponible").length).toBeGreaterThan(0);
  });  it("connects the collection dates through a selected continuous deadline ruler", () => {
    const { container } = render(<MemoryRouter><DashboardTabs {...base} /></MemoryRouter>);
    const rail = screen.getByRole("group", { name: "Dates des collectes" });
    const days = rail.querySelectorAll("button");
    expect(days).toHaveLength(6);
    expect(rail.className).toContain("overflow-x-auto");
    expect(days[0].getAttribute("aria-pressed")).toBe("true");
    expect(days[0].className).toContain("ledger-day");
    expect(days[0].getAttribute("aria-current")).toBe("date");
    expect(days[0].className).not.toContain("bg-primary text-primary-foreground");
    expect(screen.getByText("30 septembre–5 octobre 2026")).toBeTruthy();
    expect(rail.textContent).not.toContain("Aucune");
    expect(container.querySelector(".ledger-ruler-track")).toBeTruthy();
    expect(container.querySelector(".transmission-ledger")).toBeTruthy();
    fireEvent.click(days[1]);
    expect(days[1].getAttribute("aria-pressed")).toBe("true");
    expect(container.querySelector('[data-tour="dashboard-transmissions"]')?.textContent).toContain("Les tâches n’ont pas d’échéance.");
  });
  it("shows only loaded overdue collection context inside the transmission ledger", () => {
    const now = new Date("2026-10-01T10:00:00");
    const overdueData = buildDashboardData(dashboardInput({ now }));
    const { rerender } = render(<MemoryRouter><CollectionTransmissions deadlines={overdueData.deadlines} now={now} loading={false} error={false} /></MemoryRouter>);
    expect(screen.getByText("1 en retard")).toBeTruthy();
    expect(screen.getByText("1 en retard").className).toContain("dashboard-badge--danger");
    expect(screen.getByRole("link", { name: "Échéances" }).getAttribute("href")).toBe("/?tab=deadlines");
    rerender(<MemoryRouter><CollectionTransmissions deadlines={overdueData.deadlines} now={now} loading={false} error /></MemoryRouter>);
    expect(screen.queryByText("1 en retard")).toBeNull();
    expect(screen.getByRole("status").textContent).toContain("indisponibles");
    expect(screen.queryByText("Aucune transmission prévue aujourd’hui.")).toBeNull();
    rerender(<MemoryRouter><CollectionTransmissions deadlines={overdueData.deadlines} now={now} loading error={false} /></MemoryRouter>);
    expect(screen.queryByText("1 en retard")).toBeNull();
    expect(screen.queryByRole("group", { name: "Dates des collectes" })).toBeNull();
  });  it("task lenses count all loaded accessible work and keep the dedicated list complete", () => {
    const taches = Array.from({ length: 6 }, (_, index) => task(`open-${index}`, "a_faire"));
    render(<MemoryRouter><TasksTab data={buildDashboardData(dashboardInput({ taches: [...taches, task("done", "termine")] }))} /></MemoryRouter>);
    expect(screen.getByRole("button", { name: "Ouvertes 6" }).getAttribute("aria-pressed")).toBe("true");
    taches.forEach((item) => expect(screen.getByText(item.titre)).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Terminées 1" }));
    expect(screen.getByRole("button", { name: "Terminées 1" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("Travail done")).toBeTruthy();
    expect(screen.queryByText("Travail open-0")).toBeNull();
  });
  it("gives overdue deadlines a danger badge and keeps date grouping data-driven", () => {
    const now = new Date("2026-10-01T10:00:00");
    const deadlines = buildDashboardData(dashboardInput({ now, collectes: [collection("late", "2026-09-30")] })).deadlines;
    const { container } = render(<MemoryRouter><DeadlinesTab deadlines={deadlines} loading={false} error={false} onRetry={() => {}} /></MemoryRouter>);
    expect(container.querySelector(".dashboard-badge--danger")?.textContent).toMatch(/retard/i);
  });
  it("keeps team rows informational when collaborator filtering is not exposed", () => {
    render(<MemoryRouter initialEntries={["/?tab=team"]}><DashboardTabs {...base} /></MemoryRouter>);
    expect(screen.queryByRole("button", { name: /Voir les tâches de Amira/ })).toBeNull();
    expect(screen.getAllByText("Amira emp-1")).toHaveLength(2);
  });
  it("activity filters loaded sources while preserving partial failure and role boundaries", () => {
    const activityData = { ...data, recentFiles: [{ id: "file-1", name: "Balance.pdf", societeName: "Société soc-1", updatedAt: NOW.toISOString() }], recentMessages: [{ id: "message-1", label: "Discussion", initials: "AM", preview: "Document reçu", updatedAt: NOW.toISOString(), unread: 1, online: false }] };
    const { rerender } = render(<MemoryRouter><ActivityTab data={activityData} canUseMessaging error /></MemoryRouter>);
    expect(screen.getByRole("status").textContent).toContain("journal est indisponible");
    fireEvent.click(screen.getByRole("button", { name: "Fichier" }));
    expect(screen.getByText("Balance.pdf")).toBeTruthy();
    expect(screen.queryByText("Discussion")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Message" }));
    expect(screen.getByText("Discussion")).toBeTruthy();
    expect(screen.getByText("1 non lu").className).toContain("dashboard-badge--info");
    expect(screen.queryByText("Balance.pdf")).toBeNull();
    rerender(<MemoryRouter><ActivityTab data={{ ...activityData, role: "collaborateur" }} canUseMessaging /></MemoryRouter>);
    expect(screen.queryByRole("button", { name: "Journal" })).toBeNull();
  });
  it("renders real selected and upcoming collections as dated links without status pills", () => {
    const input = dashboardInput({ collectes: [collection("today"), collection("sent", "2026-10-01", "transmis"), collection("fix", "2026-10-03", "a_corriger")] });
    const ledger = buildDashboardData(input);
    const { container } = render(<MemoryRouter><CollectionTransmissions deadlines={ledger.deadlines} now={NOW} loading={false} error={false} /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "Prochaines transmissions" })).toBeTruthy();
    expect(screen.getByText("Déjà transmis · à examiner")).toBeTruthy();
    expect(screen.getByText("Corrections demandées")).toBeTruthy();
    expect(screen.getByText("Corrections demandées").className).toContain("dashboard-transmission-state--warning");
    expect(container.querySelectorAll(".ledger-upcoming .transmission-entry")).toHaveLength(2);
    expect(container.querySelector('.ledger-selected .transmission-entry')?.getAttribute("href")).toBe("/collectes/today");
    expect(container.querySelectorAll("time.ledger-entry-date")).toHaveLength(3);
    expect(container.querySelector('.transmission-entry [class*="rounded"]')).toBeNull();
  });

});
