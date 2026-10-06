import { describe, expect, it } from "vitest";
import type { NavGroup } from "@/components/layout/sidebar/navigation";
import {
  cheminPourSociete,
  ciblerNavigation,
  dossierDeSociete,
  lienDeSociete,
  societeIdFromPath,
} from "./societeContext";

describe("adresses par société", () => {
  it("lit la société dans l'adresse des modules concernés", () => {
    expect(societeIdFromPath("/stock/abc")).toBe("abc");
    expect(societeIdFromPath("/etats-financiers/abc/xyz")).toBe("abc");
    expect(societeIdFromPath("/etats-financiers/abc/imprimer")).toBe("abc");
    expect(societeIdFromPath("/suivi-devise/abc/s1")).toBe("abc");
    expect(societeIdFromPath("/honoraires/abc")).toBe("abc");
  });

  it("ne lit rien ailleurs", () => {
    expect(societeIdFromPath("/stock")).toBeNull();
    expect(societeIdFromPath("/")).toBeNull();
    expect(societeIdFromPath("/facturation")).toBeNull();
    expect(societeIdFromPath("/collectes/12")).toBeNull();
    expect(societeIdFromPath("/stockage/abc")).toBe(null);
  });

  it("change de société en gardant le module", () => {
    expect(cheminPourSociete("/stock/abc", "def")).toBe("/stock/def");
    expect(cheminPourSociete("/etats-financiers/abc/xyz", "def")).toBe("/etats-financiers/def");
    expect(cheminPourSociete("/stock", "def")).toBe("/stock/def");
  });

  it("revient à la liste du module pour « toutes les sociétés »", () => {
    expect(cheminPourSociete("/stock/abc", null)).toBe("/stock");
    expect(cheminPourSociete("/honoraires/abc", null)).toBe("/honoraires");
  });

  it("ne déplace pas hors d'un module par société", () => {
    expect(cheminPourSociete("/", "def")).toBeNull();
    expect(cheminPourSociete("/collectes", "def")).toBeNull();
  });
});

describe("liens du menu", () => {
  const groupes: NavGroup[] = [
    {
      items: [
        { label: "Dashboard", to: "/", icon: (() => null) as never },
        { label: "Stock", to: "/stock", icon: (() => null) as never },
        { label: "Collectes", to: "/collectes", icon: (() => null) as never },
        {
          label: "États financiers",
          icon: (() => null) as never,
          children: [
            { label: "Balance", to: "/etats-financiers" },
            { label: "Paramétrage", to: "/grille-affectat" },
          ],
        },
      ],
    },
  ];

  it("ouvre la société active pour les modules par société", () => {
    expect(lienDeSociete("/stock", "s1")).toBe("/stock/s1");
    expect(lienDeSociete("/collectes", "s1")).toBe("/collectes");
    expect(lienDeSociete("/stock", null)).toBe("/stock");
    const [g] = ciblerNavigation(groupes, "s1");
    expect(g.items.map((i) => i.to)).toEqual(["/", "/stock/s1", "/collectes", undefined]);
    expect(g.items[3].children?.map((c) => c.to)).toEqual(["/etats-financiers/s1", "/grille-affectat"]);
  });

  it("laisse le menu intact sans société active", () => {
    expect(ciblerNavigation(groupes, null)).toBe(groupes);
  });
});

describe("dossier d'une société", () => {
  const donnees = {
    societes: [{ id: "a" }, { id: "b" }],
    taches: [{ societeId: "a" }, { societeId: "b" }, { societeId: "a" }],
    noeuds: [{ societeId: "b" }, { societeId: "a" }],
    collectes: [{ societeId: "a" }, { societeId: "b" }],
    conversations: [{ societeId: "a" }, { societeId: null }],
    bordereaux: [{ id: 1 }],
    journalEntries: [{ id: 1 }],
  };

  it("garde les données de la société et retire celles qui ne s'y rattachent pas", () => {
    const d = dossierDeSociete(donnees, "a");
    expect(d.societes).toEqual([{ id: "a" }]);
    expect(d.taches).toHaveLength(2);
    expect(d.noeuds).toEqual([{ societeId: "a" }]);
    expect(d.collectes).toEqual([{ societeId: "a" }]);
    expect(d.conversations).toEqual([{ societeId: "a" }]);
    expect(d.bordereaux).toEqual([]);
    expect(d.journalEntries).toEqual([]);
  });

  it("ne change rien pour « toutes les sociétés »", () => {
    expect(dossierDeSociete(donnees, null)).toBe(donnees);
  });
});
