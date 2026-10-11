// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TableauxNonDemandes } from "./TableauxNonDemandes";

afterEach(cleanup);
function openPopup(onAjouter = vi.fn().mockResolvedValue(undefined)) {
  render(<TableauxNonDemandes demandes={["virements_recus"]} onAjouter={onAjouter} />);
  fireEvent.click(screen.getByRole("button", { name: "Ajouter des tableaux" }));
  return { onAjouter, dialog: screen.getByRole("dialog", { name: "Ajouter des tableaux" }) };
}

describe("ajout de plusieurs tableaux", () => {
  it("commence sans sélection, masque les tableaux existants et ajoute la sélection en une fois", async () => {
    const { onAjouter, dialog } = openPopup();
    expect(within(dialog).queryByRole("checkbox", { checked: true })).toBeNull();
    expect(within(dialog).queryByRole("checkbox", { name: "Virements reçus" })).toBeNull();
    expect(within(dialog).getByRole("button", { name: "Ajouter (0)" }).hasAttribute("disabled")).toBe(true);
    fireEvent.click(within(dialog).getByText("Virements émis"));
    fireEvent.click(within(dialog).getByText("Traites escomptées"));
    expect(onAjouter).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Ajouter (2)" }));
    await waitFor(() => expect(onAjouter).toHaveBeenCalledWith(["virements_emis", "traites_escomptees"]));
    expect(onAjouter).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("annule sans mutation et repart sans sélection à la réouverture", () => {
    const { onAjouter, dialog } = openPopup();
    fireEvent.click(within(dialog).getByRole("checkbox", { name: "Virements émis" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Annuler" }));
    expect(onAjouter).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Ajouter des tableaux" }));
    expect(screen.queryByRole("checkbox", { checked: true })).toBeNull();
  });

  it("conserve la sélection après un échec pour réessayer", async () => {
    const onAjouter = vi.fn().mockRejectedValueOnce(new Error("Connexion")).mockResolvedValue(undefined);
    const { dialog } = openPopup(onAjouter);
    fireEvent.click(within(dialog).getByRole("checkbox", { name: "Virements émis" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Ajouter (1)" }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(within(dialog).getByRole("checkbox", { name: "Virements émis", checked: true })).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Ajouter (1)" }));
    await waitFor(() => expect(onAjouter).toHaveBeenCalledTimes(2));
  });

  it("verrouille la sélection et empêche les doublons pendant l'enregistrement", async () => {
    let finish!: () => void;
    const onAjouter = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    const { dialog } = openPopup(onAjouter);
    fireEvent.click(within(dialog).getByRole("checkbox", { name: "Virements émis" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Ajouter (1)" }));
    expect(within(dialog).getAllByRole("checkbox").every((checkbox) => checkbox.hasAttribute("disabled"))).toBe(true);
    fireEvent.click(within(dialog).getByRole("button", { name: "Ajout…" }));
    expect(onAjouter).toHaveBeenCalledOnce();
    await act(async () => finish());
  });
});
