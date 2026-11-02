// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { BarreChargement, LegendeChargement, SqueletteOr, SqueletteTableau } from "./Chargement";

afterEach(cleanup);

describe("états de chargement", () => {
  it("la barre fine n'existe que pendant une mise à jour et s'annonce aux lecteurs d'écran", () => {
    const { rerender } = render(<BarreChargement actif={false} />);
    expect(screen.queryByRole("progressbar")).toBeNull();
    rerender(<BarreChargement actif />);
    const barre = screen.getByRole("progressbar");
    expect(barre.getAttribute("aria-busy")).toBe("true");
    expect(barre.getAttribute("aria-label")).toBe("Mise à jour en cours");
    rerender(<BarreChargement actif libelle="Import en cours" />);
    expect(screen.getByRole("progressbar").getAttribute("aria-label")).toBe("Import en cours");
  });

  it("le squelette de tableau reprend le nombre de colonnes du vrai tableau, une ligne d'en-tête en plus, et reste caché des lecteurs d'écran", () => {
    const { container } = render(<SqueletteTableau colonnes="84px 1fr 90px 110px" lignes={3} droite={[2, 3]} />);
    const racine = container.querySelector(".sk-tableau") as HTMLElement;
    expect(racine.getAttribute("aria-hidden")).toBe("true");
    expect(racine.querySelectorAll(".sk-ligne")).toHaveLength(4);
    expect(racine.querySelectorAll(".sk-or")).toHaveLength(16);
    expect((racine.querySelector(".sk-ligne") as HTMLElement).style.gridTemplateColumns).toBe("84px 1fr 90px 110px");
    // les montants sont alignés à droite
    expect(racine.querySelectorAll(".sk-ligne:nth-child(2) .sk-or.ml-auto")).toHaveLength(2);
  });

  it("la légende annonce le chargement ; une brique seule est décorative", () => {
    render(<LegendeChargement>Chargement du suivi bancaire…</LegendeChargement>);
    expect(screen.getByRole("status").textContent).toBe("Chargement du suivi bancaire…");
    const { container } = render(<SqueletteOr className="h-5 w-8" />);
    const brique = container.querySelector(".sk-or") as HTMLElement;
    expect(brique.getAttribute("aria-hidden")).toBe("true");
    expect(brique.className).toContain("h-5");
  });
});
