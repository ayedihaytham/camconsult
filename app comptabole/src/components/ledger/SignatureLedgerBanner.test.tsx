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

    expect(html).toContain("Collecte de pièces");
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("signature-ledger__title");
    expect(html.match(/<dt>/g)).toHaveLength(3);
    expect(html).toContain("signature-ledger__metric--destructive");
    expect(html).not.toContain("signature-ledger__action");
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

    expect(html).toContain("signature-ledger--compact");
    expect(html).toContain("signature-ledger__compact-context");
    expect(html).not.toContain("signature-ledger__metrics");
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
