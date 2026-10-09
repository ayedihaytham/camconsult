// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { CoursChange, DeviseChange } from "@/types";
import { CoursSuggere } from "@/components/common/CoursSuggere";
import { CoursChangePage } from "./CoursChangePage";

const { etat, perms } = vi.hoisted(() => ({
  etat: {
    devises: [] as DeviseChange[],
    cours: [] as CoursChange[],
    charge: true,
    fetch: vi.fn().mockResolvedValue(undefined),
    saveAnnee: vi.fn().mockResolvedValue(undefined),
    addDevise: vi.fn().mockResolvedValue(undefined),
    removeDevise: vi.fn().mockResolvedValue(undefined),
  },
  perms: { canManageCollaborateurs: true },
}));
vi.mock("@/store/coursChange", () => ({
  useCoursChange: Object.assign((selector?: (s: typeof etat) => unknown) => (selector ? selector(etat) : etat), { getState: () => etat }),
}));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => perms }));

const annee = new Date().getFullYear();

beforeEach(() => {
  etat.devises = [
    { code: "USD", libelle: "Dollar des USA", unite: 1, ordre: 1 },
    { code: "EUR", libelle: "Euro", unite: 1, ordre: 2 },
  ];
  etat.cours = [
    { devise: "EUR", annee, mois: 1, cours: 3.3167 },
    { devise: "USD", annee, mois: 1, cours: 3.2 },
    { devise: "EUR", annee: annee - 1, mois: 12, cours: 3.4 },
  ];
  perms.canManageCollaborateurs = true;
  for (const f of [etat.saveAnnee, etat.addDevise, etat.removeDevise]) f.mockClear().mockResolvedValue(undefined);
});
afterEach(cleanup);

const rendre = () => render(<MemoryRouter><CoursChangePage /></MemoryRouter>);

