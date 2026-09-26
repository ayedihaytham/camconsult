// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { createRef } from "react";
import { CollecteGrid, type CollecteGridHandle } from "./CollecteGrid";
import { TAB_BY_KEY } from "@/lib/collecte/tabs";

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderGrid(key: string, onSave = vi.fn().mockResolvedValue(undefined)) {
  const ref = createRef<CollecteGridHandle>();
  render(
    <CollecteGrid
      ref={ref}
      def={TAB_BY_KEY[key]}
      lignes={[]}
      readOnly={false}
      devise="TND"
      onSave={onSave}
    />,
  );
  return { ref, onSave };
}

describe("CollecteGrid add-row drawer", () => {
  it("opens without adding a row or dirtying the grid, then cancels cleanly", () => {
    const { ref } = renderGrid("bordereaux_remise_cheques");
    fireEvent.click(screen.getByRole("button", { name: "Ajouter une ligne" }));

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Aucune ligne. Cliquez sur « Ajouter une ligne ».")).toBeTruthy();
    expect(ref.current?.isDirty()).toBe(false);
    expect(screen.getByRole("button", { name: "Enregistrer", hidden: true }).hasAttribute("disabled")).toBe(true);

    fireEvent.change(screen.getByLabelText("Banque"), { target: { value: "BNA" } });
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
    expect(ref.current?.isDirty()).toBe(false);
    expect(screen.getByText("Aucune ligne. Cliquez sur « Ajouter une ligne ».")).toBeTruthy();
  });

  it("keeps invalid input in the drawer and stages a completed bordereau only after submit", () => {
    const { ref } = renderGrid("bordereaux_remise_cheques");
    fireEvent.click(screen.getByRole("button", { name: "Ajouter une ligne" }));
    expect(screen.getByText("Nouvelle remise de chèques")).toBeTruthy();
    expect(screen.getByLabelText("Date de remise")).toBeTruthy();
    expect(screen.getByLabelText("N° Bordereau")).toBeTruthy();
    expect(screen.getByLabelText("Banque")).toBeTruthy();
    expect(screen.getByLabelText("N° Chèque")).toBeTruthy();
    expect(screen.getByLabelText("Nom du client émetteur (nominatif)")).toBeTruthy();
    expect(screen.getByLabelText("Montant (TND)")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Ajouter la ligne" }));
    expect(within(screen.getByRole("dialog")).getByRole("alert").textContent).toContain("au moins un champ");
    expect(ref.current?.isDirty()).toBe(false);

    fireEvent.change(screen.getByLabelText("N° Bordereau"), { target: { value: "REM-42" } });
    fireEvent.change(screen.getByLabelText("Banque"), { target: { value: "BNA" } });
    fireEvent.change(screen.getByLabelText("Montant (TND)"), { target: { value: "1250.5" } });
    fireEvent.click(screen.getByRole("button", { name: "Ajouter la ligne" }));

    expect(ref.current?.isDirty()).toBe(true);
    expect(screen.getByRole("button", { name: "Enregistrer" }).hasAttribute("disabled")).toBe(false);
    expect(screen.getByDisplayValue("REM-42")).toBeTruthy();
    expect(screen.getByDisplayValue("BNA")).toBeTruthy();
    expect(screen.getByDisplayValue("1250.5")).toBeTruthy();
  });

  it("keeps the first cash row limited to the opening balance", () => {
    const { ref } = renderGrid("etat_caisse");
    fireEvent.click(screen.getByRole("button", { name: "Ajouter une ligne" }));
    const drawer = screen.getByRole("dialog");
    expect(within(drawer).getByText("Solde initial")).toBeTruthy();
    expect(within(drawer).queryByLabelText("Entrée (TND)")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Ajouter la ligne" }));
    expect(ref.current?.isDirty()).toBe(false);
    fireEvent.change(within(drawer).getByLabelText("Solde (TND)"), { target: { value: "500" } });
    fireEvent.click(screen.getByRole("button", { name: "Ajouter la ligne" }));
    expect(ref.current?.isDirty()).toBe(true);
  });

  it("keeps staged rows until the existing save succeeds and discards only local changes", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { ref } = renderGrid("bordereaux_remise_cheques", onSave);
    fireEvent.click(screen.getByRole("button", { name: "Ajouter une ligne" }));
    fireEvent.change(screen.getByLabelText("N° Bordereau"), { target: { value: "REM-42" } });
    fireEvent.click(screen.getByRole("button", { name: "Ajouter la ligne" }));

    expect(onSave).not.toHaveBeenCalled();
    expect(ref.current?.isDirty()).toBe(true);
    await act(async () => ref.current?.save());
    expect(onSave).toHaveBeenCalledWith([
      { data: expect.objectContaining({ num_bordereau: "REM-42" }), ordre: 0 },
    ]);
    expect(ref.current?.isDirty()).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Ajouter une ligne" }));
    fireEvent.change(screen.getByLabelText("N° Bordereau"), { target: { value: "REM-43" } });
    fireEvent.click(screen.getByRole("button", { name: "Ajouter la ligne" }));
    expect(ref.current?.isDirty()).toBe(true);
    act(() => ref.current?.discard());
    expect(ref.current?.isDirty()).toBe(false);
    expect(screen.getByDisplayValue("REM-42")).toBeTruthy();
    expect(screen.queryByDisplayValue("REM-43")).toBeNull();
  });

  it("retains staged changes when the existing save fails", async () => {
    const onSave = vi.fn().mockRejectedValue(new Error("network"));
    const { ref } = renderGrid("virements_recus", onSave);
    fireEvent.click(screen.getByRole("button", { name: "Ajouter une ligne" }));
    fireEvent.change(screen.getByLabelText("Émetteur du virement"), { target: { value: "Client" } });
    fireEvent.click(screen.getByRole("button", { name: "Ajouter la ligne" }));

    await expect(act(async () => ref.current?.save())).rejects.toThrow("network");
    expect(ref.current?.isDirty()).toBe(true);
    expect(screen.getByDisplayValue("Client")).toBeTruthy();
  });
});
