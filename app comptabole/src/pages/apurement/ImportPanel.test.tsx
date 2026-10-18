// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { api } from "@/lib/api";
import { ImportPanel } from "./ImportPanel";
import type { ImportPreview } from "@/lib/apurementImport";
vi.mock("@/lib/api", () => ({ api: { post: vi.fn() } }));
const preview: ImportPreview = {
  batchId: "batch",
  previewHash: "hash",
  profile: "observed",
  warnings: [
    { code: "BCD_ECART_PIED", message: "Écart de pied", tva: "13" },
    { code: "IDENTITE_DECLARANT_DIFFERENTE", message: "Identité différente" },
  ],
  rows: [
    {
      row: 2,
      numeroFacture: "DEMO-001",
      fournisseur: "DEMO",
      bcNumero: "000001",
      dateFacture: "2026-07-15",
      dateBrute: "",
      datePrecision: "day",
      montantHtMillimes: "1000000",
      tvaSuspendueMillimes: "190000",
      errors: [],
      warnings: [],
      duplicate: false,
      raw: [],
    },
  ],
};
beforeEach(() => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});
async function open(p = preview) {
  vi.mocked(api.post).mockResolvedValueOnce(p);
  render(
    <ImportPanel
      societeId="soc"
      societeName="SOCIETE DEMO"
      annee={2026}
      trimestre="T3"
      bcs={[]}
      onDone={vi.fn()}
    />,
  );
  fireEvent.change(screen.getByLabelText("Fichier", { exact: true }), {
    target: { files: [new File(["BCD"], "DEMO.txt")] },
  });
  fireEvent.change(
    screen.getByRole("spinbutton", { name: "Taux de TVA (%)" }),
    { target: { value: "19" } },
  );
  fireEvent.click(screen.getByRole("button", { name: "Prévisualiser" }));
  await screen.findByText("1 lignes reconnues");
}
it("prevents the reported 422 until source review and identity confirmation are explicit, then sends the reviewed batch", async () => {
  await open();
  fireEvent.click(screen.getByRole("checkbox", { name: "Importer ligne 2" }));
  const confirm = screen.getByRole("button", {
    name: /Confirmer l’import de 1/,
  }) as HTMLButtonElement;
  expect(confirm.disabled).toBe(true);
  fireEvent.change(
    screen.getByLabelText("Justification des écarts du fichier (obligatoire)"),
    { target: { value: "Écart synthétique et identité vérifiés" } },
  );
  expect(confirm.disabled).toBe(true);
  fireEvent.click(
    screen.getByRole("checkbox", {
      name: /J’ai vérifié que ce fichier appartient/,
    }),
  );
  expect(confirm.disabled).toBe(false);
  vi.mocked(api.post).mockResolvedValueOnce([
    { factureId: "invoice", action: "cree" },
  ]);
  fireEvent.click(confirm);
  await screen.findByText(/Import validé/);
  expect(api.post).toHaveBeenLastCalledWith("/apurement/imports/batch/commit", {
    previewHash: "hash",
    motifEcartPied: "Écart synthétique et identité vérifiés",
    rows: [{ row: 2, motif: "" }],
  });
  expect(vi.mocked(api.post).mock.calls).toHaveLength(2);
});
it("requires the row justification for an override and keeps decisions after a server conflict", async () => {
  await open({
    ...preview,
    warnings: [],
    rows: [
      {
        ...preview.rows[0],
        warnings: ["TVA_MANUELLE"],
        tvaSuspendueMillimes: "190001",
      },
    ],
  });
  fireEvent.click(screen.getByRole("checkbox", { name: "Importer ligne 2" }));
  const confirm = screen.getByRole("button", {
    name: /Confirmer l’import de 1/,
  }) as HTMLButtonElement;
  expect(confirm.disabled).toBe(true);
  fireEvent.change(
    screen.getByRole("textbox", { name: "Justification ligne 2" }),
    { target: { value: "Correction fictive vérifiée" } },
  );
  expect(confirm.disabled).toBe(false);
  vi.mocked(api.post).mockRejectedValueOnce(
    new Error("Les données ont changé. Relancez l’aperçu."),
  );
  fireEvent.click(confirm);
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toContain(
      "Les données ont changé",
    ),
  );
  expect(
    (
      screen.getByRole("textbox", {
        name: "Justification ligne 2",
      }) as HTMLInputElement
    ).value,
  ).toBe("Correction fictive vérifiée");
  expect(
    (
      screen.getByRole("checkbox", {
        name: "Importer ligne 2",
      }) as HTMLInputElement
    ).checked,
  ).toBe(true);
});
