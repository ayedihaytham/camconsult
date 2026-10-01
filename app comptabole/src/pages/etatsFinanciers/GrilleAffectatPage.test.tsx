// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { POSTE_OPTIONS } from "@/lib/etatsFinanciers/postes";
import { GrilleAffectatPage } from "./GrilleAffectatPage";

const clientsPosteOption = POSTE_OPTIONS.find(
  (option) => option.label === "Clients et comptes rattachés",
)!;

const { state, updateCode, renameCode, removeCode, fetchGrille } = vi.hoisted(() => {
  const updateCode = vi.fn();
  const renameCode = vi.fn();
  const removeCode = vi.fn();
  const fetchGrille = vi.fn();
  return {
    state: {
      grilleCodes: [] as { code: string; libelle: string; poste: string; majLe: string }[],
      grilleComptes: [] as { affectatCode: string }[],
      grilleLoading: false,
      grilleError: null,
      fetchGrille,
      updateCode,
      renameCode,
      removeCode,
    },
    updateCode,
    renameCode,
    removeCode,
    fetchGrille,
  };
});

vi.mock("@/store/balances", () => ({
  useBalances: (selector: (value: typeof state) => unknown) => selector(state),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  state.grilleCodes = [{ code: "CP01", libelle: "Capitaux", poste: POSTE_OPTIONS[0].value, majLe: "" }];
  state.grilleComptes = [];
  updateCode.mockReset().mockImplementation(async (code, change) => {
    state.grilleCodes = state.grilleCodes.map((row) => row.code === code ? { ...row, ...change } : row);
  });
  renameCode.mockReset().mockResolvedValue(undefined);
  removeCode.mockReset().mockResolvedValue(undefined);
  fetchGrille.mockReset().mockResolvedValue(undefined);
});

afterEach(() => cleanup());

function openActions() {
  const trigger = within(screen.getByRole("table")).getByRole("button", { name: "Actions pour le code CP01" });
  fireEvent.keyDown(trigger, { key: "Enter", code: "Enter" });
}

describe("global AFFECTAT mapping safeguards", () => {
  it("uses the shared Signature Ledger banner with cabinet-specific context", () => {
    render(<GrilleAffectatPage />);

    const banner = screen.getByRole("banner");
    expect(banner.className).toContain("signature-ledger");
    expect(banner.textContent).toContain(
      "Paramétrage cabinet · Référentiel global",
    );
    expect(banner.textContent).toContain("Grille AFFECTAT");
    expect(banner.textContent).toContain(
      "Référentiel global de reclassement du cabinet, appliqué aux sociétés autorisées.",
    );
    expect(banner.className).toContain("signature-ledger--compact");
    expect(banner.querySelector(".signature-ledger__compact-context")?.textContent)
      .toBe("Référentiel global du cabinet");
    expect(banner.querySelector(".signature-ledger__metrics")).toBeNull();
    expect(banner.textContent).not.toContain("Sociétés accessibles");
  });

  it("uses the compact mobile search hint and full-width Poste touch control", async () => {
    const originalWidth = window.innerWidth;
    state.grilleCodes = Array.from({ length: 8 }, (_, index) => ({
      code: `CP${String(index + 1).padStart(2, "0")}`,
      libelle: `Code ${index + 1}`,
      poste: POSTE_OPTIONS[0].value,
      majLe: "",
    }));
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 375 });
    try {
      render(<GrilleAffectatPage />);
      const search = await screen.findByRole("textbox", {
        name: "Rechercher un code, un libellé ou un poste AFFECTAT",
      });
      expect(search.getAttribute("placeholder")).toBe("Code, libellé ou poste…");
      const posteControls = screen.getAllByRole("button", {
        name: /^Poste global du code CP01\s*:/,
      });
      expect(
        posteControls.every((control) =>
          control.className.includes("min-h-11 w-full"),
        ),
      ).toBe(true);
      const nextButtons = screen.getAllByRole("button", {
        name: "Page suivante",
      });
      expect(nextButtons[nextButtons.length - 1].className).toContain(
        "h-11 w-11",
      );

      fireEvent.click(
        within(screen.getByRole("article", { name: "Code AFFECTAT CP01" }))
          .getByRole("button", { name: /^Poste global du code CP01\s*:/ }),
      );
      expect(
        await screen.findByRole("dialog", { name: "Choisir un poste" }),
      ).toBeTruthy();
      const posteSearch = screen.getByRole("combobox", {
        name: "Rechercher un poste pour le code CP01",
      });
      const listbox = screen.getByRole("listbox", {
        name: "Postes disponibles pour le code CP01",
      });
      expect(
        within(listbox).getByRole("option", {
          name: `${POSTE_OPTIONS[0].label}, ${POSTE_OPTIONS[0].groupe}`,
        }).getAttribute("aria-selected"),
      ).toBe("true");
      expect(
        within(listbox).getByRole("option", { name: "— Non assigné —" }),
      ).toBeTruthy();
      fireEvent.change(posteSearch, { target: { value: "clients" } });
      expect(
        within(listbox).getByRole("option", {
          name: `${clientsPosteOption.label}, ${clientsPosteOption.groupe}`,
        }),
      ).toBeTruthy();
      expect(
        within(listbox).queryByRole("option", {
          name: `${POSTE_OPTIONS[0].label}, ${POSTE_OPTIONS[0].groupe}`,
        }),
      ).toBeNull();
      fireEvent.change(posteSearch, { target: { value: "poste introuvable" } });
      expect(within(listbox).getByRole("status").textContent).toBe(
        "Aucun poste trouvé",
      );
      fireEvent.change(posteSearch, { target: { value: "clients" } });
      fireEvent.click(
        within(listbox).getByRole("option", {
          name: `${clientsPosteOption.label}, ${clientsPosteOption.groupe}`,
        }),
      );
      expect(screen.queryByRole("dialog", { name: "Choisir un poste" })).toBeNull();
      expect(
        screen.getByRole("dialog", {
          name: /Modifier le poste global du code CP01/,
        }),
      ).toBeTruthy();
    } finally {
      cleanup();
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        value: originalWidth,
      });
    }
  });

  it("paginates seven codes and clamps the current page after the result count shrinks", async () => {
    state.grilleCodes = Array.from({ length: 21 }, (_, index) => ({
      code: `CP${String(index + 1).padStart(2, "0")}`,
      libelle: `Code ${index + 1}`,
      poste: POSTE_OPTIONS[0].value,
      majLe: "",
    }));
    const view = render(<GrilleAffectatPage />);
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(8);
    expect(screen.getAllByText("1–7 sur 21 codes").length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByRole("button", { name: "Dernière page" })[0]);
    expect(within(screen.getByRole("table")).getByText("CP21")).toBeTruthy();
    state.grilleCodes = state.grilleCodes.slice(0, 20);
    view.rerender(<GrilleAffectatPage />);
    await waitFor(() => expect(screen.getAllByText("15–20 sur 20 codes").length).toBeGreaterThan(0));
    expect(within(screen.getByRole("table")).getByText("CP20")).toBeTruthy();
  });

  it("searches before pagination and distinguishes filtered empty results", () => {
    state.grilleCodes = Array.from({ length: 12 }, (_, index) => ({
      code: `CP${String(index + 1).padStart(2, "0")}`,
      libelle: index === 11 ? "Trésorerie" : `Code ${index + 1}`,
      poste: POSTE_OPTIONS[0].value,
      majLe: "",
    }));
    render(<GrilleAffectatPage />);
    fireEvent.click(screen.getAllByRole("button", { name: "Page suivante" })[0]);
    fireEvent.change(screen.getByRole("textbox", { name: "Rechercher un code, un libellé ou un poste AFFECTAT" }), { target: { value: "trésorerie" } });
    expect(within(screen.getByRole("table")).getByText("CP12")).toBeTruthy();
    expect(screen.getAllByText("1–1 sur 1 code").length).toBeGreaterThan(0);
    fireEvent.change(screen.getByRole("textbox", { name: "Rechercher un code, un libellé ou un poste AFFECTAT" }), { target: { value: "introuvable" } });
    expect(screen.getByText("Aucun code ne correspond à cette recherche ou à ces filtres.")).toBeTruthy();
    expect(screen.queryByText("Aucun code pour le moment")).toBeNull();
  });

  it("combines only real poste and global-account filters", () => {
    state.grilleCodes = [
      { code: "CP01", libelle: "Avec compte", poste: POSTE_OPTIONS[0].value, majLe: "" },
      { code: "CP02", libelle: "Sans poste", poste: "", majLe: "" },
      { code: "CP03", libelle: "Sans compte", poste: POSTE_OPTIONS[1].value, majLe: "" },
    ];
    state.grilleComptes = [{ affectatCode: "CP01" }];
    render(<GrilleAffectatPage />);
    fireEvent.click(screen.getByRole("button", { name: "Filtrer les codes AFFECTAT" }));
    fireEvent.change(screen.getByLabelText("Poste global"), { target: { value: "yes" } });
    fireEvent.change(screen.getByLabelText("Comptes globaux"), { target: { value: "no" } });

    const table = screen.getByRole("table", { hidden: true });
    expect(within(table).getByText("CP03")).toBeTruthy();
    expect(within(table).queryByText("CP01")).toBeNull();
    expect(within(table).queryByText("CP02")).toBeNull();
    expect(screen.getAllByText("1–1 sur 1 code").length).toBeGreaterThan(0);
  });

  it("shows a pending inline label save and then the committed value", async () => {
    let finishSave: (() => void) | undefined;
    updateCode.mockImplementationOnce((code, change) => new Promise<void>((resolve) => {
      finishSave = () => {
        state.grilleCodes = state.grilleCodes.map((row) => row.code === code ? { ...row, ...change } : row);
        resolve();
      };
    }));
    render(<GrilleAffectatPage />);
    const input = within(screen.getByRole("table")).getByRole("textbox", { name: "Libellé du code CP01" }) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Nouveau libellé" } });
    fireEvent.blur(input);

    expect(within(screen.getByRole("table")).getByText("Enregistrement…")).toBeTruthy();
    expect(within(screen.getByRole("table")).getByRole("button", { name: "Actions pour le code CP01" }).hasAttribute("disabled")).toBe(true);
    await act(async () => finishSave?.());
    await waitFor(() => expect(within(screen.getByRole("table")).getByText("Enregistré")).toBeTruthy());
    expect(input.value).toBe("Nouveau libellé");
  });

  it("reverts a failed inline label save and exposes the failure", async () => {
    updateCode.mockRejectedValueOnce(new Error("network"));
    render(<GrilleAffectatPage />);
    const input = within(screen.getByRole("table")).getByRole("textbox", { name: "Libellé du code CP01" }) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Nouveau libellé" } });
    fireEvent.blur(input);

    await waitFor(() => expect(within(screen.getByRole("table")).getByText(/Échec : valeur rétablie/)).toBeTruthy());
    expect(input.value).toBe("Capitaux");
    expect(updateCode).toHaveBeenCalledWith("CP01", { libelle: "Nouveau libellé" });
  });

  it("waits for confirmation before a global poste change and shows the report impact", async () => {
    render(<GrilleAffectatPage />);
    const trigger = within(screen.getByRole("table")).getByRole("button", {
      name: /^Poste global du code CP01\s*:/,
    });
    fireEvent.click(trigger);
    const search = screen.getByRole("combobox", {
      name: "Rechercher un poste pour le code CP01",
    });
    fireEvent.change(search, { target: { value: POSTE_OPTIONS[1].label } });
    fireEvent.keyDown(search, { key: "Enter", code: "Enter" });

    expect(updateCode).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog", { name: /Modifier le poste global du code CP01/ });
    expect(dialog.textContent).toContain("tout le cabinet");
    expect(dialog.textContent).toContain("états financiers");
    fireEvent.click(screen.getByRole("button", { name: "Changer le poste" }));

    await waitFor(() => expect(updateCode).toHaveBeenCalledWith("CP01", { poste: POSTE_OPTIONS[1].value }));
    await waitFor(() => expect(within(screen.getByRole("table")).getByText("Enregistré")).toBeTruthy());
  });

  it("keeps the previous poste and confirmation open when saving fails", async () => {
    updateCode.mockRejectedValueOnce(new Error("network"));
    render(<GrilleAffectatPage />);
    const trigger = within(screen.getByRole("table")).getByRole("button", {
      name: /^Poste global du code CP01\s*:/,
    });
    fireEvent.click(trigger);
    const listbox = screen.getByRole("listbox", {
      name: "Postes disponibles pour le code CP01",
    });
    fireEvent.click(
      within(listbox).getAllByRole("option", {
        name: /^Amortissements,/,
      })[0],
    );
    fireEvent.click(screen.getByRole("button", { name: "Changer le poste" }));

    await waitFor(() => expect(within(screen.getByRole("table", { hidden: true })).getByText(/Échec : poste inchangé/)).toBeTruthy());
    expect(trigger.textContent).toContain(POSTE_OPTIONS[0].label);
    expect(screen.getByRole("dialog", { name: /Modifier le poste global/ })).toBeTruthy();
  });

  it("explains the report impact before deleting a global code", async () => {
    render(<GrilleAffectatPage />);
    openActions();
    fireEvent.click(screen.getByRole("menuitem", { name: "Retirer du référentiel" }));

    const dialog = screen.getByRole("dialog", { name: "Retirer ce code du référentiel ?" });
    expect(dialog.textContent).toContain("référentiel global du cabinet");
    expect(dialog.textContent).toContain("non affectés dans les états financiers");
    expect(removeCode).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Retirer" }));
    await waitFor(() => expect(removeCode).toHaveBeenCalledWith("CP01"));
  });

  it("identifies a real merge and does not submit an unchanged code", async () => {
    state.grilleCodes.push({ code: "CP02", libelle: "Autre", poste: POSTE_OPTIONS[1].value, majLe: "" });
    render(<GrilleAffectatPage />);
    openActions();
    fireEvent.click(screen.getByRole("menuitem", { name: "Renommer ou fusionner" }));

    expect((screen.getByRole("button", { name: "Confirmer" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByRole("textbox", { name: "Nouveau code" }), { target: { value: "CP02" } });
    expect(screen.getByText(/Fusion globale du cabinet/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Confirmer" }));
    await waitFor(() => expect(renameCode).toHaveBeenCalledWith("CP01", "CP02"));
  });
});
