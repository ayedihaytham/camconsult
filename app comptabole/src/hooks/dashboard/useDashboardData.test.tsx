// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { useDashboardData } from "./useDashboardData";
import { useAuth } from "@/store/auth";
import { useData } from "@/store/data";
import { useCollectes } from "@/store/collectes";
import { useBordereaux } from "@/store/bordereaux";
import { useJournal } from "@/store/journal";
import { collection, dashboardInput, employee, session, society, task } from "@/lib/dashboard/dashboardFixtures.test-support";

const originals = { collectes: useCollectes.getState().fetchList, bordereaux: useBordereaux.getState().fetchList, journal: useJournal.getState().fetch };
const fetchCollectes = vi.fn(async () => { useCollectes.setState({ list: [collection()] }); });
const fetchBordereaux = vi.fn(async () => {});
const fetchJournal = vi.fn(async () => { useJournal.setState({ error: false }); });

beforeEach(() => {
  vi.clearAllMocks();
  fetchCollectes.mockImplementation(async () => { useCollectes.setState({ list: [collection()] }); });
  fetchBordereaux.mockImplementation(async () => {});
  fetchJournal.mockImplementation(async () => { useJournal.setState({ error: false }); });
  const input = dashboardInput();
  useData.setState({ hydrated: true, societes: input.societes, employes: input.collaborateurs, taches: input.taches, noeuds: [], notifications: [], messages: [], groupConversations: [] });
  useAuth.setState({ status: "authed", session: session() });
  useCollectes.setState({ list: [], fetchList: fetchCollectes });
  useBordereaux.setState({ list: [], fetchList: fetchBordereaux });
  useJournal.setState({ entries: [], error: false, fetch: fetchJournal });
});
afterEach(() => {
  cleanup();
  useCollectes.setState({ fetchList: originals.collectes });
  useBordereaux.setState({ fetchList: originals.bordereaux });
  useJournal.setState({ fetch: originals.journal });
});

describe("Dashboard orchestration and roles", () => {
  it("changes the local admin lens without additional requests or changing viewer messages", async () => {
    useData.setState({ societes: [society(), society("soc-2")], employes: [employee(), employee("emp-2", ["soc-2"])], taches: [task("mine"), { ...task("other", "en_cours", "emp-2"), societeId: "soc-2" }], messages: [{ id: "m1", conversationId: "conv-emp-2", auteurId: "emp-2", contenu: "Bonjour", envoyeLe: "2026-09-30T08:00:00Z", statut: "envoye" }] });
    const { result, rerender } = renderHook(({ id }) => useDashboardData(id), { initialProps: { id: null as string | null } });
    await waitFor(() => expect(result.current.collectesLoading).toBe(false));
    await waitFor(() => expect(result.current.adminDataLoading).toBe(false));
    const unread = result.current.data.kpis.find((item) => item.id === "messages")?.value;
    rerender({ id: "emp-1" });
    expect(result.current.data.taskRows.map((item) => item.id)).toEqual(["mine"]);
    expect(result.current.data.kpis.find((item) => item.id === "messages")?.value).toBe(unread);
    expect(fetchCollectes).toHaveBeenCalledTimes(1);
    expect(fetchBordereaux).toHaveBeenCalledTimes(1);
    expect(fetchJournal).toHaveBeenCalledTimes(1);
  });
  it.each(["collaborateur", "responsable_collaborateurs"] as const)("keeps %s distinct from Admin", async (poste) => {
    useAuth.setState({ session: session(poste) });
    const { result } = renderHook(() => useDashboardData("emp-2"));
    await waitFor(() => expect(result.current.collectesLoading).toBe(false));
    expect(result.current.role).toBe("collaborateur");
    expect(result.current.employeeOptions).toEqual([]);
    expect(result.current.data.team).toEqual([]);
    expect(fetchBordereaux).not.toHaveBeenCalled();
    expect(fetchJournal).not.toHaveBeenCalled();
  });
  it("keeps client Dashboard data restricted", async () => {
    useAuth.setState({ session: session("societe_employe") });
    const { result } = renderHook(() => useDashboardData());
    await waitFor(() => expect(result.current.collectesLoading).toBe(false));
    expect(result.current.role).toBe("societe_employe");
    expect(result.current.data.taskRows).toEqual([]);
    expect(fetchJournal).not.toHaveBeenCalled();
  });
  it("masks stale collections on failure and recovers through the existing retry", async () => {
    useCollectes.setState({ list: [collection()] });
    fetchCollectes.mockRejectedValueOnce(new Error("Unavailable"));
    const { result } = renderHook(() => useDashboardData());
    await waitFor(() => expect(result.current.collectesError).toBe(true));
    expect(result.current.data.deadlines).toEqual([]);
    expect(result.current.data.taskRows.length).toBeGreaterThan(0);
    await act(async () => { await result.current.retryCollectes(); });
    expect(result.current.collectesError).toBe(false);
    expect(result.current.data.deadlines).toHaveLength(1);
  });
  it("reports a swallowed journal failure as partial data", async () => {
    fetchJournal.mockImplementationOnce(async () => { useJournal.setState({ error: true }); });
    const { result } = renderHook(() => useDashboardData());
    await waitFor(() => expect(result.current.adminDataLoading).toBe(false));
    expect(result.current.adminDataError).toBe(true);
    expect(result.current.data.journalEntries).toEqual([]);
    act(() => result.current.retryAdminData());
    await waitFor(() => expect(result.current.adminDataError).toBe(false));
  });
  it("keeps healthy journal activity when only the bank source fails", async () => {
    const entry = { id: "j1", at: "2026-09-30T08:00:00Z", actor: "Cabinet", action: "creation" as const, entity: "societe" as const, label: "Société créée" };
    fetchJournal.mockImplementationOnce(async () => { useJournal.setState({ entries: [entry], error: false }); });
    fetchBordereaux.mockRejectedValueOnce(new Error("Unavailable"));
    const { result } = renderHook(() => useDashboardData());
    await waitFor(() => expect(result.current.adminDataLoading).toBe(false));
    expect(result.current.adminDataError).toBe(true);
    expect(result.current.journalError).toBe(false);
    expect(result.current.data.journalEntries).toEqual([entry]);
  });
});
