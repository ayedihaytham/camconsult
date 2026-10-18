// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ConversionsPage } from "./ConversionsPage";

describe("page Conversions", () => {
  afterEach(cleanup);

  it("propose les deux sens et ouvre PDF vers Excel", () => {
    render(
      <MemoryRouter>
        <ConversionsPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole("button", { name: "Excel vers PDF" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "PDF vers Excel" })).toBeTruthy();
    // Par défaut : Excel vers PDF.
    expect(document.querySelector('input[type="file"]')?.getAttribute("accept")).toBe(".xlsx,.xls");

    fireEvent.click(screen.getByRole("button", { name: "PDF vers Excel" }));
    expect(document.querySelector('input[type="file"]')?.getAttribute("accept")).toBe(".pdf,application/pdf");
    expect(screen.getByText("Convertir les montants en nombres")).toBeTruthy();
    expect(screen.getByText("Toutes les pages dans une seule feuille")).toBeTruthy();
  });

  it("affiche le bandeau (traitement local, compteurs) et les options du PDF", () => {
    render(
      <MemoryRouter>
        <ConversionsPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "Conversions" })).toBeTruthy();
    expect(screen.getByText(/Traitement 100 % local/)).toBeTruthy();
    for (const l of ["Fichiers", "Convertis", "En erreur", "Feuilles"]) expect(screen.getByText(l)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Paysage" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "A3" })).toBeTruthy();
    expect(screen.getByText("En-tête avec titre et date")).toBeTruthy();
    expect(screen.getByText("Un seul PDF pour tous les fichiers")).toBeTruthy();
    expect(screen.getByText(/Ajoutez un fichier, puis cliquez/)).toBeTruthy();
  });

  it("glisser-déposer : seuls les fichiers du bon format sont convertis", async () => {
    render(
      <MemoryRouter>
        <ConversionsPage />
      </MemoryRouter>,
    );
    const zone = document.querySelector('[data-tour="conversions-upload"]') as HTMLElement;
    const texte = new File(["x"], "notes.txt", { type: "text/plain" });
    fireEvent.drop(zone, { dataTransfer: { files: [texte] } });
    // un .txt n'ajoute aucune ligne à la file
    expect(screen.queryByText("File de conversion")).toBeNull();
  });
});
