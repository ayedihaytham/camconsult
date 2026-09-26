import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { PostesExercice } from "@/store/balances";
import { SIG_BLOCS } from "@/lib/etatsFinanciers/postes";
import { MASSES, MASSE_LABELS } from "@/lib/etatsFinanciers/immobilisations";
import { SigTable } from "./SigTable";
import { ImmoVariationTable } from "./ImmoVariationTable";
import { ControleTable } from "./ControleTable";

const exercice: PostesExercice = {
  exercice: "2026",
  postes: { "cpc.ventes_marchandises": -156000, "actif.liquidites": 133998 },
  postesDebit: {},
  postesCredit: {},
  codes: {},
  caLocalSuggere: 0,
  caExportSuggere: 0,
};

describe("Financial Ledger mobile bodies", () => {
  it("keeps every real SIG line and balance in stacked blocks for one mobile exercise", () => {
    const html = renderToStaticMarkup(<SigTable exercices={[exercice]} />);
    expect(html).toContain("Produits");
    expect(html).toContain("Charges");
    expect(html).toContain("Soldes intermédiaires de gestion");
    for (const bloc of SIG_BLOCS) {
      expect(html).toContain(bloc.soldeLabel.replace(/'/g, "&#x27;"));
      for (const line of [...bloc.produits, ...bloc.charges]) {
        expect(html).toContain(line.label.replace(/'/g, "&#x27;"));
      }
    }
    expect(html).toContain("SIG — exercice 2026");
  });

  it("keeps the full immobilisation schedule in a locally scrollable region", () => {
    const html = renderToStaticMarkup(
      <ImmoVariationTable exercices={[exercice]} immoMouvements={[]} onSave={vi.fn()} />,
    );
    expect(html).toContain('aria-label="Tableau de variation des immobilisations, défilement horizontal"');
    expect(html).toContain("min-w-[1080px]");
    expect(html).toContain("sticky left-0");
    for (const masse of MASSES) expect(html).toContain(MASSE_LABELS[masse]);
    expect(html).toContain("Acquisitions");
    expect(html).toContain("Dotations");
  });

  it("exposes discrepancy and both real source values in mobile reconciliation", () => {
    const html = renderToStaticMarkup(
      <ControleTable
        exercices={[exercice]}
        immoMouvements={[]}
        financementMouvements={[]}
        tdrfLignes={[]}
        tdrfParametres={[]}
      />,
    );
    expect(html).toContain("Écart (1) − (2)");
    expect(html).toContain("ACTIF DU BILAN");
    expect(html).toContain("PASSIF DU BILAN");
    expect(html).toContain("133 998,00");
    expect(html).not.toContain("Certifié");
  });
});
