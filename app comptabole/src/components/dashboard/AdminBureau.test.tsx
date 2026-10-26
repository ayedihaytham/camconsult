// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AdminOverviewTab } from "./tabs/AdminOverviewTab";
import { AdminMessageRows, AdminTeamRows, CollecteCircuit, collecteStatutLabel } from "./AdminBureauCards";
import { buildDashboardData, type DashboardMessageActivity, type DashboardTeamMember } from "@/lib/dashboard/dashboardData";
import { collection, dashboardInput, NOW, task } from "@/lib/dashboard/dashboardFixtures.test-support";
import type { Conversation } from "@/types";

afterEach(cleanup);

const conversation: Conversation = { id: "conv-1", type: "direct", titre: "Port Sud Logistique", employeId: "emp-1", societeId: null, dernierMessage: "Question sur la facture", dernierMessageLe: "2026-09-30T09:00:00Z", nonLus: 2, enLigne: true };
const monter = (patch = {}, props = {}) => {
  const data = buildDashboardData(dashboardInput(patch));
  return render(<MemoryRouter><AdminOverviewTab data={data} now={NOW} loading={false} error={false} canUseMessaging {...props} /></MemoryRouter>);
};

describe("Mon bureau administrateur : semaine en billets", () => {
  it("chaque jour liste ses collectes réelles avec leur statut écrit et un lien vers le dossier ; les jours vides restent discrets", () => {
    const { container } = monter({ collectes: [collection("a", "2026-09-30", "transmis"), collection("b", "2026-10-02", "a_corriger")] });
    const jours = container.querySelectorAll(".bureau-day");
    expect(jours).toHaveLength(7);
    expect(jours[0].querySelector('a[href="/collectes/a"]')?.textContent).toContain("À examiner");
    expect(jours[2].querySelector('a[href="/collectes/b"]')?.textContent).toContain("À corriger");
    expect(jours[1].querySelectorAll("a")).toHaveLength(0);
    expect(jours[1].textContent).toContain("Rien de prévu");
    expect(jours[0].getAttribute("class")).toContain("is-today");
  });

  it("seul le dimanche est un jour de repos : le samedi reste un jour ordinaire", () => {
    const { container } = monter();
    const jours = container.querySelectorAll(".bureau-day");
    expect(jours[3].getAttribute("class")).not.toContain("is-weekend");
    expect(jours[3].textContent).toContain("Rien de prévu");
    expect(jours[4].getAttribute("class")).toContain("is-weekend");
    expect(jours[4].textContent).toContain("Dimanche");
    expect(jours[4].querySelector(".bureau-day-empty")).toBeNull();
  });

  it("chaque billet porte le jour, le numéro et le mois ; il n'y a plus de légende de couleurs", () => {
    const { container } = monter();
    const jours = container.querySelectorAll(".bureau-day");
    expect(jours[0].querySelector(".bureau-day-head strong")?.textContent).toMatch(/^\d+$/);
    expect(jours[0].querySelector(".bureau-day-head em")?.textContent?.length).toBeGreaterThan(0);
    expect(container.querySelector(".bureau-week-legend")).toBeNull();
  });

  it("le détail du jour choisi annonce sa date et le nombre de collectes, puis liste chaque collecte avec son avancement", () => {
    const { container } = monter({ collectes: [collection("a", "2026-09-30", "transmis")] });
    const detail = container.querySelector(".bureau-day-detail") as HTMLElement;
    expect(within(detail).getByRole("heading", { name: /^Collectes du .*1 collecte$/ })).toBeTruthy();
    const ligne = detail.querySelector('a[href="/collectes/a"]') as HTMLElement;
    expect(ligne.textContent).toContain("Septembre 2026");
    expect(within(ligne).getByRole("img", { name: /À examiner/ })).toBeTruthy();
  });

  it("au-delà de deux collectes un jour, le reste est résumé (« + N autres »)", () => {
    const { container } = monter({ collectes: ["a", "b", "c", "d", "e"].map((id) => collection(id, "2026-09-30", "transmis")) });
    expect(container.querySelectorAll(".bureau-day")[0].querySelectorAll("a")).toHaveLength(2);
    expect(screen.getByText("+ 3 autres")).toBeTruthy();
  });

  it("indisponible : pas de collectes affichées dans le tableau, ni de faux zéro", () => {
    const { container } = monter({ collectes: [collection("a", "2026-09-30")] }, { error: true });
    expect(container.querySelectorAll(".bureau-event")).toHaveLength(0);
    expect(container.querySelector(".bureau-day-empty")).toBeNull();
    expect(screen.getAllByText("Le suivi des collectes est indisponible.").length).toBeGreaterThan(0);
  });
});

