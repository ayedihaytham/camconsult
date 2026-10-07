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
});
