import { X509Certificate, createHash, verify } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { DOMParser } from "@xmldom/xmldom";
import forge from "node-forge";
import { ExclusiveCanonicalization } from "xml-crypto";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { construireTeif, texteTeif } from "../teif/genererTeif.js";
import { entreesSimples } from "../teif/fixtures/entrees.js";
import { feuille, noeud, serialiser } from "../teif/xml.js";
import { NS, canoniser } from "./c14n.js";
import { chiffrer, dechiffrer, secretConfigure } from "./coffre.js";
import { DUREE_MS, ESSAIS_MAX, _reinitialiser, deverrouiller, etat, memoriser, obtenir, verrouiller } from "./deverrouillage.js";
import { ErreurSignature } from "./erreur.js";
import { MOT_DE_PASSE_TEST, creerPkcs12DeTest } from "./fixtures/certificatDeTest.js";
import { lirePkcs12 } from "./pkcs12.js";
import { signerTeif } from "./signerTeif.js";
import { ID_PROPRIETES, ID_SIGNATURE, POLITIQUE, issuerSerialV2 } from "./xades.js";

// Certificats et données SYNTHÉTIQUES uniquement. Les vérifications de la signature n'utilisent PAS notre canonicalisation :
// elles s'appuient sur l'implémentation indépendante de xml-crypto et sur node:crypto.

const SECRET = "secret-de-test-assez-long-pour-le-coffre-123456";
const exc = new ExclusiveCanonicalization();
const sha256b64 = (t) => createHash("sha256").update(t, "utf8").digest("base64");
const lever = (f) => {
  try {
    f();
  } catch (e) {
    return e;
  }
  throw new Error("une erreur était attendue");
};

describe("coffre du certificat (AES-256-GCM)", () => {
  const p12 = Buffer.from("contenu-p12-fictif".repeat(20));

  it("aller-retour exact ; l'enveloppe ne contient pas les données en clair", () => {
    const e = chiffrer(p12, SECRET);
    expect(e.includes(p12.subarray(0, 12))).toBe(false);
    expect(dechiffrer(e, SECRET).equals(p12)).toBe(true);
  });

  it("deux chiffrements du même contenu diffèrent (IV aléatoire)", () => {
    expect(chiffrer(p12, SECRET).equals(chiffrer(p12, SECRET))).toBe(false);
  });

  it("falsification, mauvaise clé et enveloppe tronquée sont refusées sans fuite", () => {
    const e = chiffrer(p12, SECRET);
    const abime = Buffer.from(e);
    abime[abime.length - 1] ^= 1;
    expect(lever(() => dechiffrer(abime, SECRET))).toMatchObject({ code: "COFFRE_CLE_CHANGEE" });
    expect(lever(() => dechiffrer(e, `${SECRET}x`))).toMatchObject({ code: "COFFRE_CLE_CHANGEE" });
    expect(lever(() => dechiffrer(e.subarray(0, 10), SECRET))).toMatchObject({ code: "COFFRE_ILLISIBLE" });
    expect(String(lever(() => dechiffrer(abime, SECRET)).message)).not.toContain(SECRET);
  });

  it("refuse un secret absent ou trop court", () => {
    expect(lever(() => chiffrer(p12, ""))).toMatchObject({ code: "NON_CONFIGUREE" });
    expect(lever(() => chiffrer(p12, "court"))).toMatchObject({ code: "NON_CONFIGUREE" });
    expect(secretConfigure({})).toBeNull();
    expect(secretConfigure({ SIGNATURE_CLE_SECRET: "court" })).toBeNull();
    expect(secretConfigure({ SIGNATURE_CLE_SECRET: SECRET })).toBe(SECRET);
  });
});

