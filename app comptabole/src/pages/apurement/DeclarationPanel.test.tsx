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
import { DeclarationPanel } from "./DeclarationPanel";
vi.mock("@/lib/api", () => ({ api: { get: vi.fn() } }));
vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({ canManageCollaborateurs: false }),
}));
vi.mock("./DocumentsPanel", () => ({
  downloadApurement: vi.fn(),
  DocumentsPanel: ({
    onPiecesChanged,
  }: {
    onPiecesChanged: (pieces: { id: string; nom: string }[]) => void;
  }) => (
    <button
      onClick={() => onPiecesChanged([{ id: "piece", nom: "facture.pdf" }])}
    >
      Ajouter le document de recette
    </button>
  ),
}));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
it("keeps declaration evidence visible when an attachment is added", async () => {
  const declaration = {
    id: "declaration",
    version: 1,
    statut: "brouillon",
    snapshotHash: null,
  };
  vi.mocked(api.get).mockImplementation(async (path) =>
    path.includes("/declarations?")
      ? [declaration]
      : path.endsWith("/declarations/declaration")
        ? declaration
        : [],
  );
  render(
    <MemoryRouter>
      <DeclarationPanel
        societeId="soc"
        annee={2026}
        trimestre="T3"
        selectedId="declaration"
      />
    </MemoryRouter>,
  );
  const summary = await screen.findByText(
    "Justificatifs de cette déclaration · 0 pièce(s)",
  );
  const details = summary.closest("details")!;
  await waitFor(() => expect(details.open).toBe(true));
  fireEvent.click(
    screen.getByRole("button", { name: "Ajouter le document de recette" }),
  );
  await screen.findByText("Justificatifs de cette déclaration · 1 pièce(s)");
  expect(details.open).toBe(true);
});
