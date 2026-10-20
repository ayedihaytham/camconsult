// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ActivityTab } from "./tabs/ActivityTab";
import { buildDashboardData } from "@/lib/dashboard/dashboardData";
import { dashboardInput, NOW } from "@/lib/dashboard/dashboardFixtures.test-support";
import type { JournalEntry } from "@/store/journal";

afterEach(cleanup);

const entree = (id: string, at: string, label: string, actor = "Mohamed Ayedi", action: JournalEntry["action"] = "modification"): JournalEntry => ({ id, at, actor, action, entity: "societe", label });
const JOURNAL = [
  entree("1", "2026-09-30T08:57:10", "2026-0003 — facture électronique préparée", "Mohamed Ayedi", "creation"),
  entree("2", "2026-09-30T07:02:40", "BTL TNC"),
  entree("3", "2026-09-30T07:02:20", "BTL USD"),
  entree("4", "2026-09-30T07:02:05", "BTL EUR"),
  entree("5", "2026-09-29T17:40:00", "Brouillon de bordereau", "Karim Trabelsi", "suppression"),
];
const base = buildDashboardData(dashboardInput());
const donnees = (patch = {}) => ({
  ...base,
  journalEntries: JOURNAL,
  recentFiles: [{ id: "f1", name: "releve.pdf", format: "pdf", societeName: "Atlas Conseil", updatedAt: "2026-09-30T09:30:00" }],
  recentMessages: [{ id: "m1", label: "Port Sud Logistique", initials: "PS", preview: "Question sur la facture", updatedAt: "2026-09-30T09:00:00", unread: 2, online: true }],
  ...patch,
});
const monter = (patch = {}, props = {}) => render(<MemoryRouter><ActivityTab data={donnees(patch)} canUseMessaging now={NOW} {...props} /></MemoryRouter>);

describe("onglet Activité du cabinet", () => {
  it("chronologie par jour : acteur, action du journal et source visibles ; écritures identiques d'une même minute regroupées", () => {
    const { container } = monter();
    expect(screen.getByRole("heading", { name: /Aujourd'hui/ })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /Hier/ })).toBeTruthy();
    expect(screen.getByText("Création")).toBeTruthy();
    expect(screen.getByText("Suppression")).toBeTruthy();
    expect(screen.getByText("3 modifications")).toBeTruthy();
    expect(screen.getByText("3 éléments à 07:02")).toBeTruthy();
    expect(container.querySelectorAll(".aat-event")).toHaveLength(5);
    expect(screen.queryByText("BTL TNC")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Voir les 3 éléments" }));
    ["BTL TNC", "BTL USD", "BTL EUR"].forEach((label) => expect(screen.getByText(label)).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Réduire" }));
    expect(screen.queryByText("BTL TNC")).toBeNull();
  });

  it("les filtres affichent leur compteur et ne gardent que la source choisie ; la recherche porte sur l'acteur et le libellé", () => {
    monter();
    expect(screen.getByRole("button", { name: "Tout 7" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Journal 5" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Fichier 1" }));
    expect(screen.getByText("releve.pdf")).toBeTruthy();
    expect(screen.queryByText("Port Sud Logistique")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Tout 7" }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Rechercher dans l’activité" }), { target: { value: "karim" } });
    expect(screen.getByText("Brouillon de bordereau")).toBeTruthy();
    expect(screen.queryByText("releve.pdf")).toBeNull();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "zzzz" } });
    expect(screen.getByText("Aucun résultat")).toBeTruthy();
  });

  it("messages : conversation, aperçu, non lus et présence ; fichiers et messages s'ouvrent dans leur module", () => {
    const { container } = monter();
    expect(screen.getByText("2 non lus")).toBeTruthy();
    expect(container.querySelector(".aat-dot.is-message i.is-online")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ouvrir message : Port Sud Logistique" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ouvrir fichier : releve.pdf" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Ouvrir journal/ })).toBeNull();
  });

  it("rythme d'aujourd'hui : compteurs par source, uniquement pour les éléments d'aujourd'hui", () => {
    const { container } = monter();
    const kpis = container.querySelector(".aat-kpis") as HTMLElement;
    expect(within(kpis).getByText("aujourd’hui").previousElementSibling?.textContent).toBe("6");
    expect(within(kpis).getByText("journal").previousElementSibling?.textContent).toBe("4");
    expect(within(kpis).getByText("fichiers").previousElementSibling?.textContent).toBe("1");
    expect(container.querySelectorAll(".aat-hour.is-active").length).toBeGreaterThan(0);
  });

  it("journal indisponible : message d'état, fichiers et messages restent consultables ; pas de lien Journal complet hors administrateur", () => {
    monter({ journalEntries: [] }, { error: true });
    expect(screen.getByRole("status").textContent).toContain("journal est indisponible");
    expect(screen.getByText("releve.pdf")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Journal complet/ }).getAttribute("href")).toBe("/journal");
    cleanup();
    monter({ role: "responsable" as never });
    expect(screen.queryByRole("link", { name: /Journal complet/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Journal/ })).toBeNull();
  });

  it("aucune activité : état vide qui annonce ce qui apparaîtra", () => {
    monter({ journalEntries: [], recentFiles: [], recentMessages: [] });
    expect(screen.getByText("Aucune activité récente")).toBeTruthy();
    expect(screen.queryByText(/chargé/)).toBeNull();
  });
});
