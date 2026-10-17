import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { ErreurTeif, genererTeif } from "./genererTeif.js";
import { entreesSimples } from "./fixtures/entrees.js";

// Données SYNTHÉTIQUES uniquement.
const reference = readFileSync(new URL("./fixtures/facture-simple.xml", import.meta.url), "utf-8").replace(/\r\n/g, "\n");
const generer = (modif = () => undefined) => {
  const e = entreesSimples();
  modif(e);
  return genererTeif(e);
};
const problemes = (modif) => {
  try {
    generer(modif);
  } catch (e) {
    expect(e).toBeInstanceOf(ErreurTeif);
    return e.problemes;
  }
  throw new Error("la génération aurait dû être refusée");
};

describe("génération du message TEIF (facture I-11)", () => {
  it("produit exactement le fichier de référence (structure alignée sur l'exemple et le schéma TTN 1.8.9)", () => {
    expect(generer().xml).toBe(reference);
  });

  it("est déterministe : même entrée, mêmes octets, même empreinte SHA-256", () => {
    const a = generer();
    const b = generer();
    expect(a.xml).toBe(b.xml);
    expect(a.sha256).toBe(createHash("sha256").update(a.xml, "utf8").digest("hex"));
    expect(a.sha256).toBe(b.sha256);
    expect(a.version).toBe("1.8.9");
  });

  it("totaux : HT, TVA sur le total, timbre ajouté après la TVA, TTC en lettres", () => {
    const { xml } = generer();
    expect(xml).toContain('<Moa amountTypeCode="I-176" currencyCodeList="ISO_4217">\n          <Amount currencyIdentifier="TND">700.000</Amount>');
    expect(xml).toContain('<Amount currencyIdentifier="TND">133.000</Amount>'); // TVA 19 % de 700
    expect(xml).toContain('<Amount currencyIdentifier="TND">834.000</Amount>'); // 700 + 133 + 1
    expect(xml).toContain("<AmountDescription lang=\"fr\">HUIT CENT TRENTE-QUATRE DINARS</AmountDescription>");
    // I-181 = TVA seule (le timbre n'y entre pas), comme dans l'exemple TTN
    const totalTaxes = xml.indexOf('amountTypeCode="I-181"');
    expect(xml.slice(totalTaxes, totalTaxes + 120)).toContain("133.000");
  });

  it("montant en lettres sans accent ni minuscule, avec les millimes", () => {
    const { xml } = generer((e) => {
      e.facture.lignes = [{ description: "x", quantite: 1, montantHt: 0.5 }];
      e.facture.timbre = 0;
      e.facture.tvaTaux = 0;
    });
    expect(xml).toContain("ZERO DINAR ET CINQ CENTS MILLIMES");
    expect(xml).not.toMatch(/AmountDescription[^>]*>[^<]*[a-zéèà]/);
  });

  it("dates au format ddMMyy ; échéance facultative", () => {
    expect(generer().xml).toContain('<DateText format="ddMMyy" functionCode="I-31">171026</DateText>');
    expect(generer().xml).toContain('<DateText format="ddMMyy" functionCode="I-32">161126</DateText>');
    expect(generer((e) => (e.facture.echeance = null)).xml).not.toContain("I-32");
  });

  it("montants à 3 décimales avec point, quantités avec au moins une décimale", () => {
    const { xml } = generer((e) => {
      e.facture.lignes = [{ description: "Prestation", quantite: 2.5, montantHt: 10.1 }];
    });
    expect(xml).toContain('<Quantity measurementUnit="UNIT">2.5</Quantity>');
    expect(xml).toContain('<Amount currencyIdentifier="TND">10.100</Amount>');
    expect(xml).toContain('<Amount currencyIdentifier="TND">25.250</Amount>');
    expect(xml).not.toMatch(/Amount currencyIdentifier="TND">[0-9]+,/);
  });

  it("sans timbre : aucune ligne de timbre ; avec TVA à 0 % : message, avertissement, TVA nulle", () => {
    const sansTimbre = generer((e) => (e.facture.timbre = 0)).xml;
    expect(sansTimbre).not.toContain("I-1601");
    const r = generer((e) => (e.facture.tvaTaux = 0));
    expect(r.xml).toContain("<TaxRate>0</TaxRate>");
    expect(r.avertissements.map((p) => p.champ)).toContain("tvaTaux");
  });

  it("n'écrit ni virement, ni observation, ni registre de commerce quand ils sont vides", () => {
    const { xml } = generer((e) => {
      e.cabinet.rib = "";
      e.cabinet.rc = "";
      e.facture.note = "";
    });
    expect(xml).not.toContain("PytSection");
    expect(xml).not.toContain("<Ftx>");
    expect(xml).not.toContain("I-815");
  });

  it("échappe & < > \" ' et retire les caractères interdits en XML", () => {
    const { xml } = generer((e) => {
      e.client.nom = 'A&B <SARL> "x" d\'y';
      e.facture.lignes[0].description = "Ligne\u0001 avec\u0000 contrôle";
    });
    expect(xml).toContain("A&amp;B &lt;SARL&gt; &quot;x&quot; d&apos;y");
    expect(xml).toContain("Ligne avec contrôle");
    // eslint-disable-next-line no-control-regex
    expect(xml).not.toMatch(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/);
  });

  it("normalise les identifiants (majuscules, sans espace) et le pays", () => {
    const { xml } = generer((e) => {
      e.cabinet.matriculeFiscal = " 1234567abm000 ";
      e.client.pays = "tn";
    });
    expect(xml).toContain('<MessageSenderIdentifier type="I-01">1234567ABM000</MessageSenderIdentifier>');
    expect(xml).toContain('<Country codeList="ISO_3166-1">TN</Country>');
  });
});

