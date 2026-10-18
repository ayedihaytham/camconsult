import { describe, expect, it } from "vitest";
import type { Facture } from "@/types";
import { ajouterJours, calculerTotaux, contenuQrControle, estEnRetard, htmlFacture, montantEnLettres, nombreEnLettres, prochainNumero } from "./facturation";

describe("calculerTotaux", () => {
  it("calcule HT, TVA et net à payer avec timbre", () => {
    const t = calculerTotaux(
      [
        { quantite: 2, montantHt: 500 },
        { quantite: 1, montantHt: 1200.5 },
      ],
      19,
      1,
    );
    expect(t).toEqual({ totalHt: 2200.5, tva: 418.095, netAPayer: 2619.595 });
  });

  it("n'applique que le timbre quand il n'y a aucune ligne, et gère la TVA à 0 %", () => {
    expect(calculerTotaux([], 19, 1)).toEqual({ totalHt: 0, tva: 0, netAPayer: 1 });
    expect(calculerTotaux([{ quantite: 1, montantHt: 100 }], 0, 1).netAPayer).toBe(101);
  });

  it("arrondit au millime", () => {
    const t = calculerTotaux([{ quantite: 3, montantHt: 33.3333 }], 19, 0);
    expect(t.totalHt).toBe(100);
    expect(Number.isInteger(t.tva * 1000)).toBe(true);
  });
});

describe("estEnRetard", () => {
  it("ne signale que les factures émises dont l'échéance est dépassée", () => {
    expect(estEnRetard({ statut: "emise", echeance: "2026-10-01" }, "2026-10-06")).toBe(true);
    expect(estEnRetard({ statut: "emise", echeance: "2026-10-06" }, "2026-10-06")).toBe(false);
    expect(estEnRetard({ statut: "payee", echeance: "2026-10-01" }, "2026-10-06")).toBe(false);
    expect(estEnRetard({ statut: "annulee", echeance: "2026-10-01" }, "2026-10-06")).toBe(false);
    expect(estEnRetard({ statut: "emise", echeance: null }, "2026-10-06")).toBe(false);
  });
});

describe("ajouterJours", () => {
  it("passe d'un mois à l'autre", () => {
    expect(ajouterJours("2026-10-06", 30)).toBe("2026-11-05");
    expect(ajouterJours("2026-12-20", 30)).toBe("2027-01-19");
  });
});

describe("prochainNumero", () => {
  it("suite de l'année de la date d'émission, sans trou ni dépendance à l'ordre", () => {
    expect(prochainNumero(["2026-0006", "2026-0007", "2025-0099"], "2026-10-18")).toBe("2026-0008");
    expect(prochainNumero(["2026-0010", "2026-0002"], "2026-01-05")).toBe("2026-0011");
    expect(prochainNumero(["2025-0099"], "2026-01-05")).toBe("2026-0001");
    expect(prochainNumero([], "2027-03-01")).toBe("2027-0001");
    expect(prochainNumero(["2026-0003", "n'importe quoi", "2026-12"], "2026-06-01")).toBe("2026-0013");
  });
});

