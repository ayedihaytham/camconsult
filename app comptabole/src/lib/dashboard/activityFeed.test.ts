import { describe, expect, it } from "vitest";
import { buildActivityItems, dayLabel, groupConsecutive, hourlyRhythm, ACTIVITY_LIMIT, type ActivityItem } from "./activityFeed";
import { buildDashboardData } from "./dashboardData";
import { dashboardInput } from "./dashboardFixtures.test-support";
import type { JournalEntry } from "@/store/journal";

const NOW = new Date("2026-10-20T16:30:00");
const entry = (id: string, at: string, actor = "Mohamed Ayedi", action: JournalEntry["action"] = "modification", label = `Élément ${id}`): JournalEntry => ({ id, at, actor, action, entity: "societe", label });
const item = (id: string, at: string, patch: Partial<ActivityItem> = {}): ActivityItem => ({ id, source: "Journal", title: "Mohamed Ayedi", description: id, at, action: "modification", ...patch });

describe("regroupement des écritures du journal", () => {
  it("regroupe celles qui se suivent avec le même acteur, la même action et la même minute", () => {
    const groups = groupConsecutive([item("a", "2026-10-20T07:02:05"), item("b", "2026-10-20T07:02:30"), item("c", "2026-10-20T07:02:59"), item("d", "2026-10-20T06:10:00")]);
    expect(groups.map((g) => g.items.map((i) => i.id))).toEqual([["a", "b", "c"], ["d"]]);
    expect(groups[0].key).toBe("a");
  });

  it("ne regroupe ni deux minutes différentes, ni deux acteurs, ni deux actions, ni autre chose que le journal", () => {
    expect(groupConsecutive([item("a", "2026-10-20T07:02:00"), item("b", "2026-10-20T07:03:00")])).toHaveLength(2);
    expect(groupConsecutive([item("a", "2026-10-20T07:02:00"), item("b", "2026-10-20T07:02:10", { title: "Sara" })])).toHaveLength(2);
    expect(groupConsecutive([item("a", "2026-10-20T07:02:00"), item("b", "2026-10-20T07:02:10", { action: "creation" })])).toHaveLength(2);
    expect(groupConsecutive([item("a", "2026-10-20T07:02:00", { source: "Fichier", action: undefined }), item("b", "2026-10-20T07:02:10", { source: "Fichier", action: undefined })])).toHaveLength(2);
  });

  it("ne regroupe pas des écritures séparées par un autre événement (ordre chronologique conservé)", () => {
    const groups = groupConsecutive([item("a", "2026-10-20T07:02:10"), item("x", "2026-10-20T07:02:05", { source: "Message", action: undefined }), item("b", "2026-10-20T07:02:01")]);
    expect(groups).toHaveLength(3);
  });
});

describe("fil d'activité", () => {
  it("assemble fichiers, messages et journal (administrateur), les plus récents d'abord, 16 au plus", () => {
    const journalEntries = Array.from({ length: 20 }, (_, i) => entry(`j${i}`, `2026-10-20T${String(i).padStart(2, "0")}:00:00`));
    const data = { ...buildDashboardData(dashboardInput()), journalEntries };
    const items = buildActivityItems(data, true);
    expect(items).toHaveLength(ACTIVITY_LIMIT);
    expect(items[0].at >= items[1].at).toBe(true);
  });

  it("sans droit de messagerie : pas de messages ; hors administrateur : pas de journal", () => {
    const base = dashboardInput({ journalEntries: [entry("j1", "2026-10-20T10:00:00")] });
    const admin = buildDashboardData(base);
    const messages = [{ id: "m1", label: "Discussion", initials: "DI", preview: "Bonjour", updatedAt: "2026-10-20T09:00:00Z", unread: 1, online: true }];
    expect(buildActivityItems({ ...admin, recentMessages: messages }, true).some((i) => i.source === "Message")).toBe(true);
    expect(buildActivityItems({ ...admin, recentMessages: messages }, false).some((i) => i.source === "Message")).toBe(false);
    expect(buildActivityItems({ ...admin, role: "collaborateur" }, true).some((i) => i.source === "Journal")).toBe(false);
  });
});

describe("jours et rythme", () => {
  it("classe en Aujourd'hui, Hier, Cette semaine, Plus ancien", () => {
    expect(dayLabel("2026-10-20T01:00:00", NOW)).toBe("Aujourd'hui");
    expect(dayLabel("2026-10-19T23:00:00", NOW)).toBe("Hier");
    expect(dayLabel("2026-10-16T12:00:00", NOW)).toBe("Cette semaine");
    expect(dayLabel("2026-10-01T12:00:00", NOW)).toBe("Plus ancien");
  });

  it("compte les événements d'aujourd'hui par heure, de 7 h à 19 h au minimum, élargi si besoin ; ignore hier", () => {
    const r = hourlyRhythm([item("a", "2026-10-20T07:02:00"), item("b", "2026-10-20T07:40:00"), item("c", "2026-10-20T15:57:00"), item("hier", "2026-10-19T10:00:00")], NOW);
    expect(r[0]).toEqual({ hour: 7, count: 2 });
    expect(r.find((h) => h.hour === 15)?.count).toBe(1);
    expect(r.find((h) => h.hour === 10)?.count).toBe(0);
    expect(r[r.length - 1].hour).toBe(19);
    const tot = hourlyRhythm([item("t", "2026-10-20T05:10:00")], NOW);
    expect(tot[0].hour).toBe(5);
  });
});
