// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Noeud } from "@/types";

const pdf = vi.hoisted(() => ({ pages: 3, echec: false, destroy: vi.fn() }));
vi.mock("pdfjs-dist", () => ({
  GlobalWorkerOptions: {},
  getDocument: () => ({
    promise: pdf.echec
      ? Promise.reject(new Error("illisible"))
      : Promise.resolve({
          numPages: pdf.pages,
          getPage: async () => ({ getViewport: ({ scale }: { scale: number }) => ({ width: 600 * scale, height: 800 * scale }), render: () => ({ promise: Promise.resolve() }) }),
          destroy: pdf.destroy,
        }),
  }),
}));
vi.mock("pdfjs-dist/build/pdf.worker.min.mjs?url", () => ({ default: "worker.js" }));

const contenu = vi.hoisted(() => ({ dataUrl: "data:application/pdf;base64,JVBERi0xLjQ=" }));
vi.mock("@/lib/contenus", () => ({ noeudADuContenu: () => true, contenuNoeud: async () => contenu.dataUrl }));
const telechargement = vi.hoisted(() => vi.fn());
vi.mock("@/lib/file", () => ({ downloadDataUrl: telechargement }));

import { FilePreviewDialog } from "./FilePreviewDialog";

const noeud = (format: string, libelle = `RECU.${format}`): Noeud => ({ id: "f1", libelle, type: "fichier", format, description: "1 ERE TR CNSS 2026", parentId: "d", societeId: "s", creeLe: "", majLe: "" }) as unknown as Noeud;

beforeEach(() => {
  pdf.pages = 3;
  pdf.echec = false;
  pdf.destroy.mockReset();
  telechargement.mockReset();
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  // jsdom ne mesure rien : on donne une largeur à la zone d'affichage
  Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => 900 });
  HTMLCanvasElement.prototype.getContext = (() => ({})) as never; // jsdom ne dessine pas : le rendu pdf.js est simulé
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("aperçu d'un document : plein écran, sans l'interface du lecteur PDF", () => {
  it("un PDF s'affiche page par page (une toile par page), jamais dans le lecteur PDF du navigateur", async () => {
    render(<FilePreviewDialog open onOpenChange={vi.fn()} node={noeud("pdf", "RECU DE PAIEMENT.pdf")} />);
    await waitFor(() => expect(screen.getAllByRole("img")).toHaveLength(3));
    expect(screen.getByRole("img", { name: "RECU DE PAIEMENT.pdf, page 2 sur 3" })).toBeTruthy();
    expect(document.querySelector("iframe")).toBeNull();
    expect(document.querySelector("embed, object")).toBeNull();
  });

  it("la fenêtre occupe tout l'écran ; Fermer et Télécharger restent dessous", async () => {
    const onOpenChange = vi.fn();
    render(<FilePreviewDialog open onOpenChange={onOpenChange} node={noeud("pdf", "RECU.pdf")} />);
    const fenetre = await screen.findByRole("dialog");
    expect(fenetre.className).toContain("h-[96dvh]");
    expect(fenetre.className).toContain("w-[96vw]");
    await waitFor(() => expect(screen.getAllByRole("img").length).toBeGreaterThan(0));
    fireEvent.click(screen.getByRole("button", { name: /Télécharger/ }));
    expect(telechargement).toHaveBeenCalledWith(contenu.dataUrl, "RECU.pdf");
    fireEvent.click(screen.getAllByRole("button", { name: "Fermer" }).at(-1)!); // le bouton du bas (la croix du coin porte le même nom)
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("un PDF illisible le dit, et le téléchargement reste proposé", async () => {
    pdf.echec = true;
    render(<FilePreviewDialog open onOpenChange={vi.fn()} node={noeud("pdf")} />);
    expect((await screen.findByRole("alert")).textContent).toMatch(/n'a pas pu être affiché/);
    expect(screen.getByRole("button", { name: /Télécharger/ })).toBeTruthy();
  });

  it("une image s'affiche en grand dans la fenêtre", async () => {
    contenu.dataUrl = "data:image/png;base64,AAAA";
    render(<FilePreviewDialog open onOpenChange={vi.fn()} node={noeud("png", "photo.png")} />);
    const image = (await screen.findByAltText("photo.png")) as HTMLImageElement;
    expect(image.className).toContain("max-h-full");
    contenu.dataUrl = "data:application/pdf;base64,JVBERi0xLjQ=";
  });

  it("un format non pris en charge propose de télécharger", async () => {
    contenu.dataUrl = "data:application/zip;base64,AAAA";
    render(<FilePreviewDialog open onOpenChange={vi.fn()} node={noeud("zip", "archive.zip")} />);
    expect(await screen.findByText(/Aperçu non pris en charge/)).toBeTruthy();
    contenu.dataUrl = "data:application/pdf;base64,JVBERi0xLjQ=";
  });
});