describe("refus de produire un message non conforme", () => {
  const champs = (p) => p.filter((x) => x.niveau === "bloquant").map((x) => `${x.ou}:${x.champ}`);

  it("matricule fiscal invalide du cabinet ou du client", () => {
    expect(champs(problemes((e) => (e.cabinet.matriculeFiscal = "005910DAM000")))).toContain("cabinet:matriculeFiscal");
    expect(champs(problemes((e) => (e.client.matriculeFiscal = "")))).toContain("societe:matriculeFiscal");
  });

  it("adresse incomplète", () => {
    const p = champs(problemes((e) => {
      e.client.ville = "";
      e.client.codePostal = "";
      e.cabinet.pays = "TUN";
    }));
    expect(p).toEqual(expect.arrayContaining(["societe:ville", "societe:codePostal", "cabinet:pays"]));
  });

  it("longueurs maximales du schéma (rue 35, description 500)", () => {
    expect(champs(problemes((e) => (e.cabinet.rue = "R".repeat(36))))).toContain("cabinet:rue");
    expect(champs(problemes((e) => (e.facture.lignes[0].description = "d".repeat(501))))).toContain("facture:lignes");
  });

  it("numéro de facture inutilisable comme identifiant TEIF (espace, « / », plus de 30 caractères)", () => {
    for (const numero of ["2026 0001", "2026/0001", "é2026", "A".repeat(31)]) {
      expect(champs(problemes((e) => (e.facture.numero = numero)))).toContain("facture:numero");
    }
  });

  it("facture annulée, sans ligne, quantité nulle, prix à plus de 3 décimales", () => {
    expect(champs(problemes((e) => (e.facture.statut = "annulee")))).toContain("facture:statut");
    expect(champs(problemes((e) => (e.facture.lignes = [])))).toContain("facture:lignes");
    expect(champs(problemes((e) => (e.facture.lignes[0].quantite = 0)))).toContain("facture:lignes");
    expect(problemes((e) => (e.facture.lignes[0].montantHt = 10.1234)).map((x) => x.message).join(" ")).toMatch(/3 décimales/);
  });

  it("lignes arrondies qui ne totalisent pas le total HT : refus explicite, jamais d'arrondi silencieux", () => {
    // 3 × 0,0004 = 0,0012 → total HT arrondi 0,001, alors que chaque ligne arrondie vaut 0 : écart de 0,001.
    const p = problemes((e) => {
      e.facture.lignes = [
        { description: "a", quantite: 1, montantHt: 0.0004 },
        { description: "b", quantite: 1, montantHt: 0.0004 },
        { description: "c", quantite: 1, montantHt: 0.0004 },
      ];
    });
    expect(p.map((x) => x.message).join(" ")).toMatch(/plus de 3 décimales|totalisent/);
    // quantité fractionnaire dont le produit a plus de 3 décimales : lignes 1,5 × 0,333 = 0,4995 → 0,500 (ligne) ; total identique, accepté
    expect(() => generer((e) => (e.facture.lignes = [{ description: "ok", quantite: 1.5, montantHt: 0.333 }]))).not.toThrow();
  });

  it("deux lignes dont les arrondis individuels divergent du total arrondi", () => {
    const p = problemes((e) => {
      e.facture.lignes = [
        { description: "a", quantite: 0.5, montantHt: 0.001 }, // 0,0005 → 0,001
        { description: "b", quantite: 0.5, montantHt: 0.001 }, // 0,0005 → 0,001 ; total non arrondi 0,001 → somme des lignes 0,002
      ];
    });
    expect(p.map((x) => x.message).join(" ")).toMatch(/totalisent 0\.002.*0\.001/);
  });
});
