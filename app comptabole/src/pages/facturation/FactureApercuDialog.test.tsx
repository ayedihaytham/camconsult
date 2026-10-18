// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { Facture } from "@/types";

// Le PDF réel est testé dans facturePdf.test.ts : ici on simule sa fabrication pour vérifier l'affichage de l'aperçu.
const pdf = vi.hoisted(() => ({ construire: vi.fn(), logo: vi.fn() }));
vi.mock("@/lib/facturePdf", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/facturePdf")>()),
  construireFacturePdf: pdf.construire,
  chargerLogo: pdf.logo,
}));

import { PARAMETRES_APERCU } from "@/lib/facturePdf";
import { FactureApercuDialog } from "./FactureApercuDialog";

const facture = { id: "x", numero: "2026-0002", societeNom: "CLIENT" } as unknown as Facture;

beforeEach(() => {
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  URL.createObjectURL = vi.fn(() => "blob:apercu-1");
  URL.revokeObjectURL = vi.fn();
  pdf.logo.mockReset().mockResolvedValue(null);
  pdf.construire.mockReset().mockResolvedValue({ output: () => new Blob(["%PDF-1.3"], { type: "application/pdf" }) });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("FactureApercuDialog", () => {
  it("affiche la page entière : le PDF s'ouvre sans barre d'outils ni miniatures, ajusté à la fenêtre ; le filigrane est demandé", async () => {
    render(<FactureApercuDialog open onOpenChange={vi.fn()} facture={facture} cabinet={null} />);
    const cadre = (await screen.findByTitle("Aperçu de la facture")) as HTMLIFrameElement;
    expect(cadre.getAttribute("src")).toBe(`blob:apercu-1${PARAMETRES_APERCU}`);
    expect(PARAMETRES_APERCU).toContain("toolbar=0");
    expect(PARAMETRES_APERCU).toContain("navpanes=0");
    expect(PARAMETRES_APERCU).toContain("view=Fit");
    expect(pdf.construire).toHaveBeenCalledWith(facture, null, expect.objectContaining({ filigrane: "Aperçu" }));
    expect(screen.getByText("Aperçu de la facture 2026-0002")).toBeTruthy();
  });

  it("la fenêtre épouse une page A4 (largeur déduite de la hauteur disponible)", async () => {
    render(<FactureApercuDialog open onOpenChange={vi.fn()} facture={facture} cabinet={null} />);
    await screen.findByTitle("Aperçu de la facture");
    const fenetre = screen.getByRole("dialog");
    // la largeur est calculée en CSS à partir de la hauteur de la fenêtre (rapport d'une feuille A4) : jamais fixe
    expect(fenetre.getAttribute("style")).toMatch(/width:.*96vw/);
    expect(fenetre.className).toContain("h-[96vh]");
  });

  it("fermée : rien n'est fabriqué ; erreur de fabrication : message clair", async () => {
    const { rerender } = render(<FactureApercuDialog open={false} onOpenChange={vi.fn()} facture={facture} cabinet={null} />);
    expect(pdf.construire).not.toHaveBeenCalled();
    pdf.construire.mockRejectedValue(new Error("échec"));
    rerender(<FactureApercuDialog open onOpenChange={vi.fn()} facture={facture} cabinet={null} />);
    expect((await screen.findByRole("alert")).textContent).toBe("L'aperçu n'a pas pu être préparé.");
  });

  it("l'adresse temporaire du PDF est libérée à la fermeture", async () => {
    const { rerender } = render(<FactureApercuDialog open onOpenChange={vi.fn()} facture={facture} cabinet={null} />);
    await screen.findByTitle("Aperçu de la facture");
    rerender(<FactureApercuDialog open={false} onOpenChange={vi.fn()} facture={null} cabinet={null} />);
    await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:apercu-1"));
  });
});
