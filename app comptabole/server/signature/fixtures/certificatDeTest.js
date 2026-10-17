import { generateKeyPairSync } from "node:crypto";
import forge from "node-forge";

/**
 * Certificats SYNTHÉTIQUES pour les tests (autorité racine fictive + certificat de signature fictif) : aucun vrai certificat, aucun
 * matricule réel. Les paires de clés sont créées par node:crypto (rapide) puis importées dans node-forge pour construire le .p12.
 */

export const MOT_DE_PASSE_TEST = "mot-de-passe-de-test-seulement";

const cache = new Map();
function paire(nom, bits = 2048) {
  const cleCache = `${nom}-${bits}`;
  if (!cache.has(cleCache)) {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: bits });
    cache.set(cleCache, {
      privee: forge.pki.privateKeyFromPem(privateKey.export({ type: "pkcs1", format: "pem" })),
      publique: forge.pki.publicKeyFromPem(publicKey.export({ type: "spki", format: "pem" })),
    });
  }
  return cache.get(cleCache);
}

const attributs = (cn, o) => [
  { name: "countryName", value: "TN" },
  { name: "organizationName", value: o },
  { name: "commonName", value: cn },
];

function creerCertificat({ publique, signataire, sujet, emetteur, serie, debut, fin, extensions }) {
  const c = forge.pki.createCertificate();
  c.publicKey = publique;
  c.serialNumber = serie;
  c.validity.notBefore = debut;
  c.validity.notAfter = fin;
  c.setSubject(sujet);
  c.setIssuer(emetteur);
  c.setExtensions(extensions);
  c.sign(signataire, forge.md.sha256.create());
  return c;
}

/**
 * @returns { p12: Buffer, motDePasse, bits }
 * Options : debut/fin (dates de validité), bits (taille de la clé du signataire), usage (extension keyUsage), chaine (inclure l'autorité),
 * sansCle (fichier sans clé privée), algorithme ("3des" ou "aes256" pour le chiffrement du .p12).
 */
export function creerPkcs12DeTest({
  motDePasse = MOT_DE_PASSE_TEST,
  debut = new Date(Date.now() - 24 * 3600 * 1000),
  fin = new Date(Date.now() + 365 * 24 * 3600 * 1000),
  bits = 2048,
  usage = { digitalSignature: true, nonRepudiation: true },
  chaine = true,
  sansCle = false,
  algorithme = "3des",
  serie = "05ed06f9ec2d4c40",
} = {}) {
  const ca = paire("ca");
  const feuille = paire("feuille", bits);
  const sujetCa = attributs("AUTORITE DE TEST", "AUTORITE FICTIVE");
  const certCa = creerCertificat({
    publique: ca.publique,
    signataire: ca.privee,
    sujet: sujetCa,
    emetteur: sujetCa,
    serie: "01",
    debut: new Date(Date.now() - 5 * 365 * 24 * 3600 * 1000),
    fin: new Date(Date.now() + 5 * 365 * 24 * 3600 * 1000),
    extensions: [{ name: "basicConstraints", cA: true }],
  });
  const certFeuille = creerCertificat({
    publique: feuille.publique,
    signataire: ca.privee,
    sujet: attributs("CABINET DE TEST", "CABINET FICTIF"),
    emetteur: sujetCa,
    serie,
    debut,
    fin,
    extensions: [{ name: "basicConstraints", cA: false }, ...(usage ? [{ name: "keyUsage", critical: true, ...usage }] : [])],
  });
  const asn1 = forge.pkcs12.toPkcs12Asn1(sansCle ? null : feuille.privee, chaine ? [certFeuille, certCa] : [certFeuille], motDePasse, {
    algorithm: algorithme,
    friendlyName: "signature-test",
  });
  return { p12: Buffer.from(forge.asn1.toDer(asn1).getBytes(), "binary"), motDePasse, bits };
}
