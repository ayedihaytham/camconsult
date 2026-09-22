import { describe, expect, it } from "vitest";
import { buildDashboardData, getDeadlineBucket, isOpenTask, isOverdueCollection, type DashboardDataInput } from "./dashboardData";
import type { Collecte, Conversation, Societe, Tache } from "@/types";

const NOW = new Date("2026-09-20T10:00:00");

function society(id = "soc-1"): Societe {
  return {
    id,
    raisonSociale: `Société ${id}`,
    rne: "",
    tva: "",
    theme: "PME",
    code: id,
    statut: "actif",
    telephone: "",
    email: "",
    adresse: "",
    creeLe: "2026-09-01T08:00:00Z",
  };
}

function task(id: string, statut: Tache["statut"]): Tache {
  return {
    id,
    titre: id,
    description: "",
    societeId: "soc-1",
    assigneId: null,
    statut,
    creePar: "admin",
    creeLe: "2026-09-10T08:00:00Z",
    majLe: "2026-09-10T08:00:00Z",
    termineLe: statut === "termine" ? "2026-09-11T08:00:00Z" : null,
  };
}

function collection(id: string, statut: Collecte["statut"], echeance: string | null): Collecte {
  return {
    id,
    societeId: "soc-1",
    periode: "Septembre 2026",
    statut,
    onglets: [],
    devise: "TND",
    echeance,
    derniereRelanceLe: null,
    relanceCadenceJours: 3,
    creeLe: "2026-09-01T08:00:00Z",
    majLe: "2026-09-18T08:00:00Z",
    transmisLe: statut === "transmis" ? "2026-09-18T08:00:00Z" : null,
    valideLe: statut === "valide" ? "2026-09-19T08:00:00Z" : null,
  };
}

function conversation(id: string, unread: number): Conversation {
  return {
    id,
    type: "groupe",
    titre: id,
    employeId: null,
    societeId: null,
    dernierMessage: "Message",
    dernierMessageLe: "2026-09-19T08:00:00Z",
    nonLus: unread,
    enLigne: false,
  };
}

function input(patch: Partial<DashboardDataInput> = {}): DashboardDataInput {
  return {
    role: "admin",
    viewerEmployeId: null,
    canUseMessaging: true,
    now: NOW,
    societes: [society()],
    collaborateurs: [],
    noeuds: [],
    taches: [],
    conversations: [],
    notifications: [],
    collectes: [],
    bordereaux: [],
    journalEntries: [],
    adminName: "Mohamed Ayedi",
    ...patch,
  };
}

describe("dashboard task metrics", () => {
  it("counts à faire and en cours as open, but not terminé", () => {
    expect(isOpenTask(task("todo", "a_faire"))).toBe(true);
    expect(isOpenTask(task("doing", "en_cours"))).toBe(true);
    expect(isOpenTask(task("done", "termine"))).toBe(false);

    const data = buildDashboardData(input({
      taches: [task("todo", "a_faire"), task("doing", "en_cours"), task("done", "termine")],
    }));
    expect(data.kpis.find((kpi) => kpi.id === "tasks")?.value).toBe(2);
  });
});

describe("dashboard collection deadlines", () => {
  it("classifies overdue, today, upcoming and later deadlines deterministically", () => {
    expect(getDeadlineBucket("2026-09-19", NOW)).toBe("overdue");
    expect(getDeadlineBucket("2026-09-20", NOW)).toBe("today");
    expect(getDeadlineBucket("2026-09-24", NOW)).toBe("week");
    expect(getDeadlineBucket("2026-10-10", NOW)).toBe("later");
  });

  it("does not treat validated collections as overdue", () => {
    expect(isOverdueCollection(collection("open", "brouillon", "2026-09-19"), NOW)).toBe(true);
    expect(isOverdueCollection(collection("valid", "valide", "2026-09-19"), NOW)).toBe(false);

    const data = buildDashboardData(input({
      collectes: [
        collection("open", "brouillon", "2026-09-19"),
        collection("today", "brouillon", "2026-09-20"),
        collection("valid", "valide", "2026-09-19"),
      ],
    }));
    expect(data.deadlines.map((item) => item.id)).toEqual(["open", "today"]);
  });
});

describe("dashboard role and message metrics", () => {
  it("sums real unread values across visible conversations", () => {
    const data = buildDashboardData(input({ conversations: [conversation("A", 2), conversation("B", 3)] }));
    expect(data.kpis.find((kpi) => kpi.id === "messages")?.value).toBe(5);
  });

  it("uses only the already-scoped companies supplied for a collaborator", () => {
    const data = buildDashboardData(input({
      role: "collaborateur",
      viewerEmployeId: "emp-1",
      societes: [society("allowed")],
    }));
    expect(data.kpis.find((kpi) => kpi.id === "clients")?.value).toBe(1);
  });

  it("does not expose cabinet task or client KPIs to a company employee", () => {
    const data = buildDashboardData(input({
      role: "societe_employe",
      viewerEmployeId: "client-1",
      taches: [task("hidden", "en_cours")],
    }));
    expect(data.kpis.some((kpi) => kpi.id === "tasks" || kpi.id === "clients")).toBe(false);
  });
});
