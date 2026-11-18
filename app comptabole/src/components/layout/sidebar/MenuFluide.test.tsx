// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { LayoutDashboard, Building2, Boxes } from "lucide-react";
import { PagesRecentes } from "./MenuFluide";
import type { NavGroup } from "./navigation";

const groupes: NavGroup[] = [
  {
    label: "Menu",
    items: [
      { label: "Tableau de bord", to: "/", icon: LayoutDashboard },
      { label: "Sociétés", to: "/societes", icon: Building2 },
      { label: "Stock", to: "/stock", icon: Boxes },
    ],
  },
];

const afficher = (chemin: string) =>
  render(
    <MemoryRouter initialEntries={[chemin]}>
      <PagesRecentes groups={groupes} />
    </MemoryRouter>,
  );

beforeEach(() => window.localStorage.clear());
afterEach(cleanup);

describe("pages récentes du menu", () => {
  it("n'affiche rien tant qu'une seule page a été visitée (la page affichée n'est jamais proposée)", () => {
    afficher("/societes");
    expect(screen.queryByRole("navigation", { name: "Pages récentes" })).toBeNull();
  });

  it("propose les pages visitées avant celle-ci, sans la page affichée", () => {
    window.localStorage.setItem("cabinet-menu-recents", JSON.stringify([{ label: "Stock", to: "/stock" }, { label: "Tableau de bord", to: "/" }]));
    afficher("/societes");
    const nav = screen.getByRole("navigation", { name: "Pages récentes" });
    expect(nav.textContent).toContain("Stock");
    expect(nav.textContent).toContain("Tableau de bord");
    expect(nav.textContent).not.toContain("Sociétés");
    expect(screen.getByRole("link", { name: "Stock" }).getAttribute("href")).toBe("/stock");
  });

  it("n'affiche pas une page que le compte ne voit plus dans son menu", () => {
    window.localStorage.setItem("cabinet-menu-recents", JSON.stringify([{ label: "Facturation", to: "/facturation" }, { label: "Stock", to: "/stock" }]));
    afficher("/societes");
    const nav = screen.getByRole("navigation", { name: "Pages récentes" });
    expect(nav.textContent).toContain("Stock");
    expect(nav.textContent).not.toContain("Facturation");
  });

  it("garde les 3 dernières au plus", () => {
    window.localStorage.setItem("cabinet-menu-recents", JSON.stringify([
      { label: "Stock", to: "/stock" }, { label: "Tableau de bord", to: "/" }, { label: "Sociétés", to: "/societes" },
    ]));
    afficher("/stock");
    const liens = screen.getAllByRole("link");
    expect(liens.length).toBeLessThanOrEqual(3);
  });
});
