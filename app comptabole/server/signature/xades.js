import { feuille, noeud } from "../teif/xml.js";
import { NS } from "./c14n.js";

/**
 * Construction du bloc <ds:Signature> exigé par TTN pour la facture électronique (« Spécifications techniques de la signature
 * électronique, plateforme El Fatoora », V3.0) : signature enveloppée XAdES-B, un seul bloc d'identifiant « SigFrs ».
 * Les valeurs fixes de la politique viennent de cette spécification ; l'empreinte SHA-256 de la politique a été recalculée sur le PDF
 * publié à l'adresse SPURI (elle correspond à celle de l'exemple officiel).
 */

export const ALG = {
  c14n: "http://www.w3.org/2001/10/xml-exc-c14n#",
  rsaSha256: "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256",
  sha256: "http://www.w3.org/2001/04/xmlenc#sha256",
  sha1: "http://www.w3.org/2000/09/xmldsig#sha1",
  xpath: "http://www.w3.org/TR/1999/REC-xpath-19991116",
};

export const POLITIQUE = {
  oid: "urn:2.16.788.1.2.1.3",
  description: "Politique de Signature Electronique de Tunisie TradeNet",
  hash: "ZKLu5TojntPu+bUfZyjaEDvkYsAh7eyyV+Hf8nUSQEE=",
  url: "https://www.tradenet.com.tn/Politique_Signature_Electronique_Tunisie_TradeNet.pdf",
};

export const ID_SIGNATURE = "SigFrs";
export const ID_REFERENCE = "r-id-frs";
export const ID_PROPRIETES = `xades-${ID_SIGNATURE}`;
export const ROLE = "Fournisseur";

// ── ASN.1 DER minimal : seulement de quoi extraire l'émetteur et le numéro de série d'un certificat, octets d'origine conservés ──
function lireTlv(buf, pos) {
  let longueur = buf[pos + 1];
  let entete = 2;
  if (longueur & 0x80) {
    const n = longueur & 0x7f;
    longueur = 0;
    for (let i = 0; i < n; i++) longueur = longueur * 256 + buf[pos + 2 + i];
    entete = 2 + n;
  }
  const fin = pos + entete + longueur;
  if (fin > buf.length) throw new Error("Certificat illisible (ASN.1)");
  return { tag: buf[pos], debut: pos + entete, fin, brut: buf.subarray(pos, fin) };
}

function longueurDer(n) {
  if (n < 128) return Buffer.from([n]);
  const octets = [];
  for (let v = n; v > 0; v = Math.floor(v / 256)) octets.unshift(v % 256);
  return Buffer.from([0x80 | octets.length, ...octets]);
}
const envelopper = (tag, contenu) => Buffer.concat([Buffer.from([tag]), longueurDer(contenu.length), contenu]);

/** IssuerSerial (RFC 5035) en DER, base64 : SEQUENCE { SEQUENCE { [4] émetteur }, numéro de série }. */
export function issuerSerialV2(der) {
  const certificat = lireTlv(der, 0);
  const tbs = lireTlv(der, certificat.debut);
  let t = lireTlv(der, tbs.debut);
  if (t.tag === 0xa0) t = lireTlv(der, t.fin); // version [0] facultative
  const serie = t; // INTEGER
  const algorithme = lireTlv(der, serie.fin);
  const emetteur = lireTlv(der, algorithme.fin);
  const noms = envelopper(0x30, envelopper(0xa4, emetteur.brut));
  return envelopper(0x30, Buffer.concat([noms, serie.brut])).toString("base64");
}

const digestMethod = (algorithme) => feuille("ds:DigestMethod", "", { Algorithm: algorithme });

export function proprietesSignees({ signingTime, empreinteSha1, issuerSerial }) {
  return noeud(
    "xades:SignedProperties",
    [
      noeud("xades:SignedSignatureProperties", [
        feuille("xades:SigningTime", signingTime),
        noeud("xades:SigningCertificateV2", [
          noeud("xades:Cert", [
            noeud("xades:CertDigest", [digestMethod(ALG.sha1), feuille("ds:DigestValue", empreinteSha1)]),
            feuille("xades:IssuerSerialV2", issuerSerial),
          ]),
        ]),
        noeud("xades:SignaturePolicyIdentifier", [
          noeud("xades:SignaturePolicyId", [
            noeud("xades:SigPolicyId", [
              feuille("xades:Identifier", POLITIQUE.oid, { Qualifier: "OIDAsURN" }),
              feuille("xades:Description", POLITIQUE.description),
            ]),
            noeud("xades:SigPolicyHash", [digestMethod(ALG.sha256), feuille("ds:DigestValue", POLITIQUE.hash)]),
            noeud("xades:SigPolicyQualifiers", [noeud("xades:SigPolicyQualifier", [feuille("xades:SPURI", POLITIQUE.url)])]),
          ]),
        ]),
        noeud("xades:SignerRoleV2", [noeud("xades:ClaimedRoles", [feuille("xades:ClaimedRole", ROLE)])]),
      ]),
      noeud("xades:SignedDataObjectProperties", [
        noeud("xades:DataObjectFormat", [feuille("xades:MimeType", "application/octet-stream")], { ObjectReference: `#${ID_REFERENCE}` }),
      ]),
    ],
    { Id: ID_PROPRIETES },
  );
}

export function infoSignee({ digestDocument, digestProprietes }) {
  return noeud("ds:SignedInfo", [
    feuille("ds:CanonicalizationMethod", "", { Algorithm: ALG.c14n }),
    feuille("ds:SignatureMethod", "", { Algorithm: ALG.rsaSha256 }),
    noeud(
      "ds:Reference",
      [
        noeud("ds:Transforms", [
          noeud("ds:Transform", [feuille("ds:XPath", "not(ancestor-or-self::ds:Signature)")], { Algorithm: ALG.xpath }),
          noeud("ds:Transform", [feuille("ds:XPath", "not(ancestor-or-self::RefTtnVal)")], { Algorithm: ALG.xpath }),
          feuille("ds:Transform", "", { Algorithm: ALG.c14n }),
        ]),
        digestMethod(ALG.sha256),
        feuille("ds:DigestValue", digestDocument),
      ],
      { Id: ID_REFERENCE, Type: "", URI: "" },
    ),
    noeud(
      "ds:Reference",
      [noeud("ds:Transforms", [feuille("ds:Transform", "", { Algorithm: ALG.c14n })]), digestMethod(ALG.sha256), feuille("ds:DigestValue", digestProprietes)],
      { Type: "http://uri.etsi.org/01903#SignedProperties", URI: `#${ID_PROPRIETES}` },
    ),
  ]);
}

export function blocSignature({ infoSignee: info, valeurSignature, certificats, proprietes }) {
  return noeud(
    "ds:Signature",
    [
      info,
      feuille("ds:SignatureValue", valeurSignature, { Id: `value-${ID_SIGNATURE}` }),
      noeud("ds:KeyInfo", [noeud("ds:X509Data", certificats.map((c) => feuille("ds:X509Certificate", c.toString("base64"))))]),
      noeud("ds:Object", [noeud("xades:QualifyingProperties", [proprietes], { "xmlns:xades": NS.xades, Target: `#${ID_SIGNATURE}` })]),
    ],
    { "xmlns:ds": NS.ds, Id: ID_SIGNATURE },
  );
}