describe("page Cours de change", () => {
  it("affiche les mois en lignes et les devises en colonnes pour l'année choisie", () => {
    rendre();
    expect(screen.getByRole("columnheader", { name: /EUR/ })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: /USD/ })).toBeTruthy();
    expect((screen.getByLabelText(`EUR Janvier ${annee}`) as HTMLInputElement).value).toBe("3,3167");
    expect((screen.getByLabelText(`USD Février ${annee}`) as HTMLInputElement).value).toBe("");
    expect(screen.getAllByRole("rowheader").map((r) => r.textContent).slice(0, 3)).toEqual(["Janvier", "Février", "Mars"]);
  });

  it("change d'année et en liste les années déjà renseignées", () => {
    rendre();
    expect(screen.getByRole("button", { name: String(annee - 1) }).getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: String(annee - 1) }));
    expect((screen.getByLabelText(`EUR Décembre ${annee - 1}`) as HTMLInputElement).value).toBe("3,4");
    fireEvent.click(screen.getByRole("button", { name: "Année précédente" }));
    expect(screen.getByText(String(annee - 2), { selector: "span" })).toBeTruthy();
  });

  it("n'enregistre que ce qui a changé, et efface un mois vidé", async () => {
    rendre();
    fireEvent.change(screen.getByLabelText(`EUR Février ${annee}`), { target: { value: "3,3128" } });
    fireEvent.change(screen.getByLabelText(`USD Janvier ${annee}`), { target: { value: "" } });
    expect(screen.getByText("2 modifications non enregistrées")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: `Enregistrer ${annee}` }));
    await waitFor(() => expect(etat.saveAnnee).toHaveBeenCalledTimes(1));
    expect(etat.saveAnnee).toHaveBeenCalledWith(annee, [
      { devise: "USD", mois: 1, cours: null },
      { devise: "EUR", mois: 2, cours: 3.3128 },
    ]);
  });

  it("refuse un cours qui n'est pas un nombre positif", () => {
    rendre();
    fireEvent.change(screen.getByLabelText(`EUR Mars ${annee}`), { target: { value: "abc" } });
    expect(screen.getByLabelText(`EUR Mars ${annee}`).getAttribute("aria-invalid")).toBe("true");
    expect((screen.getByRole("button", { name: `Enregistrer ${annee}` }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(`EUR Mars ${annee}`), { target: { value: "-2" } });
    expect(screen.getByLabelText(`EUR Mars ${annee}`).getAttribute("aria-invalid")).toBe("true");
  });

  it("ajoute une devise avec son code, son libellé et son unité", async () => {
    rendre();
    fireEvent.click(screen.getByRole("button", { name: /Ajouter une devise/ }));
    const dialogue = screen.getByRole("dialog");
    fireEvent.change(within(dialogue).getByLabelText(/Code/), { target: { value: "jpy" } });
    fireEvent.change(within(dialogue).getByLabelText(/Libellé/), { target: { value: "Yen japonais" } });
    fireEvent.change(within(dialogue).getByLabelText(/Unité de cotation/), { target: { value: "1000" } });
    fireEvent.click(within(dialogue).getByRole("button", { name: "Ajouter" }));
    await waitFor(() => expect(etat.addDevise).toHaveBeenCalledWith({ code: "JPY", libelle: "Yen japonais", unite: 1000 }));
  });

  it("refuse une devise déjà présente", () => {
    rendre();
    fireEvent.click(screen.getByRole("button", { name: /Ajouter une devise/ }));
    fireEvent.change(within(screen.getByRole("dialog")).getByLabelText(/Code/), { target: { value: "eur" } });
    expect(screen.getByRole("alert").textContent).toContain("EUR existe déjà");
    expect((within(screen.getByRole("dialog")).getByRole("button", { name: "Ajouter" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("importe un tableau collé, année par année", async () => {
    rendre();
    fireEvent.click(screen.getByRole("button", { name: /Coller un tableau/ }));
    const dialogue = screen.getByRole("dialog");
    fireEvent.change(within(dialogue).getByLabelText("Tableau de cours à coller"), {
      target: { value: "Dollar (USD)\tEuro (EUR)\n31/01/2025\t3,2000\t3,3167\n31/12/2026\t2,9\t3,4" },
    });
    expect(within(dialogue).getByRole("status").textContent).toContain("4 cours lus pour USD, EUR");
    fireEvent.click(within(dialogue).getByRole("button", { name: "Importer 4 cours" }));
    await waitFor(() => expect(etat.saveAnnee).toHaveBeenCalledTimes(2));
    expect(etat.saveAnnee).toHaveBeenCalledWith(2025, [
      { devise: "USD", mois: 1, cours: 3.2 },
      { devise: "EUR", mois: 1, cours: 3.3167 },
    ]);
  });

  it("est en lecture seule pour un collaborateur", () => {
    perms.canManageCollaborateurs = false;
    rendre();
    expect((screen.getByLabelText(`EUR Janvier ${annee}`) as HTMLInputElement).readOnly).toBe(true);
    expect(screen.queryByRole("button", { name: /Ajouter une devise/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Enregistrer/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Supprimer la devise/ })).toBeNull();
  });
});

describe("cours proposé dans une facture", () => {
  const rendreSuggestion = (devise: string, date: string, courant = 0) => {
    const onAppliquer = vi.fn();
    render(<MemoryRouter><CoursSuggere devise={devise} date={date} courant={courant} onAppliquer={onAppliquer} /></MemoryRouter>);
    return onAppliquer;
  };

  it("propose le cours moyen du mois de la date et l'applique d'un clic", () => {
    const onAppliquer = rendreSuggestion("eur", `${annee}-01-20`);
    expect(screen.getByText(/Cours moyen EUR de Janvier/).textContent).toContain("3,3167");
    fireEvent.click(screen.getByRole("button", { name: "Appliquer" }));
    expect(onAppliquer).toHaveBeenCalledWith(3.3167);
  });

  it("indique quand il est déjà appliqué", () => {
    rendreSuggestion("EUR", `${annee}-01-20`, 3.3167);
    expect(screen.getByText("Appliqué")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Appliquer" })).toBeNull();
  });

  it("dit qu'aucun cours n'existe pour le mois, avec un lien vers la page des cours", () => {
    rendreSuggestion("USD", `${annee}-05-02`);
    expect(screen.getByText(/Aucun cours USD pour Mai/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Cours de change" }).getAttribute("href")).toBe("/cours-change");
  });

  it("ne propose rien pour le dinar, sans devise, et demande la date quand elle manque", () => {
    const { container } = render(<MemoryRouter><CoursSuggere devise="TND" date="2025-01-01" courant={0} onAppliquer={vi.fn()} /></MemoryRouter>);
    expect(container.textContent).toBe("");
    cleanup();
    const vide = render(<MemoryRouter><CoursSuggere devise="" date="2025-01-01" courant={0} onAppliquer={vi.fn()} /></MemoryRouter>);
    expect(vide.container.textContent).toBe("");
    cleanup();
    rendreSuggestion("EUR", "");
    expect(screen.getByText(/Renseignez la date/)).toBeTruthy();
  });
});
