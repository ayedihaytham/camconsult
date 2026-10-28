import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ClipboardList } from "lucide-react";
import { OperationalFab } from "./OperationalFab";
import { SignatureLedgerBanner } from "./SignatureLedgerBanner";

const metrics = [
  { label: "En cours", value: 4 },
  { label: "En retard", value: 2, tone: "destructive" as const },
  { label: "À corriger", value: 1, tone: "warning" as const },
];

describe("Signature Ledger presentation", () => {
  it("renders only the supplied metrics and no unauthorized action", () => {
    const html = renderToStaticMarkup(
      <SignatureLedgerBanner
        icon={ClipboardList}
        eyebrow="Clients & travail · Process Ledger"
        title="Collecte de pièces"
        description="Suivi documentaire"
        metrics={metrics}
        variant="process"
      />,
    );

    // Le titre est celui de la barre du haut (texte réservé aux lecteurs d'écran) ; les chiffres forment une rangée discrète.
    expect(html).toContain("Collecte de pièces");
    expect(html).toContain("sr-only");
    expect(html.match(/<dt>/g)).toHaveLength(3);
    expect(html).toContain("page-head-figs");
    expect(html).toContain("text-destructive");
    expect(html).not.toContain("bg-accent");
  });

  it("uses a compact scope treatment without a lower metric band", () => {
    const html = renderToStaticMarkup(
      <SignatureLedgerBanner
        icon={ClipboardList}
        eyebrow="Paramétrage cabinet · Référentiel global"
        title="Grille AFFECTAT"
        description="Référentiel global de reclassement"
        metrics={[]}
        contextLabel="Référentiel global du cabinet"
        variant="compact"
      />,
    );

    expect(html).toContain("Grille AFFECTAT");
    expect(html).not.toContain("page-head-figs");
  });

  it("keeps the mobile create affordance icon-only with an accessible name", () => {
    const html = renderToStaticMarkup(
      <OperationalFab label="Nouvelle collecte" onClick={vi.fn()} />,
    );

    expect(html).toContain('aria-label="Nouvelle collecte"');
    expect(html).toContain("operational-fab");
    expect(html).not.toContain(">Nouvelle collecte<");
  });
});
