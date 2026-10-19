import { describe, expect, it } from "vitest";
import { jsPDF } from "jspdf";
import { ENTETE_COURANT, MARGE, dessinerEntete, dessinerPages } from "./pdfModele";

const cabinet = { nom: "Cabinet Test", adresse: "1 rue A, Tunis", matriculeFiscal: "123/A", telephone: "71 000 000", email: "a@b.tn" };
const nouveau = () => new jsPDF({ unit: "pt", format: "a4" });

describe("modèle PDF du cabinet", () => {
  it("l'en-tête de la première page rend l'ordonnée où commence le contenu (plus bas avec un sous-titre)", () => {
    const sans = dessinerEntete(nouveau(), { titre: "Titre", cabinet, logo: null });
    const avec = dessinerEntete(nouveau(), { titre: "Titre", sousTitre: "Sous-titre", cabinet, logo: null });
    expect(sans).toBe(MARGE + 74);
    expect(avec).toBe(MARGE + 90);
    expect(ENTETE_COURANT).toBeGreaterThan(MARGE + 30);
  });

  it("sans logo, le nom du cabinet le remplace ; la mention n'est imprimée que si elle est donnée", () => {
    const a = nouveau();
    dessinerEntete(a, { titre: "T", cabinet, logo: null, mention: "Collecte de pièces" });
    const b = nouveau();
    dessinerEntete(b, { titre: "T", cabinet, logo: null });
    expect(a.output()).toContain("Collecte de pi");
    expect(b.output()).not.toContain("Collecte de pi");
    expect(a.output()).toContain("Cabinet Test");
  });

  it("un logo illisible ne fait pas échouer l'en-tête", () => {
    expect(() => dessinerEntete(nouveau(), { titre: "T", cabinet, logo: "data:image/png;base64,AAAA" })).not.toThrow();
  });

  it("chaque page reçoit le pied de page (coordonnées, pagination) ; les pages suivantes l'en-tête courant", () => {
    const doc = nouveau();
    doc.addPage();
    dessinerPages(doc, { titre: "Mon titre", cabinet, logo: null });
    const pdf = doc.output();
    expect(pdf).toContain("Page 1 / 2");
    expect(pdf).toContain("Page 2 / 2");
    expect(pdf).toContain("MF 123/A");
    expect(pdf).toContain("Mon titre"); // en-tête courant de la page 2
  });

  it("sans coordonnées (collaborateur), le pied de page garde la date et la pagination, et le nom par défaut est CAMCONSULT", () => {
    const doc = nouveau();
    dessinerEntete(doc, { titre: "T", cabinet: null, logo: null });
    dessinerPages(doc, { titre: "T", cabinet: null, logo: null });
    const pdf = doc.output();
    expect(pdf).toContain("CAMCONSULT");
    expect(pdf).toContain("Page 1 / 1");
    expect(pdf).not.toContain("MF ");
  });
});
