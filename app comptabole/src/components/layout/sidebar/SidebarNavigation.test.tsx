// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Building2, ClipboardList, LayoutDashboard, ListChecks } from "lucide-react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { SidebarNavigation } from "./SidebarNavigation";
import type { NavGroup } from "./navigation";

beforeAll(() => {
  // jsdom n'a pas matchMedia, que le menu consulte pour savoir s'il est sur mobile.
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
});
afterEach(cleanup);

const groupes: NavGroup[] = [
  { items: [{ label: "Dashboard", to: "/", icon: LayoutDashboard }] },
  {
    label: "Clients & travail",
    items: [
      { label: "Tâches", to: "/taches", icon: ListChecks },
      { label: "Sociétés", icon: Building2, children: [{ label: "Liste des sociétés", to: "/societes" }, { label: "Collaborateurs", to: "/employes" }] },
    ],
  },
  { label: "Comptabilité", items: [{ label: "Apurement TVA", to: "/apurement", icon: ClipboardList }] },
];

const monter = (chemin = "/") =>
  render(
    <MemoryRouter initialEntries={[chemin]}>
      <SidebarProvider>
        <SidebarNavigation groups={groupes} unreadMessages={0} unreadNotifications={[]} />
      </SidebarProvider>
    </MemoryRouter>,
  );

const titre = (nom: string) => screen.getByRole("button", { name: new RegExp(`^${nom}`) });

describe("menu latéral : titres de groupe repliables", () => {
  it("chaque groupe est ouvert au départ, et son titre est un bouton", () => {
    monter();
    expect(titre("Overview").getAttribute("aria-expanded")).toBe("true");
    expect(titre("Clients & travail").getAttribute("aria-expanded")).toBe("true");
    expect(titre("Comptabilité").getAttribute("aria-expanded")).toBe("true");
  });

  it("un clic replie le groupe, un second clic le rouvre", () => {
    monter();
    const bouton = titre("Comptabilité");
    const contenu = document.getElementById(bouton.getAttribute("aria-controls") as string) as HTMLElement;
    fireEvent.click(bouton);
    expect(bouton.getAttribute("aria-expanded")).toBe("false");
    expect(contenu.getAttribute("aria-hidden")).toBe("true");
    expect(contenu.hasAttribute("inert")).toBe(true);
    fireEvent.click(bouton);
    expect(bouton.getAttribute("aria-expanded")).toBe("true");
    expect(contenu.getAttribute("aria-hidden")).toBe("false");
    expect(contenu.hasAttribute("inert")).toBe(false);
  });

  it("replier un groupe ne touche pas les autres", () => {
    monter();
    fireEvent.click(titre("Comptabilité"));
    expect(titre("Clients & travail").getAttribute("aria-expanded")).toBe("true");
    expect(titre("Overview").getAttribute("aria-expanded")).toBe("true");
  });

  it("les pages d'un groupe replié restent dans la page (pour la navigation au clavier, elles sont inertes)", () => {
    monter();
    const bouton = titre("Comptabilité");
    const contenu = document.getElementById(bouton.getAttribute("aria-controls") as string) as HTMLElement;
    fireEvent.click(bouton);
    expect(within(contenu).getByText("Apurement TVA")).toBeTruthy();
    expect(contenu.hasAttribute("inert")).toBe(true);
  });
});

describe("menu latéral : page active", () => {
  it("la page affichée est marquée active, pas les autres", () => {
    monter("/taches");
    expect(screen.getByRole("link", { name: "Tâches" }).closest("[data-active]")?.getAttribute("data-active")).toBe("true");
    expect(screen.getByRole("link", { name: "Dashboard" }).closest("[data-active]")?.getAttribute("data-active")).toBe("false");
  });

  it("une sous-page active ouvre son menu et c'est elle qui porte l'état actif", () => {
    monter("/employes");
    const sousPage = screen.getByRole("link", { name: "Collaborateurs" });
    expect(sousPage.getAttribute("data-active")).toBe("true");
    expect(screen.getByRole("link", { name: "Liste des sociétés" }).getAttribute("data-active")).toBe("false");
  });
});
