// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { Eye } from "lucide-react";
import { SocietesVolet, societeInitials } from "./SocietesVolet";
import type { Collecte, Societe } from "@/types";

afterEach(cleanup);

const societe = (id: string, raisonSociale: string, statut: Societe["statut"] = "actif"): Societe => ({ id, raisonSociale, rne: `RNE-${id}`, tva: "", theme: "PME", code: `S-${id}`, statut, telephone: "", email: "", adresse: "", creeLe: "2026-09-01T08:00:00Z" });
const collecte = (societeId: string, statut: Collecte["statut"]): Collecte => ({ id: `c-${societeId}`, societeId, periode: "Octobre 2026", statut, onglets: [], devise: "TND", echeance: "2026-10-30", derniereRelanceLe: null, relanceCadenceJours: 3, creeLe: "2026-09-01T08:00:00Z", majLe: "2026-09-28T08:00:00Z", transmisLe: null, valideLe: null });

function monter(patch: Partial<React.ComponentProps<typeof SocietesVolet>> = {}) {
  const props: React.ComponentProps<typeof SocietesVolet> = {
    societes: [societe("b", "Zèbre SARL"), societe("a", "Alpha SA"), societe("c", "Gamma", "en_attente")],
    loading: false,
    emptyMessage: "Aucune société enregistrée.",
    voitTaches: true,
    libelleCollecte: "Collecte d'octobre",
    contactPrincipal: new Map([["a", { nom: "KARIM BEN SALAH", role: "Responsable" as const, delegues: 2 }]]),
    collecteDuMois: new Map([["a", collecte("a", "transmis")], ["b", collecte("b", "a_corriger")]]),
    openTaskCount: new Map([["a", 3]]),
    dossiersParSociete: new Map([["a", 14]]),
    onOpenFiche: vi.fn(),
    onOpenDossiers: vi.fn(),
    menuActions: () => [{ icon: Eye, label: "Voir la fiche", onClick: () => {} }, { icon: Eye, label: "Modifier", onClick: () => {} }],
    ...patch,
  };
  return { props, ...render(<SocietesVolet {...props} />) };
}

describe("Registre des sociétés : liste et volet", () => {
  it("liste les sociétés par ordre alphabétique et ouvre la première dans le volet", () => {
    monter();
    const liste = screen.getByRole("list", { name: "Sociétés" });
    expect(within(liste).getAllByRole("button").map((bouton) => bouton.querySelector("span.truncate")?.textContent)).toEqual(["Alpha SA", "Gamma", "Zèbre SARL"]);
    expect(screen.getByRole("heading", { name: "Alpha SA" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Alpha SA/ }).getAttribute("aria-current")).toBe("true");
  });

  it("le volet affiche le contact en casse normale, les tâches ouvertes, les dossiers et l'avancement écrit de la collecte", () => {
    monter();
    expect(screen.getByText("Karim Ben Salah")).toBeTruthy();
    expect(screen.getByText("Responsable · 2 délégués")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByText("14")).toBeTruthy();
    expect(screen.getByRole("img", { name: /Transmise/ })).toBeTruthy();
  });

  it("choisir une autre société change le volet ; sans contact ni collecte, le volet le dit", () => {
    monter();
    fireEvent.click(screen.getByRole("button", { name: /Gamma/ }));
    expect(screen.getByRole("heading", { name: "Gamma" })).toBeTruthy();
    const detail = within(screen.getByRole("region", { name: "Détail de Gamma" }));
    expect(detail.getByText("Aucun contact")).toBeTruthy();
    expect(detail.getByText("Aucune collecte")).toBeTruthy();
    expect(detail.getByText("En attente")).toBeTruthy();
  });

  it("les flèches du clavier parcourent la liste", () => {
    monter();
    fireEvent.keyDown(screen.getByRole("list", { name: "Sociétés" }), { key: "ArrowDown" });
    expect(screen.getByRole("heading", { name: "Gamma" })).toBeTruthy();
    fireEvent.keyDown(screen.getByRole("list", { name: "Sociétés" }), { key: "ArrowUp" });
    expect(screen.getByRole("heading", { name: "Alpha SA" })).toBeTruthy();
  });

  it("« Ouvrir la fiche » et « Voir les dossiers » agissent sur la société choisie ; le menu ne répète pas ces deux actions", () => {
    const { props } = monter();
    fireEvent.click(screen.getByRole("button", { name: "Ouvrir la fiche" }));
    expect(props.onOpenFiche).toHaveBeenCalledWith(expect.objectContaining({ id: "a" }));
    fireEvent.click(screen.getByRole("button", { name: "Voir les dossiers" }));
    expect(props.onOpenDossiers).toHaveBeenCalledWith(expect.objectContaining({ id: "a" }));
  });

  it("sans droit sur les tâches, ni collecte ni tâches ne sont montrées", () => {
    monter({ voitTaches: false });
    expect(screen.queryByText("Tâches ouvertes")).toBeNull();
    expect(screen.queryByText("Collecte d'octobre")).toBeNull();
    expect(screen.getByText("Dossiers")).toBeTruthy();
  });

  it("chargement et liste vide sont annoncés", () => {
    monter({ loading: true });
    expect(screen.getByRole("status", { name: "Chargement des sociétés" })).toBeTruthy();
    cleanup();
    monter({ societes: [] });
    expect(screen.getByText("Aucune société enregistrée.")).toBeTruthy();
  });

  it("les initiales suivent le numéro d'ordre, sinon deux mots, sinon deux lettres", () => {
    expect(societeInitials("05-I CA")).toBe("05");
    expect(societeInitials("Port Sud")).toBe("PS");
    expect(societeInitials("Cam")).toBe("CA");
  });
});
