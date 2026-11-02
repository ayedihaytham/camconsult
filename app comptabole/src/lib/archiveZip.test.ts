// @vitest-environment jsdom
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { estZip, lireZip, nomDossierZip } from "./archiveZip";

// Archives synthétiques uniquement.
async function archive(fichiers: Record<string, string>): Promise<Blob> {
  const zip = new JSZip();
  for (const [chemin, contenu] of Object.entries(fichiers)) zip.file(chemin, contenu);
  return zip.generateAsync({ type: "blob" });
}

describe("archive .zip", () => {
  it("reconnaît les .zip et nomme leur dossier sans l'extension", () => {
    expect(estZip("Factures 2026.ZIP")).toBe(true);
    expect(estZip("facture.pdf")).toBe(false);
    expect(nomDossierZip("Factures 2026.zip")).toBe("Factures 2026");
  });

  it("lit les fichiers avec leur dossier, dans l'archive", async () => {
    const entrees = await lireZip(await archive({ "a.txt": "un", "achats/jan/b.txt": "deux", "achats/c.txt": "trois" }));
    const vue = entrees.map((e) => `${e.dossiers.join("/")}|${e.nom}|${e.taille}`);
    expect(vue).toHaveLength(3);
    expect(vue).toEqual(expect.arrayContaining(["|a.txt|2", "achats/jan|b.txt|4", "achats|c.txt|5"]));
  });

  it("écarte les fichiers système ; aucun chemin ne sort de l'archive", async () => {
    const entrees = await lireZip(await archive({ "ok.txt": "x", ".DS_Store": "x", "__MACOSX/._ok.txt": "x", "d/Thumbs.db": "x", "../evil.txt": "x" }));
    expect(entrees.map((e) => e.nom).sort()).toEqual(["evil.txt", "ok.txt"]);
    expect(entrees.every((e) => e.dossiers.every((d) => d !== ".." && d !== "."))).toBe(true);
  });

  it("refuse une archive illisible avec un message clair", async () => {
    await expect(lireZip(new Blob(["pas un zip"]))).rejects.toThrow(/illisible/);
  });
});
