// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AdminOverviewTab } from "./tabs/AdminOverviewTab";
import { AdminMessageRows, AdminTeamCard } from "./AdminBureauCards";
import { buildDashboardData, type DashboardMessageActivity, type DashboardTeamMember } from "@/lib/dashboard/dashboardData";
import { collection, dashboardInput, NOW, task } from "@/lib/dashboard/dashboardFixtures.test-support";
import type { Conversation } from "@/types";

afterEach(cleanup);

const conversation: Conversation = { id: "conv-1", type: "direct", titre: "Port Sud Logistique", employeId: "emp-1", societeId: null, dernierMessage: "Question sur la facture", dernierMessageLe: "2026-09-30T09:00:00Z", nonLus: 2, enLigne: true };
const monter = (patch = {}, props = {}) => {
  const data = buildDashboardData(dashboardInput(patch));
  return render(<MemoryRouter><AdminOverviewTab data={data} now={NOW} loading={false} error={false} canUseMessaging {...props} /></MemoryRouter>);
};

describe("Mon bureau administrateur : semaine en tableau", () => {
  it("chaque jour liste ses collectes réelles, avec un lien vers le dossier, et les jours vides restent discrets", () => {
    const { container } = monter({ collectes: [collection("a", "2026-09-30", "transmis"), collection("b", "2026-10-02")] });
    const jours = container.querySelectorAll(".bureau-day");
    expect(jours).toHaveLength(7);
    expect(jours[0].querySelector('a[href="/collectes/a"]')).toBeTruthy();
    expect(jours[2].querySelector('a[href="/collectes/b"]')).toBeTruthy();
    expect(jours[1].querySelectorAll("a")).toHaveLength(0);
    expect(jours[1].textContent).toContain("—");
    expect(jours[3].getAttribute("class")).toContain("is-weekend");
    expect(jours[0].getAttribute("class")).toContain("is-today");
  });

  it("au-delà de trois collectes un jour, le reste est résumé (« + N autres »)", () => {
    const { container } = monter({ collectes: ["a", "b", "c", "d", "e"].map((id) => collection(id, "2026-09-30", "transmis")) });
    expect(container.querySelectorAll(".bureau-day")[0].querySelectorAll("a")).toHaveLength(3);
    expect(screen.getByText("+ 2 autres")).toBeTruthy();
  });

  it("indisponible : pas de collectes affichées dans le tableau, ni de faux zéro", () => {
    const { container } = monter({ collectes: [collection("a", "2026-09-30")] }, { error: true });
    expect(container.querySelectorAll(".bureau-event")).toHaveLength(0);
    expect(container.querySelector(".bureau-day-empty")).toBeNull();
  });
});

describe("Mon bureau administrateur : registres à onglets", () => {
  it("un seul registre est visible à la fois ; changer d'onglet affiche l'autre, avec les compteurs réels", () => {
    const { container } = monter({ collectes: [collection("a", "2026-09-30", "transmis")], taches: [task("t1"), task("t2", "a_faire")] });
    const tab = (n: RegExp) => screen.getByRole("tab", { name: n });
    expect(tab(/^Collectes du jour/).getAttribute("aria-selected")).toBe("true");
    expect(tab(/^Travail à avancer/).textContent).toContain("2");
    const travail = container.querySelector('[data-tour="dashboard-tasks"]') as HTMLElement;
    expect(travail.getAttribute("data-state")).toBe("inactive");
    fireEvent.mouseDown(tab(/^Travail à avancer/));
    fireEvent.click(tab(/^Travail à avancer/));
    expect(travail.getAttribute("data-state")).toBe("active");
    expect(within(travail).getAllByRole("link")).toHaveLength(2);
  });

  it("le registre des messages n'existe pas sans droit de messagerie", () => {
    monter({}, { canUseMessaging: false });
    expect(screen.queryByRole("tab", { name: /Messages à lire/ })).toBeNull();
  });
});

describe("Messages à lire et Équipe", () => {
  const message: DashboardMessageActivity = { id: "m1", label: "Port Sud Logistique", initials: "PS", preview: "Question sur la facture", updatedAt: "2026-09-30T09:00:00Z", unread: 2, online: true };

  it("un message non lu : avatar avec présence, pastille, aperçu et « Répondre » vers la messagerie", () => {
    const { container } = render(<MemoryRouter><AdminMessageRows messages={[message]} /></MemoryRouter>);
    expect(screen.getByText("Port Sud Logistique")).toBeTruthy();
    expect(screen.getByText("Question sur la facture")).toBeTruthy();
    expect(container.querySelector(".bureau-avatar i.is-online")).toBeTruthy();
    expect(container.querySelector(".bureau-unread-dot")).toBeTruthy();
    expect(screen.getByText(/2 non lus/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Répondre à Port Sud Logistique" }).getAttribute("href")).toBe("/messagerie");
  });

  it("aucun message : texte explicite, sans bouton", () => {
    render(<MemoryRouter><AdminMessageRows messages={[]} /></MemoryRouter>);
    expect(screen.getByText("Aucun message non lu.")).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
  });

  const membre = (id: string, name: string, enCours: number, aFaire: number, online = false): DashboardTeamMember => ({ id, name, initials: name.slice(0, 2).toUpperCase(), active: true, online, aFaire, enCours, done: 0, open: enCours + aFaire, total: enCours + aFaire });

  it("équipe : trois collaborateurs au plus, barre relative au plus chargé (en cours / à faire), présence, aucun classement", () => {
    const { container } = render(<MemoryRouter><AdminTeamCard members={[membre("1", "Aya Ben Salah", 2, 2, true), membre("2", "Karim Trabelsi", 4, 3), membre("3", "Sara Mejri", 1, 2), membre("4", "Zied Haddad", 0, 1)]} /></MemoryRouter>);
    expect(container.querySelectorAll(".bureau-member")).toHaveLength(3);
    expect(screen.queryByText("Zied Haddad")).toBeNull();
    const barres = container.querySelectorAll(".bureau-load");
    expect(barres[1].getAttribute("aria-label")).toBe("7 ouvertes : 4 en cours, 3 à faire");
    expect((barres[1].querySelector(".is-doing") as HTMLElement).style.width).toBe("57.14285714285714%");
    expect((barres[0].querySelector(".is-doing") as HTMLElement).style.width).toBe("28.57142857142857%");
    expect(container.querySelectorAll(".bureau-avatar i.is-online")).toHaveLength(1);
    expect(screen.getByRole("link", { name: /Voir/ }).getAttribute("href")).toBe("/?tab=team");
  });

  it("équipe vide : message clair", () => {
    render(<MemoryRouter><AdminTeamCard members={[]} /></MemoryRouter>);
    expect(screen.getByText("Aucun collaborateur dans ce périmètre.")).toBeTruthy();
  });

  it("la colonne de gauche montre l'équipe à l'administrateur seulement", () => {
    const { container } = monter({ role: "responsable" as never });
    expect(container.querySelector(".bureau-member")).toBeNull();
    cleanup();
    const admin = monter({ conversations: [conversation] });
    expect(admin.container.querySelector(".bureau-member")).toBeTruthy();
  });
});
