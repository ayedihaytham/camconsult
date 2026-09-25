import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CollecteChecklist } from "./CollecteChecklist";
import type { ChecklistRow } from "@/lib/collecte/checklist";

const rows: ChecklistRow[] = [
  { onglet: "virements_recus", pieceLabel: "Détail des virements reçus", tabLabel: "Virements reçus", recu: true, statutLabel: "Reçu", dateReception: "18/09/2026", total: 4250, nbLignes: 1, commentaire: "Vérifié" },
  { onglet: "achats", pieceLabel: "Détail des achats", tabLabel: "Détail des achats", recu: false, statutLabel: "En attente", dateReception: null, total: null, nbLignes: 0, commentaire: "" },
];

describe("CollecteChecklist", () => {
  it("renders real row facts, cautious date wording and a derived received count", () => {
    const html = renderToStaticMarkup(<CollecteChecklist rows={rows} devise="TND" editable onSelectTab={vi.fn()} onSaveComment={vi.fn()} />);
    expect(html).toContain("Détail des virements reçus");
    expect(html).toContain("Date de suivi");
    expect(html).toContain("4 250,00 TND");
    expect(html).toContain("1 / 2");
    expect(html).toContain("Ajouter une note");
    expect(html).toContain('aria-label="Ajouter le commentaire pour Détail des achats"');
  });

  it("does not expose comment editing in a read-only context", () => {
    const html = renderToStaticMarkup(<CollecteChecklist rows={rows} devise="TND" editable={false} onSelectTab={vi.fn()} onSaveComment={vi.fn()} />);
    expect(html).not.toContain("Ajouter une note");
    expect(html).toContain("Vérifié");
  });
});
