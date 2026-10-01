import { describe, expect, it } from "vitest";
import { buildDashboardData, dashboardDateKey, dashboardDateStrip, scopeDashboardInput, transmissionRows } from "./dashboardData";
import { collection, dashboardInput, employee, NOW, society, task } from "./dashboardFixtures.test-support";

describe("Daily Workspace derivations", () => {
  it("chooses Reprendre deterministically from real update/create timestamps and ID", () => {
    const rows = [task("b"), task("a"), { ...task("new"), majLe: "2026-09-29T08:00:00Z" }, { ...task("done", "termine"), majLe: "2026-09-30T08:00:00Z" }];
    const first = buildDashboardData(dashboardInput({ taches: rows }));
    const reversed = buildDashboardData(dashboardInput({ taches: [...rows].reverse() }));
    expect(first.resumeTask?.id).toBe("new");
    expect(first.taskRows.map((item) => item.id)).toEqual(reversed.taskRows.map((item) => item.id));
    expect(buildDashboardData(dashboardInput({ taches: [task("b"), task("a")] })).resumeTask?.id).toBe("a");
  });
  it("keeps personal assigned work separate from accessible company-origin work", () => {
    const data = buildDashboardData(dashboardInput({ role: "collaborateur", viewerEmployeId: "emp-1", taches: [task("mine"), { ...task("client", "en_cours", "client-1"), origine: "societe" }] }));
    expect(data.taskRows.map((item) => item.id)).toEqual(["mine"]);
    expect(data.otherTaskRows.map((item) => item.id)).toEqual(["client"]);
    expect(data.resumeTask?.id).toBe("mine");
    expect(data.taskCounts.en_cours).toBe(1);
    expect(data.team).toEqual([]);
  });
  it("narrows admin tasks, collections and societies without impersonating messages", () => {
    const source = dashboardInput({ selectedEmployeeId: "emp-1", societes: [society(), society("soc-2")], collaborateurs: [employee(), employee("emp-2", ["soc-2"])], taches: [task("mine"), { ...task("other", "en_cours", "emp-2"), societeId: "soc-2" }], collectes: [collection(), { ...collection("other"), societeId: "soc-2" }], conversations: [{ id: "viewer", type: "groupe", titre: "Cabinet", employeId: null, societeId: null, dernierMessage: "Bonjour", dernierMessageLe: "2026-09-30T08:00:00Z", nonLus: 4, enLigne: false }] });
    const scoped = scopeDashboardInput(source);
    expect(scoped.societes.map((item) => item.id)).toEqual(["soc-1"]);
    expect(scoped.collectes.map((item) => item.id)).toEqual(["col-1"]);
    expect(scoped.conversations).toBe(source.conversations);
    expect(scoped.viewerEmployeId).toBeNull();
    const data = buildDashboardData(source);
    expect(data.kpis.find((item) => item.id === "messages")?.value).toBe(4);
    expect(data.team.map((item) => item.id)).toEqual(["emp-1"]);
    expect(buildDashboardData({ ...source, selectedEmployeeId: "missing" }).taskRows).toEqual([]);
    expect(scopeDashboardInput({ ...source, role: "collaborateur" }).societes).toBe(source.societes);
  });
  it("date strip crosses month boundaries and filters collection dates only", () => {
    expect(dashboardDateStrip(NOW).map(dashboardDateKey)).toEqual(["2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05"]);
    const data = buildDashboardData(dashboardInput({ collectes: [collection(), collection("tomorrow", "2026-10-01", "transmis"), collection("closed", "2026-09-30", "valide")] }));
    expect(transmissionRows(data.deadlines, "2026-09-30").selected.map((item) => item.id)).toEqual(["col-1"]);
    expect(transmissionRows(data.deadlines, "2026-10-01").selected[0].statut).toBe("transmis");
    expect(data.deadlines.some((item) => item.id === "first")).toBe(false);
  });
  it("does not hide older unread conversations behind the bounded activity preview", () => {
    const conversations = Array.from({ length: 10 }, (_, index) => ({ id: `${index}`, type: "groupe" as const, titre: `${index}`, employeId: null, societeId: null, dernierMessage: "Message", dernierMessageLe: `2026-09-${String(30 - index).padStart(2, "0")}T08:00:00Z`, nonLus: index === 9 ? 2 : 0, enLigne: false }));
    const data = buildDashboardData(dashboardInput({ conversations }));
    expect(data.recentMessages).toHaveLength(8);
    expect(data.unreadMessages[0].id).toBe("9");
  });
  it("keeps client surfaces restricted and true empty work explicit", () => {
    const client = buildDashboardData(dashboardInput({ role: "societe_employe" }));
    expect(client.taskRows).toEqual([]);
    expect(client.team).toEqual([]);
    expect(client.kpis.some((item) => item.id === "tasks" || item.id === "clients")).toBe(false);
    const empty = buildDashboardData(dashboardInput({ taches: [], collectes: [] }));
    expect(empty.resumeTask).toBeNull();
    expect(empty.deadlines).toEqual([]);
  });
});