describe("Mon bureau administrateur : ligne de verdict", () => {
  it("sans élément à traiter : « Tout est à jour », sans lien", () => {
    const { container } = monter({ collectes: [] });
    const verdict = container.querySelector(".bureau-verdict") as HTMLElement;
    expect(verdict.textContent).toContain("Tout est à jour");
    expect(verdict.tagName).toBe("P");
  });

  it("avec un élément à traiter : la ligne l'annonce et ouvre la liste À traiter", () => {
    const { container } = monter({ collectes: [collection("late", "2026-09-20")] });
    const verdict = container.querySelector(".bureau-verdict") as HTMLElement;
    expect(verdict.textContent).toMatch(/demande(nt)? votre attention/);
    expect(verdict.tagName).toBe("A");
    expect(verdict.getAttribute("href")).toBe("/?tab=attention");
  });
});

describe("Mon bureau administrateur : registres en tuiles", () => {
  it("un seul registre est visible à la fois ; changer de tuile affiche l'autre, avec les compteurs réels", () => {
    const { container } = monter({ taches: [task("t1"), task("t2", "a_faire")] });
    const tab = (n: RegExp) => screen.getByRole("tab", { name: n });
    expect(tab(/^Travail à avancer/).getAttribute("aria-selected")).toBe("true");
    expect(tab(/^Travail à avancer/).textContent).toContain("2");
    const echeances = container.querySelector('[data-tour="dashboard-transmissions"]') as HTMLElement;
    expect(echeances.getAttribute("data-state")).toBe("inactive");
    fireEvent.mouseDown(tab(/^Échéances/));
    fireEvent.click(tab(/^Échéances/));
    expect(echeances.getAttribute("data-state")).toBe("active");
    const travail = container.querySelector('[data-tour="dashboard-tasks"]') as HTMLElement;
    expect(within(travail).getAllByRole("link")).toHaveLength(2);
    expect(within(travail).getByText("Travail t1")).toBeTruthy();
  });

  it("les registres Messages et Équipe suivent les droits : pas de messagerie, pas de tuile Messages ; responsable, pas de tuile Équipe", () => {
    monter({}, { canUseMessaging: false });
    expect(screen.queryByRole("tab", { name: /^Messages/ })).toBeNull();
    expect(screen.getByRole("tab", { name: /^Équipe/ })).toBeTruthy();
    cleanup();
    monter({ role: "responsable" as never });
    expect(screen.queryByRole("tab", { name: /^Équipe/ })).toBeNull();
  });

  it("le registre Équipe s'ouvre en consultation seule", () => {
    const { container } = monter({ conversations: [conversation] });
    fireEvent.mouseDown(screen.getByRole("tab", { name: /^Équipe/ }));
    fireEvent.click(screen.getByRole("tab", { name: /^Équipe/ }));
    const equipe = container.querySelector('[role="tabpanel"][data-state="active"]') as HTMLElement;
    expect(equipe.querySelector(".bureau-member")).toBeTruthy();
    expect(within(equipe).queryByRole("link")).toBeNull();
  });
});

describe("Avancement d'une collecte", () => {
  it("le statut est toujours écrit : retard, corrections, examen, sinon prévue", () => {
    expect(collecteStatutLabel({ bucket: "overdue", statut: "transmis" })).toBe("En retard");
    expect(collecteStatutLabel({ bucket: "week", statut: "a_corriger" })).toBe("À corriger");
    expect(collecteStatutLabel({ bucket: "week", statut: "transmis" })).toBe("À examiner");
    expect(collecteStatutLabel({ bucket: "later", statut: "brouillon" })).toBe("Prévue");
  });

  it("trois étapes réelles du circuit : à remplir, transmise, validée ; l'étape courante est marquée", () => {
    const { container } = render(<CollecteCircuit item={{ bucket: "week", statut: "transmis" }} />);
    expect(container.querySelectorAll(".bureau-circuit-step")).toHaveLength(3);
    expect(container.querySelectorAll("i.is-done")).toHaveLength(1);
    expect(container.querySelectorAll("i.is-current")).toHaveLength(1);
    expect(screen.getByRole("img").getAttribute("aria-label")).toContain("À examiner");
  });

  it("un retard colore l'étape et le libellé en alerte", () => {
    const { container } = render(<CollecteCircuit item={{ bucket: "overdue", statut: "brouillon" }} />);
    expect(container.querySelector(".bureau-circuit.is-overdue")).toBeTruthy();
    expect(container.querySelector("em")?.textContent).toBe("En retard");
  });
});