describe("lecture du PKCS#12", () => {
  it("lit la clé, le certificat et la chaîne (chiffrement 3DES et AES-256)", () => {
    for (const algorithme of ["3des", "aes256"]) {
      const { p12, motDePasse } = creerPkcs12DeTest({ algorithme });
      const lu = lirePkcs12(p12, motDePasse);
      expect(lu.cle.asymmetricKeyType).toBe("rsa");
      expect(lu.chaine).toHaveLength(1);
      expect(lu.infos.sujet).toContain("CN=CABINET DE TEST");
      expect(lu.infos.emetteur).toContain("CN=AUTORITE DE TEST");
      expect(lu.infos.empreinte).toBe(createHash("sha256").update(lu.certificat).digest("hex"));
      expect(lu.avertissements).toEqual([]);
    }
  });

  it("mauvais mot de passe, fichier invalide, fichier vide : erreurs claires sans fuite", () => {
    const { p12 } = creerPkcs12DeTest();
    const mdp = lever(() => lirePkcs12(p12, "faux-9271-zx"));
    expect(mdp).toMatchObject({ code: "MOT_DE_PASSE" });
    expect(String(mdp.message)).not.toContain("faux-9271-zx");
    expect(lever(() => lirePkcs12(Buffer.from("pas un p12"), "x"))).toMatchObject({ code: "FICHIER_INVALIDE" });
    expect(lever(() => lirePkcs12(Buffer.alloc(0), "x"))).toMatchObject({ code: "FICHIER_INVALIDE" });
    expect(lever(() => lirePkcs12(p12, ""))).toMatchObject({ code: "MOT_DE_PASSE" });
  });

  it("refuse un certificat expiré, pas encore valable, une clé trop faible ou un fichier sans clé", () => {
    const jour = 24 * 3600 * 1000;
    const expire = creerPkcs12DeTest({ debut: new Date(Date.now() - 400 * jour), fin: new Date(Date.now() - 10 * jour) });
    expect(lever(() => lirePkcs12(expire.p12, expire.motDePasse))).toMatchObject({ code: "EXPIRE" });
    const futur = creerPkcs12DeTest({ debut: new Date(Date.now() + 10 * jour), fin: new Date(Date.now() + 400 * jour) });
    expect(lever(() => lirePkcs12(futur.p12, futur.motDePasse))).toMatchObject({ code: "PAS_ENCORE_VALIDE" });
    const faible = creerPkcs12DeTest({ bits: 1024 });
    expect(lever(() => lirePkcs12(faible.p12, faible.motDePasse))).toMatchObject({ code: "CLE_FAIBLE" });
    const sansCle = creerPkcs12DeTest({ sansCle: true });
    expect(lever(() => lirePkcs12(sansCle.p12, sansCle.motDePasse))).toMatchObject({ code: "SANS_CLE" });
  });

  it("avertit quand le certificat n'est pas déclaré pour la signature", () => {
    const { p12, motDePasse } = creerPkcs12DeTest({ usage: { keyEncipherment: true } });
    expect(lirePkcs12(p12, motDePasse).avertissements[0]).toMatch(/signature électronique/);
  });
});

describe("déverrouillage en mémoire", () => {
  afterEach(() => {
    vi.useRealTimers();
    _reinitialiser();
  });
  const { p12, motDePasse } = creerPkcs12DeTest();

  it("verrouillé par défaut ; déverrouille, expire après 15 minutes, se verrouille à la demande", () => {
    vi.useFakeTimers();
    expect(etat()).toEqual({ deverrouille: false, expireLe: null });
    expect(deverrouiller(p12, motDePasse).deverrouille).toBe(true);
    expect(obtenir()).not.toBeNull();
    vi.advanceTimersByTime(DUREE_MS - 1000);
    expect(obtenir()).not.toBeNull();
    vi.advanceTimersByTime(2000);
    expect(obtenir()).toBeNull();
    expect(etat().deverrouille).toBe(false);
    deverrouiller(p12, motDePasse);
    verrouiller();
    expect(obtenir()).toBeNull();
    memoriser(lirePkcs12(p12, motDePasse));
    expect(etat().deverrouille).toBe(true);
  });

  it("limite les mots de passe incorrects, puis rouvre après la fenêtre", () => {
    vi.useFakeTimers();
    for (let i = 0; i < ESSAIS_MAX; i++) expect(lever(() => deverrouiller(p12, "faux"))).toMatchObject({ code: "MOT_DE_PASSE" });
    const bloque = lever(() => deverrouiller(p12, motDePasse));
    expect(bloque).toMatchObject({ code: "TROP_ESSAIS", statut: 429 });
    expect(obtenir()).toBeNull();
    vi.advanceTimersByTime(16 * 60 * 1000);
    expect(deverrouiller(p12, motDePasse).deverrouille).toBe(true);
  });

  it("un mot de passe correct remet le compteur à zéro", () => {
    for (let i = 0; i < ESSAIS_MAX - 1; i++) lever(() => deverrouiller(p12, "faux"));
    deverrouiller(p12, motDePasse);
    for (let i = 0; i < ESSAIS_MAX - 1; i++) expect(lever(() => deverrouiller(p12, "faux"))).toMatchObject({ code: "MOT_DE_PASSE" });
  });
});

