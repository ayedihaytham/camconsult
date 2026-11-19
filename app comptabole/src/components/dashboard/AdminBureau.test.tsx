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

describe("Synthèse du cabinet : chemises d'indicateurs", () => {
  it("quatre chemises à onglets : retards de transmission, pièces à examiner, rejets à reprendre, échanges clients", () => {
    const { container } = monter({ collectes: [collection("late", "2026-09-20"), collection("rev", "2026-10-02", "transmis"), collection("fix", "2026-10-05", "a_corriger")], conversations: [conversation] });
    const chemises = container.querySelectorAll(".ve-chemise");
    expect(chemises).toHaveLength(4);
    expect(Array.from(chemises).map((c) => c.querySelector(".ve-chemise__onglet")?.textContent)).toEqual(["Retards de transmission", "Pièces à examiner", "Rejets à reprendre", "Échanges clients"]);
    expect(chemises[0].querySelector("b")?.textContent).toBe("1");
    expect(chemises[0].textContent).toContain("100 % des 1 dossier actif");
    expect(chemises[1].querySelector("b")?.textContent).toBe("1");
    expect(chemises[2].querySelector("b")?.textContent).toBe("1");
  });

  it("sans droit de messagerie, la chemise « Échanges clients » et sa carte disparaissent", () => {
    const { container } = monter({}, { canUseMessaging: false });
    expect(container.querySelectorAll(".ve-chemise")).toHaveLength(3);
    expect(screen.queryByText("Échanges clients")).toBeNull();
  });

  it("indisponible : pas de faux zéro dans les chemises, ni de registre", () => {
    const { container } = monter({ collectes: [collection("a", "2026-09-20")] }, { error: true });
    expect(container.querySelector(".ve-chemise b")?.textContent).toBe("…");
    expect(screen.getByText("Le registre de révision est indisponible.")).toBeTruthy();
    expect(screen.getByText("Le portefeuille est indisponible.")).toBeTruthy();
  });
});

describe("Synthèse du cabinet : portefeuille clients", () => {
  it("range les dossiers en trois groupes par état, avec leur nombre, et la répartition en tête", () => {
    const { container } = monter({ collectes: [collection("late", "2026-09-20"), collection("rev", "2026-10-02", "transmis")] });
    const groupes = Array.from(container.querySelectorAll(".ve-groupe h3")).map((h) => h.textContent);
    expect(groupes).toEqual(["En retard de transmission1", "En révision0", "À jour0"]);
    expect(container.querySelector(".ve-repartition")?.getAttribute("aria-label")).toContain("1 en retard de transmission");
  });

  it("une carte de dossier annonce ses collectes ouvertes et ouvre le détail au clic", () => {
    const { container } = monter({ collectes: [collection("late", "2026-09-20")] });
    const carte = within(container.querySelector('[data-tour="dashboard-portefeuille"]') as HTMLElement).getByRole("button", { name: /Ouvrir le détail de Société soc-1/ });
    expect(carte.textContent).toContain("1 collecte ouverte");
    fireEvent.click(carte);
    expect(within(screen.getByRole("dialog")).getByText("Circuit des collectes")).toBeTruthy();
  });
});

describe("Synthèse du cabinet : registre de révision et échéancier", () => {
  const collectes = [collection("late", "2026-09-20"), collection("rev", "2026-10-02", "transmis"), collection("fix", "2026-10-05", "a_corriger")];

  it("le registre groupe les travaux : retards, pièces à examiner, rejets, avec le retard en jours entiers", () => {
    const { container } = monter({ collectes });
    const groupes = Array.from(container.querySelectorAll(".ve-table__groupe")).map((g) => g.textContent);
    expect(groupes).toEqual(["En retard de transmission · 1", "Pièces à examiner · 1", "Rejets à reprendre · 1"]);
    expect(container.querySelector(".ve-table__delai")?.textContent).toBe("10 jours");
  });

  it("un dossier du registre ouvre son détail dans un volet, avec l'accès au dossier", () => {
    monter({ collectes });
    fireEvent.click(screen.getAllByRole("button", { name: /Ouvrir le détail de/ })[0]);
    const volet = screen.getByRole("dialog");
    expect(within(volet).getByText("Circuit des collectes")).toBeTruthy();
    expect(within(volet).getByRole("link", { name: /Ouvrir le dossier/ })).toBeTruthy();
  });

  it("l'échéancier compte sept jours ; choisir un jour filtre le registre, et le filtre s'efface", () => {
    const { container } = monter({ collectes });
    expect(container.querySelectorAll(".ve-semaine button")).toHaveLength(7);
    fireEvent.click(screen.getByRole("button", { name: "02/10/2026, 1 échéance" }));
    expect(container.querySelectorAll(".ve-table tbody tr:not(.ve-table__groupe)")).toHaveLength(1);
    expect(screen.getByText(/échéance du 02\/10\/2026/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Effacer le filtre" }));
    expect(container.querySelectorAll(".ve-table tbody tr:not(.ve-table__groupe)")).toHaveLength(3);
  });

  it("la charge de travail est réservée à l'administrateur : un responsable ne la voit pas", () => {
    monter({ taches: [task("t1"), task("t2", "a_faire")] });
    expect(screen.getByText("Total des tâches ouvertes")).toBeTruthy();
    cleanup();
    monter({ role: "responsable" as never });
    expect(screen.queryByText("Total des tâches ouvertes")).toBeNull();
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
