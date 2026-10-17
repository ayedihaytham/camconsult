import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { validateXML } from "xmllint-wasm";
import { genererTeif } from "./genererTeif.js";
import { entreesSimples } from "./fixtures/entrees.js";

/**
 * Conformité au schéma TTN 1.8.9 (sans signature) du message généré. Le schéma n'est PAS dans le dépôt (document de TTN) : il est lu dans le pack
 * `samples/Specifications_techniques_Elfatoora (2).zip` ; sans ce fichier (CI), les tests sont ignorés.
 * Limite : le schéma utilise des assertions XSD 1.1 (motifs du matricule fiscal, du numéro de facture) que libxml2 ne sait pas exécuter ; elles sont
 * retirées ici (et remplacées par shared/mf.js et validerTeif.js, testés à part), comme l'alternative de type du partenaire fournisseur et l'import
 * de la signature XML. Ce test vérifie donc la structure, l'ordre, les types, les énumérations et les longueurs, pas ces assertions.
 */
const ZIP = "samples/Specifications_techniques_Elfatoora (2).zip";
const present = existsSync(ZIP);

async function schemaSansAssertions() {
  const JSZip = createRequire(import.meta.url)("jszip");
  const zip = await JSZip.loadAsync(readFileSync(ZIP));
  const entree = zip.file(/1_8_9_XSD_withoutSig\.xsd$/)[0];
  const xsd = await entree.async("string");
  return xsd
    .replace(/<xs:element name="PartnerDetails" maxOccurs="unbounded">[\s\S]*?<\/xs:element>/, '<xs:element name="PartnerDetails" type="PartDetailType" maxOccurs="unbounded"/>')
    .replace(/<xs:assert\s+test="[^"]*"\s*\/>/g, "")
    .replace(/<xs:assertion\s+test="[^"]*"\s*\/>/g, "")
    .replace(/\svc:minVersion="[^"]*"/g, "")
    .replace(/<xs:import\b[^>]*\/>/g, "");
}

async function valider(xml, xsd) {
  const r = await validateXML({ xml: [{ fileName: "facture.xml", contents: xml }], schema: [{ fileName: "teif.xsd", contents: xsd }] });
  return { valide: r.valid, erreurs: (r.errors ?? []).map((e) => e.message ?? String(e)) };
}

describe.skipIf(!present)("message TEIF généré et schéma TTN 1.8.9", () => {
  it("la facture simple est valide", async () => {
    const xsd = await schemaSansAssertions();
    expect(await valider(genererTeif(entreesSimples()).xml, xsd)).toEqual({ valide: true, erreurs: [] });
  });

  it.each([
    ["sans timbre ni virement ni observation ni échéance", (e) => Object.assign(e.facture, { timbre: 0, note: "", echeance: null }) && Object.assign(e.cabinet, { rib: "", rc: "" })],
    ["TVA à 7 % et quantités fractionnaires", (e) => Object.assign(e.facture, { tvaTaux: 7, lignes: [{ description: "x", quantite: 2.5, montantHt: 10.1 }] })],
    ["TVA à 0 %", (e) => (e.facture.tvaTaux = 0)],
    ["adresse sans rue séparée", (e) => (e.client.rue = "")],
    ["nombreuses lignes", (e) => (e.facture.lignes = Array.from({ length: 40 }, (_, i) => ({ description: `Ligne ${i + 1}`, quantite: 1, montantHt: 10 + i })))],
  ])("variante valide : %s", async (_nom, modif) => {
    const e = entreesSimples();
    modif(e);
    expect((await valider(genererTeif(e).xml, await schemaSansAssertions())).erreurs).toEqual([]);
  });

  it("le contrôle est réel : un élément manquant, mal nommé ou dans le mauvais ordre est refusé par le schéma", async () => {
    const xsd = await schemaSansAssertions();
    const { xml } = genererTeif(entreesSimples());
    expect((await valider(xml.replace(/<InvoiceHeader>[\s\S]*?<\/InvoiceHeader>\n\s*/, ""), xsd)).valide).toBe(false);
    expect((await valider(xml.replaceAll("InvoiceMoa", "InvoiceMoaX"), xsd)).valide).toBe(false);
    expect((await valider(xml.replace(/(<Dtm>[\s\S]*?<\/Dtm>)(\s*)(<PartnerSection>)/, "$3$2$1"), xsd)).valide).toBe(false);
    expect((await valider(xml.replace('format="ddMMyy"', 'format="ddMMyyyy"'), xsd)).valide).toBe(false);
  });
});
