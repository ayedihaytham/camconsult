import { X509Certificate, createPrivateKey } from "node:crypto";
import forge from "node-forge";
import { ErreurSignature } from "./erreur.js";

/**
 * Lecture d'un fichier PKCS#12 (.p12 / .pfx) du cabinet : clé privée RSA + certificat de signature (+ chaîne éventuelle).
 * node:crypto ne sait pas lire le PKCS#12 : node-forge s'en charge, une seule fois, au chargement et au déverrouillage.
 * Aucun message d'erreur ne contient le mot de passe, la clé ni le contenu du fichier.
 */

const MOT_DE_PASSE_ERRONE = /password|mac|decrypt|padding|pkcs#12 mac/i;

const hex = (empreinte) => empreinte.replace(/:/g, "").toLowerCase();
const versBuffer = (binaire) => Buffer.from(binaire, "binary");
const derDe = (cert) => versBuffer(forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes());
const memeCle = (a, b) => a.n.compareTo(b.n) === 0 && a.e.compareTo(b.e) === 0;

export function decrireCertificat(der) {
  const x = new X509Certificate(der);
  return {
    sujet: x.subject.split("\n").join(", "),
    emetteur: x.issuer.split("\n").join(", "),
    serie: x.serialNumber,
    validDu: new Date(x.validFrom).toISOString(),
    validAu: new Date(x.validTo).toISOString(),
    empreinte: hex(x.fingerprint256),
  };
}

export function lirePkcs12(fichier, motDePasse, maintenant = new Date()) {
  if (!Buffer.isBuffer(fichier) || fichier.length === 0) throw new ErreurSignature("FICHIER_INVALIDE", "Le fichier du certificat est vide.");
  if (typeof motDePasse !== "string" || motDePasse === "") throw new ErreurSignature("MOT_DE_PASSE", "Saisissez le mot de passe du certificat.");

  let asn1;
  try {
    asn1 = forge.asn1.fromDer(forge.util.createBuffer(fichier.toString("binary")));
  } catch {
    throw new ErreurSignature("FICHIER_INVALIDE", "Ce fichier n'est pas un certificat .p12 / .pfx valide.");
  }
  let p12;
  try {
    p12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, motDePasse);
  } catch (e) {
    if (MOT_DE_PASSE_ERRONE.test(String(e?.message))) throw new ErreurSignature("MOT_DE_PASSE", "Mot de passe du certificat incorrect.");
    throw new ErreurSignature("FICHIER_INVALIDE", "Ce fichier .p12 / .pfx n'a pas pu être lu (format de chiffrement non pris en charge ou fichier abîmé).");
  }

  const sacs = (type) => Object.values(p12.getBags({ bagType: type })).flat().filter(Boolean);
  const cles = [...sacs(forge.pki.oids.pkcs8ShroudedKeyBag), ...sacs(forge.pki.oids.keyBag)].map((s) => s.key).filter((k) => k && k.n && k.d);
  if (cles.length === 0) throw new ErreurSignature("SANS_CLE", "Ce fichier ne contient pas de clé privée RSA : il ne peut pas servir à signer.");
  const certificats = sacs(forge.pki.oids.certBag).map((s) => s.cert).filter(Boolean);
  if (certificats.length === 0) throw new ErreurSignature("SANS_CERTIFICAT", "Ce fichier ne contient aucun certificat.");

  const cleForge = cles[0];
  const signataire = certificats.find((c) => c.publicKey?.n && memeCle(c.publicKey, cleForge));
  if (!signataire) throw new ErreurSignature("CLE_DIFFERENTE", "Aucun certificat du fichier ne correspond à la clé privée.");

  const cle = createPrivateKey(forge.pki.privateKeyToPem(cleForge));
  const bits = cle.asymmetricKeyDetails?.modulusLength ?? 0;
  if (cle.asymmetricKeyType !== "rsa" || bits < 2048) throw new ErreurSignature("CLE_FAIBLE", "La clé du certificat doit être une clé RSA d'au moins 2048 bits.");

  const der = derDe(signataire);
  const x509 = new X509Certificate(der);
  if (!x509.checkPrivateKey(cle)) throw new ErreurSignature("CLE_DIFFERENTE", "Le certificat ne correspond pas à la clé privée.");
  const infos = decrireCertificat(der);
  if (new Date(infos.validDu) > maintenant) throw new ErreurSignature("PAS_ENCORE_VALIDE", `Ce certificat n'est pas encore valable (à partir du ${infos.validDu.slice(0, 10)}).`);
  if (new Date(infos.validAu) < maintenant) throw new ErreurSignature("EXPIRE", `Ce certificat est expiré (depuis le ${infos.validAu.slice(0, 10)}).`);

  const avertissements = [];
  const usage = signataire.getExtension("keyUsage");
  if (usage && !usage.digitalSignature && !usage.nonRepudiation)
    avertissements.push("Ce certificat n'est pas déclaré pour la signature électronique : TTN risque de refuser les factures signées.");

  const chaine = certificats.filter((c) => c !== signataire).map(derDe);
  return { cle, certificat: der, chaine, infos, avertissements };
}
