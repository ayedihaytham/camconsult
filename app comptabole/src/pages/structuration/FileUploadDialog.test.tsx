// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FileUploadDialog } from "./FileUploadDialog";

// Fichiers synthétiques uniquement.
beforeEach(() => {
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function monter(onSubmit: React.ComponentProps<typeof FileUploadDialog>["onSubmit"]) {
  const onOpenChange = vi.fn();
  render(<FileUploadDialog open onOpenChange={onOpenChange} destinationLabel="UBCI" onSubmit={onSubmit} />);
  const entree = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(entree, { target: { files: [new File(["x"], "09-2026.pdf", { type: "application/pdf" })] } });
  return { onOpenChange };
}
const valider = () => fireEvent.click(screen.getByRole("button", { name: /Ajouter|Téléverser|Envoyer|Importer/ }));

describe("FileUploadDialog : fermeture après la réponse du serveur", () => {
  it("attend la fin de l'enregistrement avant de se fermer, bouton occupé entre-temps", async () => {
    let finir: (v: boolean) => void = () => undefined;
    const onSubmit = vi.fn(() => new Promise<boolean>((r) => (finir = r)));
    const { onOpenChange } = monter(onSubmit);
    valider();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onOpenChange).not.toHaveBeenCalled();
    finir(true);
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("reste ouverte quand rien n'a été enregistré (le message d'erreur vient du store), pour réessayer", async () => {
    const onSubmit = vi.fn().mockResolvedValue(false);
    const { onOpenChange } = monter(onSubmit);
    valider();
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 30));
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("un rappel synchrone qui ne renvoie rien (ancien usage) ferme la fenêtre comme avant", async () => {
    const onSubmit = vi.fn();
    const { onOpenChange } = monter(onSubmit);
    valider();
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});

describe("FileUploadDialog : fichiers déposés sur un tiroir", () => {
  it("s'ouvre avec les fichiers déjà choisis, prêts à être ajoutés", async () => {
    const onSubmit = vi.fn().mockResolvedValue(true);
    const f1 = new File(["a"], "releve.pdf", { type: "application/pdf" });
    const f2 = new File(["b"], "virements.xlsx");
    render(<FileUploadDialog open onOpenChange={vi.fn()} destinationLabel="BANQUE" initialFiles={[f1, f2]} onSubmit={onSubmit} />);
    expect(screen.getByText("releve.pdf")).toBeTruthy();
    expect(screen.getByText("virements.xlsx")).toBeTruthy();
    valider();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0].map((f: { libelle: string }) => f.libelle)).toEqual(["releve.pdf", "virements.xlsx"]);
  });
});

describe("FileUploadDialog : archive .zip", () => {
  it("décompresse l'archive : ses fichiers partent avec leur dossier, l'archive elle-même n'est pas envoyée", async () => {
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    zip.file("facture.txt", "a");
    zip.file("banque/releve.txt", "b");
    const archive = new File([await zip.generateAsync({ type: "blob" })], "Pièces 2026.zip", { type: "application/zip" });
    const onSubmit = vi.fn().mockResolvedValue(true);
    render(<FileUploadDialog open onOpenChange={vi.fn()} destinationLabel="UBCI" onSubmit={onSubmit} />);
    fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [archive] } });
    expect(screen.getByText(/dossier « Pièces 2026 »/)).toBeTruthy();
    valider();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const envoyes = onSubmit.mock.calls[0][0] as { libelle: string; dossiers?: string[] }[];
    expect(envoyes.map((f) => `${(f.dossiers ?? []).join("/")}|${f.libelle}`).sort()).toEqual(["Pièces 2026/banque|releve.txt", "Pièces 2026|facture.txt"]);
  });
});

describe("FileUploadDialog : collage", () => {
  it("les fichiers collés (Ctrl+V) s'ajoutent à la liste, plusieurs à la fois ; le texte collé n'est pas intercepté", async () => {
    const onSubmit = vi.fn().mockResolvedValue(true);
    render(<FileUploadDialog open onOpenChange={vi.fn()} destinationLabel="UBCI" onSubmit={onSubmit} />);
    const coller = (files: File[]) => {
      const e = new Event("paste", { bubbles: true, cancelable: true }) as Event & { clipboardData?: unknown };
      e.clipboardData = { files };
      document.dispatchEvent(e);
      return e.defaultPrevented;
    };
    expect(coller([])).toBe(false);
    expect(coller([new File(["a"], "capture.png", { type: "image/png" }), new File(["b"], "facture.pdf", { type: "application/pdf" })])).toBe(true);
    await waitFor(() => expect(screen.getByText("capture.png")).toBeTruthy());
    expect(screen.getByText("facture.pdf")).toBeTruthy();
    valider();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect((onSubmit.mock.calls[0][0] as { libelle: string }[]).map((f) => f.libelle)).toEqual(["capture.png", "facture.pdf"]);
  });
});
