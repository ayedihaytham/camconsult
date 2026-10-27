import { describe, expect, it } from "vitest";
import { detailPourCopie, diagnostic, diagnostiquerErreurPdf } from "./diagnosticConversion";

describe("diagnostic d'un PDF non converti", () => {
  it("reconnaît un PDF protégé par mot de passe", () => {
    const erreur = Object.assign(new Error("No password given"), { name: "PasswordException" });
    expect(diagnostiquerErreurPdf(erreur).code).toBe("protege");
  });

  it("reconnaît un fichier endommagé ou incomplet", () => {
    expect(diagnostiquerErreurPdf(Object.assign(new Error("Invalid PDF structure."), { name: "InvalidPDFException" })).code).toBe("endommage");
    expect(diagnostiquerErreurPdf(new Error("Unexpected end of file")).code).toBe("endommage");
  });

  it("une erreur inconnue reste un diagnostic honnête, sans cause inventée", () => {
    const d = diagnostiquerErreurPdf(new Error("boom"));
    expect(d.code).toBe("autre");
    expect(d.cause).toContain("pas identifiée");
  });

  it("le scan explique la cause et propose l'original, puis un meilleur scan", () => {
    const d = diagnostic("scanne");
    expect(d.cause).toMatch(/photo ou un scan/);
    expect(d.solutions[0]).toMatch(/PDF d'origine/);
    expect(d.solutions[1]).toMatch(/refaire le scan/i);
  });

  it("le détail à copier donne fichier, taille, problème et solutions, sans contenu du document", () => {
    const texte = detailPourCopie("scan.pdf", 2_621_440, diagnostic("scanne"), 3);
    expect(texte).toContain("Fichier : scan.pdf");
    expect(texte).toContain("Taille : 2.5 Mo");
    expect(texte).toContain("Pages : 3");
    expect(texte).toContain("Problème : PDF scanné (image)");
    expect(texte).toContain("1. Demander à la banque");
    expect(detailPourCopie("a.pdf", 500, diagnostic("autre"))).toContain("Taille : 1 Ko");
  });
});