describe("htmlFacture", () => {
  const facture: Facture = {
    id: "1",
    societeId: "s",
    societeNom: "ACME <script>alert(1)</script>",
    clientAdresse: "1 rue du Lac\nTunis",
    clientTva: "1234567/A",
    clientRne: "B0123",
    numero: "2026-0001",
    dateEmission: "2026-10-06",
    echeance: "2026-11-05",
    tvaTaux: 19,
    timbre: 1,
    statut: "emise",
    payeLe: null,
    signeeLe: null,
    note: "",
    totalHt: 100,
    tva: 19,
    netAPayer: 120,
    creeLe: "2026-10-06T10:00:00Z",
    lignes: [{ ordre: 0, description: "Honoraires & frais", quantite: 1, montantHt: 100 }],
  };

  it("échappe le texte saisi et affiche les montants", () => {
    const html = htmlFacture(facture, { nom: "Cabinet X", adresse: "Tunis", matriculeFiscal: "MF1", telephone: "71", email: "a@b.tn", rib: "TN59 0000", mentions: "SARL" });
    expect(html).not.toContain("<script>alert(1)");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("Honoraires &amp; frais");
    expect(html).toContain("2026-0001");
    expect(html).toContain("06/10/2026");
    expect(html).toContain("120,000");
    expect(html).toContain("Cent vingt dinars");
    expect(html).toContain("TN59 0000");
    expect(html).toContain("1234567/A");
    expect(html).toContain("1 rue du Lac<br>Tunis");
  });

  it("facture électronique signée : bloc de signature avec QR de contrôle et empreinte ; rien tant qu'elle n'est pas signée", () => {
    const cabinet = { nom: "Cabinet X", adresse: "", matriculeFiscal: "1234567ABM000", telephone: "", email: "", rib: "", mentions: "" };
    const sha = "ab".repeat(32);
    const signee = { ...facture, einvoice: { statut: "signee" as const, genereLe: null, sha256: "", signeLe: "2026-10-17T11:00:00Z", shaSigne: sha } };
    const html = htmlFacture(signee, cabinet);
    expect(html).toContain("Facture électronique signée");
    expect(html).toContain("17/10/2026");
    expect(html).toContain(sha);
    expect(html).toContain("<svg");
    expect(html).toContain("QR officiel de la plateforme TTN");
    expect(contenuQrControle(signee, cabinet, sha)).toBe(`FACTURE-SIGNEE|2026-0001|1234567ABM000|${facture.netAPayer.toFixed(3)}|${sha}`);

    const preparee = { ...facture, einvoice: { statut: "prete" as const, genereLe: null, sha256: "", shaSigne: null } };
    expect(htmlFacture(preparee, cabinet)).not.toContain("Facture électronique signée");
    expect(htmlFacture(facture, cabinet)).not.toContain("<svg");
  });

  it("facture validée par TTN : QR officiel (PNG de TTN), référence et date ; un QR douteux n'est jamais injecté dans la page", () => {
    const cabinet = { nom: "Cabinet X", adresse: "", matriculeFiscal: "1234567ABM000", telephone: "", email: "", rib: "", mentions: "" };
    const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const validee = (qrPng: string | null) => ({
      ...facture,
      einvoice: { statut: "validee" as const, genereLe: null, sha256: "", signeLe: "2026-10-17T10:00:00Z", shaSigne: "ab".repeat(32), refTtn: "REF-<42>", refTtnDate: "2026-10-17T10:42:00.000Z", qrPng },
    });
    const html = htmlFacture(validee(png), cabinet);
    expect(html).toContain("validée par TTN");
    expect(html).toContain(`src="data:image/png;base64,${png}"`);
    expect(html).toContain("REF-&lt;42&gt;");
    expect(html).toContain("17/10/2026");
    expect(html).not.toContain("QR officiel de la plateforme TTN n'est ajouté"); // plus de mention « à venir »
    expect(htmlFacture(validee('x" onerror="alert(1)'), cabinet)).not.toContain("onerror");
    expect(htmlFacture(validee(null), cabinet)).not.toContain("data:image/png");
  });

  it("modèle « Registre » : logo, identifiants fiscaux et RC des deux parties, TVA par ligne, récapitulatif de TVA, devise", () => {
    const cabinet = {
      nom: "Cabinet X", raisonSociale: "CABINET X SARL", adresse: "", rue: "12 rue du Lac", ville: "Tunis", codePostal: "1053",
      matriculeFiscal: "1234567ABM000", rc: "B0123452026", telephone: "71 000 000", email: "a@b.tn", rib: "04 123 0123456789012 45", mentions: "",
    };
    const html = htmlFacture({ ...facture, clientRne: "B0987652019" }, cabinet, "https://app.test");
    expect(html).toContain('src="https://app.test/brand/logo-cabinet-navy.png"');
    expect(html).toContain("CABINET X SARL");
    expect(html).toContain("12 rue du Lac, 1053 Tunis");
    expect(html).toContain("1234567ABM000");
    expect(html).toContain("B0123452026");
    expect(html).toContain("B0987652019");
    expect(html).toContain("04 123 0123456789012 45");
    expect(html).toContain("Taux TVA");
    expect(html).toContain("Devise");
    expect(html).toContain("Droit de timbre");
    expect(html).toContain("Cachet et signature");
    // pied de page sans mentions saisies : identité légale du cabinet
    expect(html).toContain("CABINET X SARL · RC B0123452026 · MF 1234567ABM000");
  });

  it("s'imprime aussi sans coordonnées de cabinet", () => {
    expect(htmlFacture(facture, null)).toContain("2026-0001");
  });
});

describe("montant en lettres", () => {
  it.each([
    [0, "zéro"], [1, "un"], [21, "vingt et un"], [71, "soixante et onze"], [80, "quatre-vingts"],
    [81, "quatre-vingt-un"], [91, "quatre-vingt-onze"], [100, "cent"], [200, "deux cents"],
    [201, "deux cent un"], [1000, "mille"], [1200, "mille deux cents"], [80000, "quatre-vingt mille"],
    [200000, "deux cent mille"], [2619, "deux mille six cent dix-neuf"], [1000000, "un million"],
    [2500000, "deux millions cinq cent mille"],
  ])("%d -> %s", (n, texte) => {
    expect(nombreEnLettres(n)).toBe(texte);
  });

  it("écrit dinars et millimes avec les pluriels", () => {
    expect(montantEnLettres(1)).toBe("Un dinar");
    expect(montantEnLettres(2619.595)).toBe("Deux mille six cent dix-neuf dinars et cinq cent quatre-vingt-quinze millimes");
    expect(montantEnLettres(120.001)).toBe("Cent vingt dinars et un millime");
  });
});
