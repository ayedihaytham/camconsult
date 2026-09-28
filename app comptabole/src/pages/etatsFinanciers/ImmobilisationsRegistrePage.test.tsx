import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ImmoBien, ImmoCategorie } from "@/types";
import type { PostesExercice } from "@/store/balances";
import { ImmobilisationsRegistrePage } from "./ImmobilisationsRegistrePage";

const { state } = vi.hoisted(() => ({
  state: {
    categories: [] as ImmoCategorie[],
    biens: [] as ImmoBien[],
    loadingBiens: false,
    fetchCategories: vi.fn(),
    fetchBiens: vi.fn(),
    clearBiens: vi.fn(),
    addBien: vi.fn(),
    updateBien: vi.fn(),
    removeBien: vi.fn(),
  },
}));

vi.mock("@/store/immobilisations", () => ({
  useImmobilisations: (selector: (store: typeof state) => unknown) => selector(state),
}));

const exercice: PostesExercice = {
  exercice: "2026", postes: {}, postesDebit: {}, postesCredit: {}, codes: {},
  caLocalSuggere: 0, caExportSuggere: 0,
};

afterEach(() => {
  state.categories = [];
  state.biens = [];
});

describe("Immobilisations mobile register", () => {
  it("retains the empty state and both accessible creation/import actions", () => {
    const html = renderToStaticMarkup(<ImmobilisationsRegistrePage societeId="soc-1" exercices={[exercice]} />);
    expect(html).toContain("Aucun bien enregistré");
    expect(html).toContain("Nouveau bien");
    expect(html).toContain("Importer");
  });

  it("renders a populated mobile row with the asset's real financial context and actions", () => {
    state.categories = [{ id: "cat-1", nom: "Matériel", taux: 20, masse: "corporelle", majLe: "2026-01-01" }];
    state.biens = [{
      id: "bien-1", societeId: "soc-1", categorieId: "cat-1", libelle: "Serveur comptable",
      dateAcquisition: "2026-01-01", coutAcquisition: 12000, taux: 20,
      dateCession: null, valeurCession: 0, majLe: "2026-01-01",
    }];
    const html = renderToStaticMarkup(<ImmobilisationsRegistrePage societeId="soc-1" exercices={[exercice]} />);
    expect(html).toContain("Serveur comptable");
    expect(html).toContain("Coût d&#x27;acquisition");
    expect(html).toContain("Détail des mouvements");
    expect(html).toContain("VNC");
    expect(html).toContain('aria-label="Actions"');
  });
});