describe("Messages et Équipe", () => {
  const message: DashboardMessageActivity = { id: "m1", label: "Port Sud Logistique", initials: "PS", preview: "Question sur la facture", updatedAt: "2026-09-30T09:00:00Z", unread: 2, online: true };

  it("un message non lu : avatar avec présence, pastille, aperçu ; toute la ligne ouvre la messagerie, sans bouton « Répondre »", () => {
    const { container } = render(<MemoryRouter><AdminMessageRows messages={[message]} /></MemoryRouter>);
    expect(screen.getByText("Port Sud Logistique")).toBeTruthy();
    expect(screen.getByText("Question sur la facture")).toBeTruthy();
    expect(container.querySelector(".bureau-avatar i.is-online")).toBeTruthy();
    expect(container.querySelector(".bureau-unread-dot")).toBeTruthy();
    expect(screen.getByText(/2 non lus/)).toBeTruthy();
    expect(screen.getByRole("link").getAttribute("href")).toBe("/messagerie");
    expect(screen.queryByText("Répondre")).toBeNull();
  });

  it("aucun message : texte explicite, sans bouton", () => {
    render(<MemoryRouter><AdminMessageRows messages={[]} /></MemoryRouter>);
    expect(screen.getByText("Aucun message non lu.")).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
  });

  const membre = (id: string, name: string, enCours: number, aFaire: number, online = false): DashboardTeamMember => ({ id, name, initials: name.slice(0, 2).toUpperCase(), active: true, online, aFaire, enCours, done: 0, open: enCours + aFaire, total: enCours + aFaire });

  it("équipe : trois collaborateurs au plus, barre relative au plus chargé (en cours / à faire), présence, aucun classement", () => {
    const { container } = render(<MemoryRouter><AdminTeamRows members={[membre("1", "Aya Ben Salah", 2, 2, true), membre("2", "Karim Trabelsi", 4, 3), membre("3", "Sara Mejri", 1, 2), membre("4", "Zied Haddad", 0, 1)]} /></MemoryRouter>);
    expect(container.querySelectorAll(".bureau-member")).toHaveLength(3);
    expect(screen.queryByText("Zied Haddad")).toBeNull();
    const barres = container.querySelectorAll(".bureau-load");
    expect(barres[1].getAttribute("aria-label")).toBe("7 ouvertes : 4 en cours, 3 à faire");
    expect((barres[1].querySelector(".is-doing") as HTMLElement).style.width).toBe("57.14285714285714%");
    expect((barres[0].querySelector(".is-doing") as HTMLElement).style.width).toBe("28.57142857142857%");
    expect(container.querySelectorAll(".bureau-avatar i.is-online")).toHaveLength(1);
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("équipe : le nom s'affiche en casse normale, avec le détail des tâches ; sans tâche, « Aucune tâche ouverte »", () => {
    render(<MemoryRouter><AdminTeamRows members={[membre("1", "CHAIMA MEKNI", 0, 0), membre("2", "karim ben salah", 3, 2)]} /></MemoryRouter>);
    expect(screen.getByText("Chaima Mekni")).toBeTruthy();
    expect(screen.getByText("Karim Ben Salah")).toBeTruthy();
    expect(screen.getByText("Aucune tâche ouverte")).toBeTruthy();
    expect(screen.getByText("3 en cours · 2 à faire")).toBeTruthy();
    expect(screen.queryByText("CHAIMA MEKNI")).toBeNull();
  });

  it("équipe vide : message clair", () => {
    render(<MemoryRouter><AdminTeamRows members={[]} /></MemoryRouter>);
    expect(screen.getByText("Aucun collaborateur dans ce périmètre.")).toBeTruthy();
  });
});
