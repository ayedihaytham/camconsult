// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { api } from "@/lib/api";
import { ProfilePanel } from "./ProfilePanel";
vi.mock("@/lib/api", () => ({ api: { get: vi.fn(), put: vi.fn() } }));
vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({ canManageCollaborateurs: true }),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it("sends empty optional strings for a new society profile rather than triggering a required-field API error", async () => {
  vi.mocked(api.get).mockResolvedValue({
    version: 0,
    donnees: { raisonSociale: "SOCIETE DEMO", matriculeFiscal: "1111111AB000" },
  });
  vi.mocked(api.put).mockResolvedValue({
    version: 1,
    donnees: {
      raisonSociale: "SOCIETE DEMO",
      matriculeFiscal: "1111111AB000",
      reference: "DEMO-PROFIL",
    },
  });
  render(<ProfilePanel societeId="soc" />);
  await screen.findByDisplayValue("SOCIETE DEMO");
  expect(
    (
      screen.getByRole("button", {
        name: "Confirmer la vérification du profil",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  fireEvent.change(screen.getByLabelText("Référence de vérification"), {
    target: { value: "DEMO-PROFIL" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Confirmer la vérification du profil" }),
  );
  await waitFor(() =>
    expect(api.put).toHaveBeenCalledWith("/apurement/societes/soc/profil", {
      expectedVersion: 0,
      verifier: true,
      donnees: {
        raisonSociale: "SOCIETE DEMO",
        matriculeFiscal: "1111111AB000",
        reference: "DEMO-PROFIL",
        activite: "",
        ville: "",
        rue: "",
        numero: "",
        codePostal: "",
      },
    }),
  );
});
