// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, renderHook, screen } from "@testing-library/react";
import type { Noeud, Societe } from "@/types";
import { useSocieteActiveStore } from "@/store/societeActive";
import { COMMUN, useGroupeAnnee } from "./useGroupeAnnee";
import { VueGenerale } from "./VueGenerale";

beforeAll(() => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() });
});
afterEach(() => {
  cleanup();
  useSocieteActiveStore.setState({ societeId: null });
});

const noeud = (id: string, libelle: string, type: "dossier" | "fichier", parentId: string | null, societeId: string | null): Noeud =>
  ({ id, libelle, type, parentId, description: "", societeId, creeLe: "2026-01-10T08:00:00Z", majLe: "2026-01-10T08:00:00Z" }) as unknown as Noeud;

// Deux sociétés avec une arborescence (CAM, CARGO), une troisième sans (VIDE), et une arborescence commune.
const NODES = [
  noeud("rc", "CAM", "dossier", null, "cam"),
  noeud("cc", "Comptabilité 2026", "dossier", "rc", "cam"),
  noeud("ca", "achat-cam", "dossier", "cc", "cam"),
  noeud("rg", "CARGO", "dossier", null, "cargo"),
  noeud("cg", "Comptabilité 2026", "dossier", "rg", "cargo"),
  noeud("cb", "banque-cargo", "dossier", "cg", "cargo"),
  noeud("rm", "MODELE", "dossier", null, null),
];
const ROOTS = NODES.filter((n) => n.parentId === null);
const noms: Record<string, string> = { cam: "CAM", cargo: "05-I CARGO LINE", vide: "SANS ARBO" };
const getSocieteById = (id: string | null) => (id ? ({ id, raisonSociale: noms[id] ?? id } as unknown as Societe) : null);

const hook = () => renderHook(() => useGroupeAnnee(NODES, ROOTS, getSocieteById));

describe("société de la structuration = société de la barre du haut", () => {
  it("société active : la page affiche cette société, jamais une autre", () => {
    useSocieteActiveStore.setState({ societeId: "cam" });
    expect(hook().result.current.groupe?.cle).toBe("cam");
    cleanup();
    useSocieteActiveStore.setState({ societeId: "cargo" });
    expect(hook().result.current.groupe?.cle).toBe("cargo");
  });

  it("changer la société dans la barre du haut change celle de la page", () => {
    useSocieteActiveStore.setState({ societeId: "cam" });
    const { result } = hook();
    expect(result.current.groupe?.cle).toBe("cam");
    act(() => useSocieteActiveStore.getState().setSocieteId("cargo"));
    expect(result.current.groupe?.cle).toBe("cargo");
  });

  it("choisir une société dans la page la rend active dans la barre du haut", () => {
    const { result } = hook();
    act(() => result.current.setChoix("cargo"));
    expect(useSocieteActiveStore.getState().societeId).toBe("cargo");
    expect(result.current.groupe?.cle).toBe("cargo");
  });

  it("« Commun » (arborescences sans société) : aucune société active, la page montre le commun", () => {
    useSocieteActiveStore.setState({ societeId: "cam" });
    const { result } = hook();
    act(() => result.current.setChoix(COMMUN));
    expect(useSocieteActiveStore.getState().societeId).toBeNull();
    expect(result.current.groupe?.cle).toBe(COMMUN);
  });

  it("« Toutes les sociétés » : la page garde son propre choix, la première société au départ", () => {
    const { result } = hook();
    expect(useSocieteActiveStore.getState().societeId).toBeNull();
    expect(result.current.groupe?.cle).toBe("cargo"); // ordre alphabétique des libellés : « 05-I CARGO LINE » avant « CAM »
    expect(result.current.sansArborescence).toBe(false);
  });

  it("société active sans arborescence : aucune autre société n'est montrée, et on le dit", () => {
    useSocieteActiveStore.setState({ societeId: "vide" });
    const { result } = hook();
    expect(result.current.groupe).toBeUndefined();
    expect(result.current.sansArborescence).toBe(true);
  });
});

describe("vue générale suit la société active", () => {
  it("montre l'armoire de la société active (et non celle de la première société)", () => {
    useSocieteActiveStore.setState({ societeId: "cam" });
    render(<VueGenerale nodes={NODES} roots={ROOTS} getSocieteById={getSocieteById} onOpenNode={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Tiroir achat-cam/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Tiroir banque-cargo/ })).toBeNull();
  });

  it("société active sans arborescence : message clair, aucun tiroir d'une autre société", () => {
    useSocieteActiveStore.setState({ societeId: "vide" });
    render(<VueGenerale nodes={NODES} roots={ROOTS} getSocieteById={getSocieteById} onOpenNode={vi.fn()} />);
    expect(screen.getByText(/La société active n'a pas encore d'arborescence/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Tiroir/ })).toBeNull();
  });
});
