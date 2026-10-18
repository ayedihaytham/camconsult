// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { api } from "@/lib/api";
import { ExistingDocumentPicker } from "./ExistingDocumentPicker";
vi.mock("@/lib/api", () => ({ api: { get: vi.fn(), post: vi.fn() } }));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
function open(onSelect = vi.fn().mockResolvedValue(true)) {
  const onClose = vi.fn();
  render(
    <MemoryRouter>
      <ExistingDocumentPicker
        societeId="soc"
        parentType="facture"
        parentId="invoice"
        busy={false}
        onClose={onClose}
        onSelect={onSelect}
      />
    </MemoryRouter>,
  );
  return { onSelect, onClose };
}
it("shows loading and an actionable empty state when there are no matching documents", async () => {
  vi.mocked(api.post).mockResolvedValue({
    id: "folder",
    chemin: "CAM / Apurement TVA / 2026 / T3 / Factures",
  });
  vi.mocked(api.get).mockResolvedValue([]);
  open();
  expect(screen.getByRole("status").textContent).toContain("Chargement");
  await screen.findByText("Aucun document compatible trouvé");
  expect(
    screen
      .getByRole("link", { name: /Ouvrir ce dossier/ })
      .getAttribute("href"),
  ).toBe("/structuration?societe=soc&dossier=folder");
  expect(vi.mocked(api.get).mock.calls[0][0]).toContain("folderId=folder");
});
it("displays request errors and allows retry instead of silently hiding the picker", async () => {
  vi.mocked(api.post).mockRejectedValueOnce(new Error("Dossier inaccessible"));
  open();
  expect((await screen.findByRole("alert")).textContent).toBe(
    "Dossier inaccessible",
  );
  vi.mocked(api.post).mockResolvedValue({
    id: "folder",
    chemin: "CAM / Apurement TVA",
  });
  vi.mocked(api.get).mockResolvedValue([]);
  fireEvent.click(screen.getByRole("button", { name: "Actualiser" }));
  await screen.findByText("Aucun document compatible trouvé");
});
it("associates the chosen source and closes only after a successful save", async () => {
  const source = {
    id: "document",
    source: "noeud",
    nom: "facture.pdf",
    chemin: "CAM / Apurement TVA / facture.pdf",
  };
  vi.mocked(api.post).mockResolvedValue({
    id: "folder",
    chemin: "CAM / Apurement TVA",
  });
  vi.mocked(api.get).mockResolvedValue([source]);
  const save = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  const { onSelect, onClose } = open(save);
  await screen.findByText("facture.pdf");
  fireEvent.click(screen.getByRole("radio"));
  fireEvent.click(screen.getByRole("button", { name: "Associer le document" }));
  await waitFor(() => expect(onSelect).toHaveBeenCalledWith(source));
  await screen.findByRole("alert");
  expect(onClose).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Associer le document" }));
  await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  expect(onClose).toHaveBeenCalledOnce();
});
