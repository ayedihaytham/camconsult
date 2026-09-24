import { describe, expect, it } from "vitest";
import type { AppNotification, Conversation, PermissionKey } from "@/types";
import {
  hasPendingNotification,
  isChildRouteActive,
  isRouteActive,
  unreadMessageCount,
  visibleNavigation,
  type NavGroup,
} from "./navigation";

const allowAll = () => true;
const denyMessaging = (permission: PermissionKey) =>
  permission !== "messagerie";

function destinations(groups: NavGroup[]) {
  return groups.flatMap((group) =>
    group.items.flatMap((item) => [
      ...(item.to ? [item.to] : []),
      ...(item.children?.map((child) => child.to) ?? []),
    ]),
  );
}

describe("sidebar navigation policy", () => {
  it("keeps every destination for an administrator", () => {
    const routes = destinations(
      visibleNavigation({
        isAdmin: true,
        lectureSeule: false,
        can: allowAll,
      }),
    );

    expect(routes).toEqual([
      "/",
      "/societes",
      "/employes",
      "/taches",
      "/collectes",
      "/stock",
      "/etats-financiers",
      "/grille-affectat",
      "/bordereaux",
      "/honoraires",
      "/structuration",
      "/messagerie",
      "/journal",
      "/parametres",
    ]);
  });

  it("gives the collaborateurs destination (and nothing else admin-only) to a responsable des collaborateurs", () => {
    const routes = destinations(
      visibleNavigation({
        isAdmin: false,
        lectureSeule: false,
        can: allowAll,
        canManageCollaborateurs: true,
      }),
    );

    expect(routes).toEqual([
      "/",
      "/societes",
      "/employes",
      "/taches",
      "/collectes",
      "/stock",
      "/etats-financiers",
      "/structuration",
      "/messagerie",
    ]);
  });

  it("removes admin destinations and denied messaging for a collaborator", () => {
    const routes = destinations(
      visibleNavigation({
        isAdmin: false,
        lectureSeule: false,
        can: denyMessaging,
      }),
    );

    expect(routes).toEqual([
      "/",
      "/societes",
      "/taches",
      "/collectes",
      "/stock",
      "/etats-financiers",
      "/structuration",
    ]);
  });

  it("keeps only permitted client-company destinations in read-only mode", () => {
    const routes = destinations(
      visibleNavigation({
        isAdmin: false,
        lectureSeule: true,
        can: allowAll,
      }),
    );

    expect(routes).toEqual([
      "/",
      "/taches",
      "/collectes",
      "/structuration",
      "/messagerie",
    ]);
  });
});

describe("sidebar route state", () => {
  it("matches dashboard exactly and leaf detail routes by path segment", () => {
    expect(isRouteActive("/", "/")).toBe(true);
    expect(isRouteActive("/collectes", "/")).toBe(false);
    expect(isRouteActive("/stock/societe-1", "/stock")).toBe(true);
    expect(isRouteActive("/stockage", "/stock")).toBe(false);
  });

  it("preserves parent child-prefix matching", () => {
    expect(
      isChildRouteActive("/etats-financiers/societe-1", [
        { label: "Balance", to: "/etats-financiers" },
      ]),
    ).toBe(true);
  });
});

describe("sidebar indicators", () => {
  const notifications: AppNotification[] = [
    {
      id: "notification-1",
      type: "document",
      titre: "Document",
      corps: "",
      lien: "/collectes/collecte-1",
      lu: false,
      creeLe: "2026-09-17T00:00:00.000Z",
    },
  ];

  it("matches pending notifications to their navigation ancestor", () => {
    expect(hasPendingNotification(notifications, "/collectes")).toBe(true);
    expect(hasPendingNotification(notifications, "/")).toBe(false);
  });

  it("counts the same conversations as the former sidebar", () => {
    const conversations: Conversation[] = [
      {
        id: "direct-mine",
        type: "direct",
        employeId: "employee-1",
        societeId: null,
        dernierMessage: "",
        dernierMessageLe: "",
        nonLus: 2,
        enLigne: false,
      },
      {
        id: "direct-other",
        type: "direct",
        employeId: "employee-2",
        societeId: null,
        dernierMessage: "",
        dernierMessageLe: "",
        nonLus: 4,
        enLigne: false,
      },
      {
        id: "group",
        type: "groupe",
        employeId: null,
        societeId: null,
        dernierMessage: "",
        dernierMessageLe: "",
        nonLus: 3,
        enLigne: false,
      },
    ];

    expect(unreadMessageCount(conversations, false, "employee-1")).toBe(5);
    expect(unreadMessageCount(conversations, true, null)).toBe(9);
  });
});
