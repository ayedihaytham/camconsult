import { describe, expect, it } from "vitest";
import { Building2, Calculator } from "lucide-react";
import type { AppNotification, Conversation, PermissionKey } from "@/types";
import {
  cheminAutoriseClient,
  getActiveExpandableGroupId,
  hasPendingNotification,
  isChildRouteActive,
  isRouteActive,
  toggleExpandableGroup,
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
      "/fournisseurs",
      "/banque",
      "/etats-financiers",
      "/grille-affectat",
      "/bordereaux",
      "/facturation",
      "/honoraires",
      "/souche-cheques",
      "/suivi-devise",
      "/structuration",
      "/messagerie",
      "/conversions",
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
      "/fournisseurs",
      "/banque",
      "/etats-financiers",
      "/suivi-devise",
      "/structuration",
      "/messagerie",
      "/conversions",
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
      "/fournisseurs",
      "/banque",
      "/etats-financiers",
      "/suivi-devise",
      "/structuration",
      "/conversions",
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

describe("État client pour le responsable de société", () => {
  it("le responsable de société voit État client (lecture seule), pas son délégué", () => {
    const base = { isAdmin: false, lectureSeule: true, can: allowAll };
    expect(
      destinations(visibleNavigation({ ...base, isResponsableSociete: true })),
    ).toEqual([
      "/",
      "/taches",
      "/collectes",
      "/fournisseurs",
      "/banque",
      "/honoraires",
      "/structuration",
      "/messagerie",
    ]);
    const delegue = destinations(visibleNavigation({ ...base, isResponsableSociete: false }));
    expect(delegue).not.toContain("/honoraires");
    expect(delegue).not.toContain("/fournisseurs");
    expect(delegue).not.toContain("/banque");
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

  it("opens only the expandable parent matching the current route", () => {
    const groups: NavGroup[] = [
      {
        label: "Clients & travail",
        items: [
          {
            label: "Sociétés",
            icon: Building2,
            children: [{ label: "Liste des sociétés", to: "/societes" }],
          },
        ],
      },
      {
        label: "Comptabilité",
        items: [
          {
            label: "États financiers",
            icon: Calculator,
            children: [{ label: "Balance", to: "/etats-financiers" }],
          },
        ],
      },
    ];

    expect(getActiveExpandableGroupId("/etats-financiers/societe-1", groups))
      .toBe("États financiers");
    expect(getActiveExpandableGroupId("/taches", groups)).toBeNull();
  });

  it("toggles the open group and closes the previous group when another opens", () => {
    expect(toggleExpandableGroup(null, "Sociétés")).toBe("Sociétés");
    expect(toggleExpandableGroup("Sociétés", "États financiers"))
      .toBe("États financiers");
    expect(toggleExpandableGroup("Sociétés", "Sociétés")).toBeNull();
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

describe("espace du compte de société cliente", () => {
  it("ne garde que le Dashboard et la Collecte de pièces", () => {
    const routes = destinations(
      visibleNavigation({ isAdmin: false, lectureSeule: true, can: allowAll, isResponsableSociete: true, espaceCollecteSeul: true }),
    );
    expect(routes).toEqual(["/", "/collectes"]);
  });

  it("n'y change rien pour le cabinet", () => {
    const routes = destinations(visibleNavigation({ isAdmin: true, lectureSeule: false, can: allowAll, espaceCollecteSeul: false }));
    expect(routes).toContain("/stock");
    expect(routes).toContain("/messagerie");
  });

  it("n'autorise que le Dashboard et les collectes comme adresses", () => {
    for (const ok of ["/", "/collectes", "/collectes/abc-123"]) expect(cheminAutoriseClient(ok)).toBe(true);
    for (const non of ["/taches", "/fournisseurs", "/banque/s1", "/honoraires", "/structuration", "/messagerie", "/parametres", "/collectes-autre"]) {
      expect(cheminAutoriseClient(non)).toBe(false);
    }
  });
});
