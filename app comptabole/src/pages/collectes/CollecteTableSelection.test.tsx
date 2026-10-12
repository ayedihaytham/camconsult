// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { COLLECTE_TABS } from "@/lib/collecte/tabs";
import { CollecteTableSelection } from "./CollecteTableSelection";

afterEach(cleanup);

describe("sélection des tableaux d'une collecte", () => {
  it("verrouille les tableaux déjà dans la collecte : ils ne se décochent ni un par un ni en bloc", () => {
    const onChange = vi.fn();
    render(<CollecteTableSelection selected={COLLECTE_TABS.map((t) => t.key)} verrouilles={["souche_cheques"]} onChange={onChange} />);
    const verrouille = screen.getByRole("checkbox", { name: "Souche de chèques" }) as HTMLButtonElement;
    expect(verrouille.disabled).toBe(true);
    expect((screen.getByRole("checkbox", { name: "Détail des achats" }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByText(/seul l'administrateur peut en retirer/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Tout décocher" }));
    expect(onChange).toHaveBeenCalledWith(["souche_cheques"]);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("sans verrou, tout se décoche (administrateur)", () => {
    const onChange = vi.fn();
    render(<CollecteTableSelection selected={["souche_cheques"]} onChange={onChange} />);
    expect((screen.getByRole("checkbox", { name: "Souche de chèques" }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByText(/seul l'administrateur peut en retirer/)).toBeNull();
  });
});
