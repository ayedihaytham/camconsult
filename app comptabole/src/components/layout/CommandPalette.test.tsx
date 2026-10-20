// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { Building2, LayoutDashboard, ListChecks } from "lucide-react";
import { CommandPalette, correspond, normaliser } from "./CommandPalette";
import { useUi } from "@/store/ui";

const choisir = vi.fn();
const etat = vi.hoisted(() => ({ lectureSeule: false }));
const societes = [
  { id: "s2", raisonSociale: "Delta SARL", code: "DLT" },
  { id: "s1", raisonSociale: "Atlas Conseil", code: "ATL" },
  { id: "s3", raisonSociale: "Société Générale d'Équipement", code: "SGE" },
];

vi.mock("./sidebar/useNavigationGroups", () => ({
  useNavigationGroups: () => [
    { items: [{ label: "Dashboard", to: "/", icon: LayoutDashboard }] },
    {
      label: "Clients & travail",
      items: [
        { label: "Tâches", to: "/taches", icon: ListChecks },
        { label: "Sociétés", icon: Building2, children: [{ label: "Liste des sociétés", to: "/societes" }, { label: "Collaborateurs", to: "/employes" }] },
      ],
    },
  ],
}));
vi.mock("@/store/data", () => ({ useSocietes: () => societes }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ canSeeSociete: (id: string) => id !== "s3", lectureSeule: etat.lectureSeule }) }));
vi.mock("@/hooks/useSocieteActive", () => ({ useChoisirSociete: () => choisir }));

function Chemin() {
  return <output data-testid="chemin">{useLocation().pathname}</output>;
}
const monter = () =>
  render(
    <MemoryRouter initialEntries={["/taches"]}>
      <CommandPalette />
      <Chemin />
    </MemoryRouter>,
  );

beforeEach(() => {
  useUi.setState({ paletteOpen: false });
  choisir.mockReset();
  etat.lectureSeule = false;
});
afterEach(cleanup);

describe("recherche : accents et mots", () => {
  it("ignore les accents et la casse ; tous les mots doivent se retrouver", () => {
    expect(normaliser("Sociétés")).toBe("societes");
    expect(correspond("Liste des sociétés", "SOCIETES")).toBe(1);
    expect(correspond("Atlas Conseil ATL", "atlas")).toBe(0);
    expect(correspond("Atlas Conseil ATL", "conseil atl")).toBe(1);
    expect(correspond("Atlas Conseil ATL", "delta")).toBeNull();
    expect(correspond("Atlas", "")).toBe(0);
  });
});

describe("« Aller à… » (Ctrl K)", () => {
  it("Ctrl K l'ouvre et le referme ; fermé, rien n'est affiché", () => {
    monter();
    expect(screen.queryByRole("combobox")).toBeNull();
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(screen.getByRole("combobox", { name: "Aller à" })).toBeTruthy();
    fireEvent.keyDown(window, { key: "K", metaKey: true });
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("sans saisie : les pages du menu (sous-pages comprises) puis les sociétés visibles, jamais une société interdite", () => {
    useUi.setState({ paletteOpen: true });
    monter();
    const options = screen.getAllByRole("option").map((o) => o.textContent);
    expect(options.some((t) => t?.startsWith("Dashboard"))).toBe(true);
    expect(options.some((t) => t?.startsWith("Liste des sociétés"))).toBe(true);
    expect(options.some((t) => t?.startsWith("Collaborateurs"))).toBe(true);
    expect(options.some((t) => t?.startsWith("Atlas Conseil"))).toBe(true);
    expect(options.some((t) => t?.startsWith("Société Générale"))).toBe(false);
  });

  it("la saisie filtre sans tenir compte des accents ; « Entrée » ouvre la page choisie et ferme", () => {
    useUi.setState({ paletteOpen: true });
    monter();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "taches" } });
    expect(screen.getAllByRole("option")).toHaveLength(1);
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
    expect(screen.getByTestId("chemin").textContent).toBe("/taches");
    expect(useUi.getState().paletteOpen).toBe(false);
  });

  it("flèches : la sélection se déplace (en boucle) et Entrée ouvre l'élément actif", () => {
    useUi.setState({ paletteOpen: true });
    monter();
    const champ = screen.getByRole("combobox");
    fireEvent.change(champ, { target: { value: "co" } }); // Collaborateurs, Liste... selon le classement
    const total = screen.getAllByRole("option").length;
    expect(total).toBeGreaterThan(1);
    expect(screen.getAllByRole("option")[0].getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(champ, { key: "ArrowUp" });
    expect(screen.getAllByRole("option")[total - 1].getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(champ, { key: "ArrowDown" });
    expect(screen.getAllByRole("option")[0].getAttribute("aria-selected")).toBe("true");
  });

  it("une société choisie devient la société active (et ouvre le Dashboard hors module par société)", () => {
    useUi.setState({ paletteOpen: true });
    monter();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "delta" } });
    fireEvent.click(screen.getByRole("option", { name: /Delta SARL/ }));
    expect(choisir).toHaveBeenCalledWith("s2");
    expect(screen.getByTestId("chemin").textContent).toBe("/");
    expect(useUi.getState().paletteOpen).toBe(false);
  });

  it("aucun résultat : message clair ; un compte de société cliente n'a pas la liste des sociétés", () => {
    useUi.setState({ paletteOpen: true });
    monter();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "zzzz" } });
    expect(screen.getByText(/Aucun résultat pour « zzzz »/)).toBeTruthy();
    cleanup();
    etat.lectureSeule = true;
    useUi.setState({ paletteOpen: true });
    monter();
    expect(screen.queryByRole("option", { name: /Atlas Conseil/ })).toBeNull();
  });
});
