import { X509Certificate, createHash, sign, verify } from "node:crypto";
import { serialiserCompact } from "../teif/xml.js";
import { NS, canoniser } from "./c14n.js";
import { ErreurSignature } from "./erreur.js";
import { blocSignature, infoSignee, issuerSerialV2, proprietesSignees } from "./xades.js";

/**
 * Signe le message TEIF (XAdES-B enveloppée, spécification TTN V3.0).
 *
 * Entrées : `racine` (arbre du message, voir construireTeif), `xml` (son texte non signé, voir texteTeif) et le `materiel` déverrouillé
 * (clé privée + certificats). Le résultat est le même texte, avec le bloc <ds:Signature> inséré juste après </InvoiceBody>, SANS
 * retrait ni saut de ligne autour : retirer ce bloc redonne exactement le texte non signé, donc l'empreinte de la référence 1.
 */

const FIN_DOCUMENT = "</InvoiceBody>\n</TEIF>\n";
const b64Sha256 = (texte) => createHash("sha256").update(texte, "utf8").digest("base64");

export function signerTeif({ racine, xml, materiel, maintenant = new Date() }) {
  if (!xml.endsWith(FIN_DOCUMENT) || xml.includes("<ds:Signature") || xml.includes("<RefTtnVal"))
    throw new ErreurSignature("DOCUMENT_INATTENDU", "Le message à signer n'a pas la forme attendue.");
  const fin = new Date(materiel.infos.validAu);
  if (fin < maintenant) throw new ErreurSignature("EXPIRE", `Le certificat est expiré depuis le ${materiel.infos.validAu.slice(0, 10)} : chargez un certificat valide.`);

  // 1. Référence « document entier » : message sans signature, canonisé tel qu'il est écrit (retraits compris).
  const digestDocument = b64Sha256(canoniser(racine, { retrait: true }));

  // 2. Propriétés signées (XAdES), canonisées dans leur contexte (préfixes ds et xades déclarés plus haut dans la signature).
  const signingTime = maintenant.toISOString().replace(/\.\d{3}Z$/, "Z");
  const proprietes = proprietesSignees({
    signingTime,
    empreinteSha1: createHash("sha1").update(materiel.certificat).digest("base64"),
    issuerSerial: issuerSerialV2(materiel.certificat),
  });
  const digestProprietes = b64Sha256(canoniser(proprietes, { portee: { ds: NS.ds, xades: NS.xades } }));

  // 3. SignedInfo canonisé et signé en RSA-SHA256 (PKCS#1 v1.5).
  const info = infoSignee({ digestDocument, digestProprietes });
  const aSigner = Buffer.from(canoniser(info, { portee: { ds: NS.ds } }), "utf8");
  const valeur = sign("sha256", aSigner, materiel.cle);
  if (!verify("sha256", aSigner, new X509Certificate(materiel.certificat).publicKey, valeur))
    throw new ErreurSignature("SIGNATURE_INCOHERENTE", "La signature produite ne se vérifie pas avec le certificat : opération annulée.", 500);

  const bloc = serialiserCompact(
    blocSignature({
      infoSignee: info,
      valeurSignature: valeur.toString("base64"),
      certificats: [materiel.certificat, ...materiel.chaine],
      proprietes,
    }),
  );
  const xmlSigne = `${xml.slice(0, xml.length - FIN_DOCUMENT.length)}</InvoiceBody>${bloc}\n</TEIF>\n`;
  return {
    xmlSigne,
    sha256: createHash("sha256").update(xmlSigne, "utf8").digest("hex"),
    empreinteCertificat: materiel.infos.empreinte,
    signeLe: maintenant,
  };
}
