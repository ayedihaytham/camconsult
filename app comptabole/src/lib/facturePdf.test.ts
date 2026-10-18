import { describe, expect, it } from "vitest";
import type { Facture } from "@/types";
import { construireFacturePdf, propre } from "./facturePdf";

// Données SYNTHÉTIQUES uniquement.
const cabinet = {
  nom: "CABINET EXEMPLE", raisonSociale: "CABINET EXEMPLE SARL", adresse: "", rue: "12 rue du Lac", ville: "Tunis", codePostal: "1053",
  matriculeFiscal: "1234567ABM000", rc: "B0123452026", telephone: "71 000 000", email: "contact@cabinet-exemple.tn", rib: "04 123 0123456789012 45", mentions: "",
};
const facture = (extra: Partial<Facture> = {}): Facture =>
  ({
    id: "x", societeId: "s", societeNom: "SOCIETE EXEMPLE SARL", clientAdresse: "5 avenue Habib Bourguiba\n3000 Sfax", clientTva: "7654321KAM000", clientRne: "B0987652019",
    numero: "2026-0002", dateEmission: "2026-10-17", echeance: "2026-11-16", tvaTaux: 19, timbre: 1, statut: "emise", payeLe: null, signeeLe: null, note: "",
    totalHt: 700, tva: 133, netAPayer: 834, creeLe: "2026-10-17T08:00:00Z", einvoice: null,
    lignes: [
      { ordre: 0, description: "Tenue de comptabilite", quantite: 1, montantHt: 500 },
      { ordre: 1, description: "Declarations fiscales", quantite: 2, montantHt: 100 },
    ],
    ...extra,
  }) as Facture;
const sha = "ab".repeat(32);
const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const texte = async (f: Facture, logo: string | null = null) => {
  const doc = await construireFacturePdf(f, cabinet, { logo });
  return { doc, brut: doc.output() };
};

describe("PDF de la facture", () => {
  it("produit un vrai fichier PDF d'une page, avec le numéro, les montants et le montant en lettres en texte", async () => {
    const { doc, brut } = await texte(facture());
    expect(brut.startsWith("%PDF-")).toBe(true);
    expect(doc.getNumberOfPages()).toBe(1);
    for (const attendu of ["2026-0002", "834,000", "700,000", "133,000", "1234567ABM000", "B0987652019", "17/10/2026", "16/11/2026", "Huit cent trente-quatre dinars"]) expect(brut, attendu).toContain(attendu);
    expect(brut).toContain("/Title (Facture 2026-0002)");
  });

  it("une facture très longue passe sur plusieurs pages, totaux compris", async () => {
    const lignes = Array.from({ length: 40 }, (_, i) => ({ ordre: i, description: `Prestation ${i + 1}`, quantite: 1, montantHt: 10 }));
    const { doc, brut } = await texte(facture({ lignes, totalHt: 400, tva: 76, netAPayer: 477 }));
    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
    expect(brut).toContain("477,000");
    expect(brut).toContain("Prestation 40");
  });

  it("facture signée : bloc de signature avec empreinte ; non signée : aucun bloc ; validée : référence TTN", async () => {
    const signee = await texte(facture({ einvoice: { statut: "signee", genereLe: null, sha256: "", signeLe: "2026-10-17T10:00:00Z", shaSigne: sha } }));
    expect(signee.brut).toContain(sha);
    expect(signee.brut).toContain("El Fatoora / TEIF");
    expect((await texte(facture())).brut).not.toContain(sha);
    expect((await texte(facture({ einvoice: { statut: "prete", genereLe: null, sha256: "", shaSigne: null } }))).brut).not.toContain("SHA-256");

    const validee = await texte(facture({ einvoice: { statut: "validee", genereLe: null, sha256: "", signeLe: "2026-10-17T10:00:00Z", shaSigne: sha, refTtn: "REF-TTN-42", refTtnDate: "2026-10-17T10:42:00Z", qrPng: png } }));
    expect(validee.brut).toContain("REF-TTN-42");
    expect(validee.brut).toContain("/Subtype /Image"); // QR officiel de TTN inséré tel quel
  });

  it("un QR officiel douteux n'est jamais inséré ; un logo illisible n'empêche pas la facture", async () => {
    const ei = { statut: "validee" as const, genereLe: null, sha256: "", signeLe: "2026-10-17T10:00:00Z", shaSigne: sha, refTtn: "REF", refTtnDate: null, qrPng: 'x" onerror="' };
    const { brut } = await texte(facture({ einvoice: ei }));
    expect(brut).not.toContain("/Subtype /Image");
    const sansLogo = await texte(facture(), "data:image/png;base64,pas-une-image");
    expect(sansLogo.brut.startsWith("%PDF-")).toBe(true);
    expect(sansLogo.brut).toContain("2026-0002");
  });

  it("nettoyage du texte : espaces fines remplacées, sauts de ligne conservés, caractères non pris en charge neutralisés", () => {
    expect(propre("10 115 001,000")).toBe("10 115 001,000");
    expect(propre("a\nb\r\nc")).toBe("a\nb\nc");
    expect(propre("Société — 100 €")).toBe("Société — 100 €");
    expect(propre("شركة")).toBe("????");
    expect(propre(null)).toBe("");
  });
});
