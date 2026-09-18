import { describe, expect, it } from "vitest";
import { getAppBreadcrumbs, type BreadcrumbData } from "./breadcrumbs";

const data: BreadcrumbData = {
  societes: [{ id: "soc-73d9a8", raisonSociale: "Atlas Conseil SARL" }],
  collectes: [
    {
      id: "collecte-73d9a8",
      societeId: "soc-73d9a8",
      periode: "Septembre 2026",
    },
  ],
  balances: [{ id: "balance-73d9a8", exercice: "2026" }],
};

describe("getAppBreadcrumbs", () => {
  it.each([
    ["/", "Dashboard"],
    ["/societes", "Sociétés"],
    ["/employes", "Collaborateurs"],
    ["/taches", "Tâches"],
    ["/collectes", "Collecte de pièces"],
    ["/stock", "Gestion de stock"],
    ["/etats-financiers", "États financiers"],
    ["/grille-affectat", "Grille de reclassement"],
    ["/bordereaux", "Bordereaux bancaires"],
    ["/structuration", "Structuration"],
    ["/messagerie", "Messagerie"],
    ["/journal", "Journal"],
    ["/parametres", "Paramètres"],
  ])("résout %s vers %s", (pathname, label) => {
    expect(getAppBreadcrumbs(pathname, data)).toEqual([{ label }]);
  });

  it("résout une société dans le stock", () => {
    expect(getAppBreadcrumbs("/stock/soc-73d9a8", data)).toEqual([
      { label: "Gestion de stock", to: "/stock" },
      { label: "Atlas Conseil SARL" },
    ]);
  });

  it("résout une collecte sans exposer son identifiant", () => {
    expect(getAppBreadcrumbs("/collectes/collecte-73d9a8", data)).toEqual([
      { label: "Collecte de pièces", to: "/collectes" },
      { label: "Atlas Conseil SARL · Septembre 2026" },
    ]);
  });

  it("résout les routes financières profondes", () => {
    expect(
      getAppBreadcrumbs(
        "/etats-financiers/soc-73d9a8/balance-73d9a8",
        data,
      ),
    ).toEqual([
      { label: "États financiers", to: "/etats-financiers" },
      {
        label: "Atlas Conseil SARL",
        to: "/etats-financiers/soc-73d9a8",
      },
      { label: "Balance 2026" },
    ]);

    expect(
      getAppBreadcrumbs("/etats-financiers/soc-73d9a8/imprimer", data),
    ).toEqual([
      { label: "États financiers", to: "/etats-financiers" },
      {
        label: "Atlas Conseil SARL",
        to: "/etats-financiers/soc-73d9a8",
      },
      { label: "Impression" },
    ]);
  });

  it("utilise des libellés sûrs pendant le chargement des données", () => {
    const emptyData: BreadcrumbData = {
      societes: [],
      collectes: [],
      balances: [],
    };
    const paths = [
      "/stock/73d9a8-secret",
      "/collectes/73d9a8-secret",
      "/etats-financiers/73d9a8-secret",
      "/etats-financiers/73d9a8-secret/balance-secret",
    ];

    for (const pathname of paths) {
      const rendered = getAppBreadcrumbs(pathname, emptyData)
        .map((crumb) => crumb.label)
        .join(" > ");
      expect(rendered).not.toContain("73d9a8");
      expect(rendered).not.toContain("secret");
    }
  });
});
