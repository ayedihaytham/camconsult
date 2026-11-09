// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ColonnesDialog } from "./ColonnesDialog";
import type { PdfTextItem } from "@/lib/pdfToTables";

afterEach(cleanup);
beforeAll(() => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() });
});

const t = (str: string, x: number, y: number): PdfTextItem => ({ str, x, y, w: str.length * 5, h: 10 });
const page = [
  t("Jour", 40, 700), t("Opération", 120, 700), t("Entrée", 330, 700), t("Sortie", 420, 700),
  t("03/02/2026", 40, 680), t("Retrait", 120, 680), t("50,00", 420, 680),
  t("04/02/2026", 40, 660), t("Virement", 120, 660), t("900,00", 330, 660),
];

describe("assistant « Indiquer les colonnes »", () => {
  it("devine les colonnes d'après l'en-tête et applique le choix", () => {
    window.localStorage.clear();
    const onValider = vi.fn();
    render(<ColonnesDialog open onOpenChange={vi.fn()} pages={[page]} onValider={onValider} />);
    expect((screen.getByLabelText("Contenu de la colonne 1") as HTMLSelectElement).value).toBe("date");
    expect((screen.getByLabelText("Contenu de la colonne 2") as HTMLSelectElement).value).toBe("libelle");
    expect((screen.getByLabelText("Contenu de la colonne 3") as HTMLSelectElement).value).toBe("credit");
    expect((screen.getByLabelText("Contenu de la colonne 4") as HTMLSelectElement).value).toBe("debit");
    fireEvent.click(screen.getByRole("button", { name: "Utiliser ces colonnes" }));
    expect(onValider).toHaveBeenCalledWith(expect.objectContaining({ roles: ["date", "libelle", "credit", "debit"] }));
  });

  it("refuse sans colonne Date, et retient le choix pour un relevé de même forme", () => {
    window.localStorage.clear();
    const onValider = vi.fn();
    const { unmount } = render(<ColonnesDialog open onOpenChange={vi.fn()} pages={[page]} onValider={onValider} />);
    fireEvent.change(screen.getByLabelText("Contenu de la colonne 1"), { target: { value: "" } });
    expect((screen.getByRole("button", { name: "Utiliser ces colonnes" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("alert").textContent).toMatch(/Date/);
    fireEvent.change(screen.getByLabelText("Contenu de la colonne 1"), { target: { value: "date" } });
    fireEvent.change(screen.getByLabelText("Contenu de la colonne 2"), { target: { value: "reference" } });
    fireEvent.click(screen.getByRole("button", { name: "Utiliser ces colonnes" }));
    unmount();
    render(<ColonnesDialog open onOpenChange={vi.fn()} pages={[page]} onValider={vi.fn()} />);
    expect((screen.getByLabelText("Contenu de la colonne 2") as HTMLSelectElement).value).toBe("reference");
  });

  it("sans ligne datée, le dit", () => {
    render(<ColonnesDialog open onOpenChange={vi.fn()} pages={[[t("Titre", 40, 700)]]} onValider={vi.fn()} />);
    expect(screen.getByText(/Aucune ligne datée/)).toBeTruthy();
  });
});
