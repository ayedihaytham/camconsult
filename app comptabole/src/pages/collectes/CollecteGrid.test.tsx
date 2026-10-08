// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
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

const lignes = () => Array.from(document.querySelectorAll<HTMLTableRowElement>("tbody tr[data-row]"));
const champs = (ligne: HTMLElement) => Array.from(ligne.querySelectorAll<HTMLInputElement>("input"));
const ajouter = () => fireEvent.click(screen.getByRole("button", { name: "Ajouter une ligne" }));
const enregistrer = () => screen.getByRole("button", { name: "Enregistrer" });

describe("CollecteGrid : ajout de lignes directement dans le tableau", () => {
  it("ajoute une ligne vide dans le tableau, sans panneau, avec le curseur dans la première case", () => {
    const { ref } = renderGrid("bordereaux_remise_cheques");
    expect(screen.getByText("Aucune ligne. Cliquez sur « Ajouter une ligne ».")).toBeTruthy();
    ajouter();

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(lignes()).toHaveLength(1);
    expect(screen.queryByText("Aucune ligne. Cliquez sur « Ajouter une ligne ».")).toBeNull();
    expect(document.activeElement).toBe(champs(lignes()[0])[0]);
    // Une ligne restée vide n'est pas une modification.
    expect(ref.current?.isDirty()).toBe(false);
    expect(enregistrer().hasAttribute("disabled")).toBe(true);
  });

  it("ajoute les lignes les unes sous les autres et ne marque une modification qu'une fois la ligne écrite", () => {
    const { ref } = renderGrid("bordereaux_remise_cheques");
    ajouter();
    ajouter();
    ajouter();
    expect(lignes()).toHaveLength(3);
    expect(ref.current?.isDirty()).toBe(false);

    fireEvent.change(champs(lignes()[1])[1], { target: { value: "REM-42" } });
    expect(ref.current?.isDirty()).toBe(true);
    expect(enregistrer().hasAttribute("disabled")).toBe(false);
    expect(screen.getByDisplayValue("REM-42")).toBeTruthy();
  });

  it("ajoute la ligne suivante avec Entrée dans la dernière case d'une ligne remplie", () => {
    renderGrid("bordereaux_remise_cheques");
    ajouter();
    const dernier = () => {
      const cases = champs(lignes()[lignes().length - 1]);
      return cases[cases.length - 1];
    };
    // Une ligne vide ne multiplie pas les lignes.
    fireEvent.keyDown(dernier(), { key: "Enter" });
    expect(lignes()).toHaveLength(1);

    fireEvent.change(champs(lignes()[0])[1], { target: { value: "REM-1" } });
    fireEvent.keyDown(dernier(), { key: "Enter" });
    expect(lignes()).toHaveLength(2);
    expect(document.activeElement).toBe(champs(lignes()[1])[0]);
  });

  it("n'enregistre pas les lignes restées vides", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { ref } = renderGrid("bordereaux_remise_cheques", onSave);
    ajouter();
    ajouter();
    fireEvent.change(champs(lignes()[0])[1], { target: { value: "REM-42" } });
    await act(async () => ref.current?.save());

    expect(onSave).toHaveBeenCalledWith([{ data: expect.objectContaining({ num_bordereau: "REM-42" }), ordre: 0 }]);
    expect(lignes()).toHaveLength(1);
    expect(ref.current?.isDirty()).toBe(false);
  });

  it("garde la saisie quand l'enregistrement échoue, et l'abandonne avec discard()", async () => {
    const onSave = vi.fn().mockRejectedValue(new Error("network"));
    const { ref } = renderGrid("virements_recus", onSave);
    ajouter();
    fireEvent.change(champs(lignes()[0])[1], { target: { value: "Client" } });
    await act(async () => {
      await expect(ref.current?.save()).rejects.toThrow("network");
    });
    expect(ref.current?.isDirty()).toBe(true);
    expect(screen.getByDisplayValue("Client")).toBeTruthy();

    act(() => ref.current?.discard());
    expect(ref.current?.isDirty()).toBe(false);
    expect(screen.queryByDisplayValue("Client")).toBeNull();
  });

  it("garde le solde initial saisi dans la première ligne d'un état de caisse, les suivantes calculent le leur", () => {
    const { ref } = renderGrid("etat_caisse");
    ajouter();
    const solde = (i: number) => champs(lignes()[i])[4];
    expect(solde(0).readOnly).toBe(false);
    fireEvent.change(solde(0), { target: { value: "500" } });
    expect(ref.current?.isDirty()).toBe(true);

    ajouter();
    expect(solde(1).readOnly).toBe(true);
    fireEvent.change(champs(lignes()[1])[2], { target: { value: "100" } });
    expect(solde(1).value).toBe("600");
  });
});
