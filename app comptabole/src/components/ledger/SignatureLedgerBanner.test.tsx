import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
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
        eyebrow="Clients & travail · Process Ledger"
        title="Collecte de pièces"
        description="Suivi documentaire"
        metrics={metrics}
        variant="process"
      />,
    );

    expect(html).toContain("Collecte de pièces");
    expect(html.match(/<dt>/g)).toHaveLength(3);
    expect(html).toContain("signature-ledger__metric--destructive");
    expect(html).not.toContain("signature-ledger__action");
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