describe("canonicalisation exclusive : accord avec xml-crypto sur ce qu'un analyseur XML relit", () => {
  const racineDifficile = () =>
    noeud(
      "TEIF",
      [
        noeud("A", [
          feuille("B", `a & b < c > d "q" 'r' é € 𝄞 — fin`, { x: `v"&<>'`, a: "1", Z: "2" }),
          feuille("Vide", ""),
          noeud("C", []),
          feuille("D", `ligne1\nligne2\u0001\u000b`, { t: "avec\ttab" }),
        ]),
      ],
      { version: "1.8.9", controlingAgency: "TTN" },
    );

  it("texte et attributs difficiles", () => {
    const racine = racineDifficile();
    const doc = new DOMParser().parseFromString(`<?xml version="1.0" encoding="UTF-8"?>\n${serialiser(racine)}\n`, "text/xml");
    expect(canoniser(racine, { retrait: true })).toBe(exc.process(doc.documentElement, {}));
  });

  it("message TEIF complet généré par l'application", () => {
    const { racine } = construireTeif(entreesSimples());
    const doc = new DOMParser().parseFromString(texteTeif(racine), "text/xml");
    expect(canoniser(racine, { retrait: true })).toBe(exc.process(doc.documentElement, {}));
  });
});

describe("signature XAdES du message TEIF", () => {
  let racine;
  let xml;
  let materiel;
  let signe;
  let doc;
  const maintenant = new Date("2026-10-17T10:00:00.000Z");

  beforeAll(() => {
    ({ racine } = construireTeif(entreesSimples()));
    xml = texteTeif(racine);
    const { p12, motDePasse } = creerPkcs12DeTest();
    materiel = lirePkcs12(p12, motDePasse);
    signe = signerTeif({ racine, xml, materiel, maintenant });
    doc = new DOMParser().parseFromString(signe.xmlSigne, "text/xml");
  });

  const premier = (parent, nom) => parent.getElementsByTagName(nom)[0];
  const texte = (el) => el.textContent;
  const enfantsPar = (nom) => Array.from(doc.getElementsByTagName(nom));

  it("le document signé est exactement le document préparé avec le bloc inséré après InvoiceBody", () => {
    expect(signe.xmlSigne.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<TEIF ')).toBe(true);
    expect(signe.xmlSigne.endsWith("</InvoiceBody><ds:Signature") || signe.xmlSigne.includes("</InvoiceBody><ds:Signature ")).toBe(true);
    expect(signe.xmlSigne.endsWith("</ds:Signature>\n</TEIF>\n")).toBe(true);
    expect(signe.xmlSigne.replace(/<ds:Signature[\s\S]*<\/ds:Signature>/, "")).toBe(xml);
    expect(signe.sha256).toBe(createHash("sha256").update(signe.xmlSigne, "utf8").digest("hex"));
    expect(signe.signeLe).toEqual(maintenant);
    expect(signe.empreinteCertificat).toBe(materiel.infos.empreinte);
  });

  it("référence 1 : l'empreinte du message sans signature se retrouve avec l'implémentation indépendante", () => {
    const copie = new DOMParser().parseFromString(signe.xmlSigne, "text/xml");
    for (const nom of ["ds:Signature", "RefTtnVal"]) for (const el of Array.from(copie.getElementsByTagName(nom))) el.parentNode.removeChild(el);
    const attendu = sha256b64(exc.process(copie.documentElement, {}));
    const reference = enfantsPar("ds:Reference").find((r) => r.getAttribute("Id") === "r-id-frs");
    expect(texte(premier(reference, "ds:DigestValue"))).toBe(attendu);
    expect(reference.getAttribute("URI")).toBe("");
  });

  it("référence 2 : l'empreinte des propriétés signées (SignedProperties) est exacte", () => {
    const props = enfantsPar("xades:SignedProperties")[0];
    expect(props.getAttribute("Id")).toBe(ID_PROPRIETES);
    const canon = exc.process(props, {
      ancestorNamespaces: [
        { prefix: "ds", namespaceURI: NS.ds },
        { prefix: "xades", namespaceURI: NS.xades },
      ],
    });
    const reference = enfantsPar("ds:Reference").find((r) => r.getAttribute("URI") === `#${ID_PROPRIETES}`);
    expect(texte(premier(reference, "ds:DigestValue"))).toBe(sha256b64(canon));
  });

  it("valeur de signature : RSA-SHA256 sur SignedInfo canonisé, vérifiée avec le certificat du bloc KeyInfo", () => {
    const info = enfantsPar("ds:SignedInfo")[0];
    const canon = exc.process(info, { ancestorNamespaces: [{ prefix: "ds", namespaceURI: NS.ds }] });
    const valeur = Buffer.from(texte(enfantsPar("ds:SignatureValue")[0]), "base64");
    const certs = enfantsPar("ds:X509Certificate").map((c) => new X509Certificate(Buffer.from(texte(c), "base64")));
    expect(certs).toHaveLength(2); // signataire, puis autorité
    expect(certs[0].raw.equals(materiel.certificat)).toBe(true);
    expect(verify("sha256", Buffer.from(canon, "utf8"), certs[0].publicKey, valeur)).toBe(true);
    // toute altération du SignedInfo ou de la valeur invalide la signature
    expect(verify("sha256", Buffer.from(`${canon} `, "utf8"), certs[0].publicKey, valeur)).toBe(false);
  });

  it("structure imposée par TTN : identifiants, algorithmes, transformations, politique et rôle", () => {
    const sig = enfantsPar("ds:Signature")[0];
    expect(sig.getAttribute("Id")).toBe(ID_SIGNATURE);
    expect(enfantsPar("ds:Signature")).toHaveLength(1);
    expect(sig.parentNode.nodeName).toBe("TEIF");
    expect(sig.previousSibling.nodeName).toBe("InvoiceBody");
    expect(premier(sig, "ds:CanonicalizationMethod").getAttribute("Algorithm")).toBe("http://www.w3.org/2001/10/xml-exc-c14n#");
    expect(premier(sig, "ds:SignatureMethod").getAttribute("Algorithm")).toBe("http://www.w3.org/2001/04/xmldsig-more#rsa-sha256");
    expect(enfantsPar("ds:XPath").map(texte)).toEqual(["not(ancestor-or-self::ds:Signature)", "not(ancestor-or-self::RefTtnVal)"]);
    expect(premier(sig, "ds:SignatureValue").getAttribute("Id")).toBe(`value-${ID_SIGNATURE}`);
    expect(premier(sig, "xades:QualifyingProperties").getAttribute("Target")).toBe(`#${ID_SIGNATURE}`);
    expect(texte(premier(sig, "xades:SigningTime"))).toBe("2026-10-17T10:00:00Z");
    const id = premier(sig, "xades:Identifier");
    expect(id.getAttribute("Qualifier")).toBe("OIDAsURN");
    expect(texte(id)).toBe("urn:2.16.788.1.2.1.3");
    expect(texte(premier(sig, "xades:SPURI"))).toBe(POLITIQUE.url);
    const hash = premier(premier(sig, "xades:SigPolicyHash"), "ds:DigestValue");
    expect(texte(hash)).toBe("ZKLu5TojntPu+bUfZyjaEDvkYsAh7eyyV+Hf8nUSQEE=");
    expect(texte(premier(sig, "xades:ClaimedRole"))).toBe("Fournisseur");
    expect(premier(sig, "xades:DataObjectFormat").getAttribute("ObjectReference")).toBe("#r-id-frs");
  });

  it("CertDigest (SHA-1 du certificat) et IssuerSerialV2 sont corrects, relus par un décodeur ASN.1 indépendant", () => {
    const sig = enfantsPar("ds:Signature")[0];
    const cert = premier(sig, "xades:CertDigest");
    expect(texte(premier(cert, "ds:DigestValue"))).toBe(createHash("sha1").update(materiel.certificat).digest("base64"));
    const der = Buffer.from(texte(premier(sig, "xades:IssuerSerialV2")), "base64");
    const asn1 = forge.asn1.fromDer(forge.util.createBuffer(der.toString("binary")));
    const [noms, serie] = asn1.value;
    const directoryName = noms.value[0];
    expect(directoryName.tagClass).toBe(forge.asn1.Class.CONTEXT_SPECIFIC);
    expect(directoryName.type).toBe(4);
    const x509 = new X509Certificate(materiel.certificat);
    const issuerAttendu = forge.asn1.toDer(forge.pki.distinguishedNameToAsn1(forge.pki.certificateFromPem(x509.toString()).issuer)).getBytes();
    expect(forge.asn1.toDer(directoryName.value[0]).getBytes()).toBe(issuerAttendu);
    expect(Buffer.from(forge.asn1.toDer(serie).getBytes(), "binary").subarray(2).toString("hex")).toBe(x509.serialNumber.toLowerCase().replace(/^0+/, "").padStart(16, "0"));
    expect(issuerSerialV2(materiel.certificat)).toBe(der.toString("base64"));
  });

  it("détecte toute modification du message après signature", () => {
    const abime = new DOMParser().parseFromString(signe.xmlSigne.replace("700.000", "7000.000"), "text/xml");
    for (const nom of ["ds:Signature", "RefTtnVal"]) for (const el of Array.from(abime.getElementsByTagName(nom))) el.parentNode.removeChild(el);
    const recalcule = sha256b64(exc.process(abime.documentElement, {}));
    const reference = enfantsPar("ds:Reference").find((r) => r.getAttribute("Id") === "r-id-frs");
    expect(texte(premier(reference, "ds:DigestValue"))).not.toBe(recalcule);
  });

  it("l'ajout ultérieur de RefTtnVal et d'une signature TTN ne casse pas la référence 1 (cas réel de la plateforme)", () => {
    const ajout = signe.xmlSigne.replace(
      "</ds:Signature>\n</TEIF>",
      '</ds:Signature><RefTtnVal><ReferenceTTN refID="I-88">0000</ReferenceTTN></RefTtnVal><ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Id="SigTTN"></ds:Signature>\n</TEIF>',
    );
    const copie = new DOMParser().parseFromString(ajout, "text/xml");
    for (const nom of ["ds:Signature", "RefTtnVal"]) for (const el of Array.from(copie.getElementsByTagName(nom))) el.parentNode.removeChild(el);
    const reference = enfantsPar("ds:Reference").find((r) => r.getAttribute("Id") === "r-id-frs");
    expect(texte(premier(reference, "ds:DigestValue"))).toBe(sha256b64(exc.process(copie.documentElement, {})));
  });

  it("refuse de signer avec un certificat expiré, un message déjà signé ou de forme inattendue", () => {
    expect(lever(() => signerTeif({ racine, xml, materiel, maintenant: new Date("2040-01-01T00:00:00Z") }))).toMatchObject({ code: "EXPIRE" });
    expect(lever(() => signerTeif({ racine, xml: signe.xmlSigne, materiel, maintenant }))).toBeInstanceOf(ErreurSignature);
    expect(lever(() => signerTeif({ racine, xml: `${xml}x`, materiel, maintenant }))).toMatchObject({ code: "DOCUMENT_INATTENDU" });
  });

  it("deux signatures du même message donnent des empreintes de référence identiques (document déterministe)", () => {
    const autre = signerTeif({ racine, xml, materiel, maintenant: new Date("2026-10-17T10:05:00Z") });
    const refs = (x) => Array.from(new DOMParser().parseFromString(x, "text/xml").getElementsByTagName("ds:Reference")).map((r) => r.getElementsByTagName("ds:DigestValue")[0].textContent);
    expect(refs(autre.xmlSigne)[0]).toBe(refs(signe.xmlSigne)[0]);
    expect(refs(autre.xmlSigne)[1]).not.toBe(refs(signe.xmlSigne)[1]); // l'heure de signature fait partie des propriétés signées
  });

  it("MOT_DE_PASSE_TEST n'apparaît jamais dans le document signé", () => {
    expect(signe.xmlSigne).not.toContain(MOT_DE_PASSE_TEST);
  });
});

describe("exemple officiel TTN (si le pack est présent)", () => {
  const ZIP = "samples/Specifications_techniques_Elfatoora (2).zip";
  let exemple = null;
  try {
    const JSZip = createRequire(import.meta.url)("jszip");
    exemple = readFileSync(ZIP);
    exemple = { JSZip, zip: exemple };
  } catch {
    exemple = null;
  }

  it.skipIf(!exemple)("IssuerSerialV2 et CertDigest recalculés à partir du certificat de l'exemple officiel", async () => {
    const zip = await exemple.JSZip.loadAsync(exemple.zip);
    const texte = await zip.file("elfatooraSpecTech/exemple_signe_elfatoora.xml").async("string");
    const sigFrs = texte.slice(texte.indexOf('Id="SigFrs"'), texte.indexOf('Id="SigTTN"'));
    const cert = Buffer.from(/<ds:X509Certificate>\s*([^<\s]+)\s*<\/ds:X509Certificate>/.exec(sigFrs)[1], "base64");
    const attenduSerie = /<xades:IssuerSerialV2>\s*([^<\s]+)\s*<\/xades:IssuerSerialV2>/.exec(sigFrs)[1];
    const attenduDigest = /<xades:CertDigest>[\s\S]*?<ds:DigestValue>([^<]+)<\/ds:DigestValue>/.exec(sigFrs)[1];
    expect(issuerSerialV2(cert)).toBe(attenduSerie);
    expect(createHash("sha1").update(cert).digest("base64")).toBe(attenduDigest);
  });
});
