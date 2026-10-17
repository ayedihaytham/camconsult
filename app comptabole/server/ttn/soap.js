import { XMLParser } from "fast-xml-parser";
import { echapper } from "../teif/xml.js";
import { ErreurTtn } from "./erreur.js";

/**
 * Client SOAP 1.1 (document/littéral) du service web El Fatoora de TTN, d'après « Spécifications web services v5 » :
 *  - saveEfact(login, password, matricule, documentEfact: byte[]) → message ;
 *  - consultEfact(login, password, matricule, efactCriteria) → liste d'EfactCriteria.
 * Le message de saveEfact n'est jamais interprété (libellés non documentés) : la vérité vient de consultEfact.
 * Les identifiants ne sortent que dans la requête HTTPS ; aucun message d'erreur ne les contient.
 */

export const NS_SERVICE = "http://services.elfatoura.tradenet.com.tn/";
export const DELAI_MS = 30_000;
export const MAX_REPONSE_OCTETS = 5_000_000;

const LOCAL = /^(localhost|127\.\d+\.\d+\.\d+|\[?::1\]?|0\.0\.0\.0)$/i;
const PRIVE = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|\[?f[cd][0-9a-f]{2}:)/i;

/**
 * Adresse du service : HTTPS obligatoire (les identifiants voyagent dans la requête), pas d'identifiants dans l'adresse, pas d'adresse
 * locale ou privée (le serveur de l'application ne doit pas servir à atteindre son réseau interne). `autoriserLocal` n'est vrai que dans
 * les tests d'intégration (variable TTN_AUTORISER_LOCAL), pour viser un faux serveur sur la machine.
 */
export function verifierUrl(valeur, { autoriserLocal = false } = {}) {
  let u;
  try {
    u = new URL(String(valeur ?? "").trim());
  } catch {
    throw new ErreurTtn("URL_INVALIDE", "L'adresse du service TTN n'est pas valide.", 400);
  }
  const local = LOCAL.test(u.hostname);
  if (u.username || u.password) throw new ErreurTtn("URL_INVALIDE", "L'adresse du service ne doit pas contenir d'identifiant.", 400);
  if (local || PRIVE.test(u.hostname) || /\.(local|internal|lan)$/i.test(u.hostname)) {
    if (!autoriserLocal) throw new ErreurTtn("URL_LOCALE", "L'adresse du service TTN ne peut pas être une adresse locale ou privée.", 400);
    if (u.protocol !== "https:" && u.protocol !== "http:") throw new ErreurTtn("URL_INVALIDE", "L'adresse du service doit commencer par https://.", 400);
    return u.toString();
  }
  if (u.protocol !== "https:") throw new ErreurTtn("URL_NON_SECURISEE", "L'adresse du service TTN doit commencer par https:// (les identifiants ne doivent pas circuler en clair).", 400);
  return u.toString();
}

const enveloppe = (operation, corps) =>
  `<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ser="${NS_SERVICE}"><soapenv:Header/><soapenv:Body><ser:${operation}>${corps}</ser:${operation}></soapenv:Body></soapenv:Envelope>`;

const acces = (c) => `<login>${echapper(c.login)}</login><password>${echapper(c.motDePasse)}</password><matricule>${echapper(c.matricule)}</matricule>`;

export const enveloppeDepot = (c, octets) => enveloppe("saveEfact", `${acces(c)}<documentEfact>${Buffer.from(octets).toString("base64")}</documentEfact>`);
export const enveloppeConsultation = (c, numero) => enveloppe("consultEfact", `${acces(c)}<efactCriteria><documentNumber>${echapper(numero)}</documentNumber></efactCriteria>`);

const analyseur = new XMLParser({
  ignoreAttributes: true,
  removeNSPrefix: true,
  parseTagValue: false,
  trimValues: true,
  processEntities: true,
  isArray: (nom) => nom === "return" || nom === "listAcknowlegments" || nom === "listAttachement",
});

/** Retire toute trace du mot de passe d'un texte renvoyé par le service. */
const epurer = (texte, c) => {
  let t = String(texte ?? "");
  for (const secret of [c?.motDePasse, c?.login]) if (secret && String(secret).length >= 3) t = t.split(String(secret)).join("***");
  return t.slice(0, 500);
};

async function lireLimite(reponse, max) {
  const annonce = Number(reponse.headers.get("content-length"));
  if (annonce > max) throw new ErreurTtn("REPONSE_TROP_GRANDE", "La réponse du service TTN est trop volumineuse.");
  const lecteur = reponse.body?.getReader();
  if (!lecteur) return await reponse.text();
  const morceaux = [];
  let total = 0;
  for (;;) {
    const { done, value } = await lecteur.read();
    if (done) break;
    total += value.length;
    if (total > max) {
      await lecteur.cancel();
      throw new ErreurTtn("REPONSE_TROP_GRANDE", "La réponse du service TTN est trop volumineuse.");
    }
    morceaux.push(value);
  }
  return Buffer.concat(morceaux).toString("utf8");
}

/** Envoie une enveloppe et renvoie le contenu de <Body> (sans préfixes d'espaces de noms). */
export async function appeler(config, operation, corps, { fetchImpl = fetch, delaiMs = DELAI_MS, maxOctets = MAX_REPONSE_OCTETS, autoriserLocal = false } = {}) {
  const url = verifierUrl(config.url, { autoriserLocal });
  let reponse;
  let texte;
  try {
    reponse = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: '""', Accept: "text/xml" },
      body: corps,
      signal: AbortSignal.timeout(delaiMs),
      redirect: "error",
    });
    texte = await lireLimite(reponse, maxOctets);
  } catch (e) {
    if (e instanceof ErreurTtn) throw e;
    if (e?.name === "TimeoutError" || e?.name === "AbortError") throw new ErreurTtn("DELAI", `TTN n'a pas répondu dans les ${Math.round(delaiMs / 1000)} secondes.`);
    throw new ErreurTtn("RESEAU", "Impossible de joindre le service TTN (réseau, adresse ou certificat du serveur).");
  }

  let doc = null;
  try {
    doc = analyseur.parse(texte);
  } catch {
    doc = null;
  }
  const corpsReponse = doc?.Envelope?.Body ?? null;
  const faute = corpsReponse?.Fault;
  if (faute) throw new ErreurTtn("FAULT", `Le service TTN a refusé la demande : ${epurer(faute.faultstring ?? faute.reason ?? "erreur sans détail", config)}`);
  if (reponse.status === 401 || reponse.status === 403) throw new ErreurTtn("ACCES_REFUSE", "Le service TTN a refusé l'accès (identifiants ou droits).");
  if (!reponse.ok) throw new ErreurTtn("HTTP", `Le service TTN a répondu avec une erreur HTTP ${reponse.status}.`);
  if (!corpsReponse || typeof corpsReponse !== "object") throw new ErreurTtn("REPONSE_ILLISIBLE", "La réponse du service TTN n'est pas une réponse SOAP lisible.");
  return corpsReponse;
}

const texteDe = (v) => (v === undefined || v === null ? "" : typeof v === "object" ? "" : String(v));

/** Dépose le message TEIF signé. Renvoie le message du service, tel quel (jamais interprété). */
export async function deposerFacture(config, xmlSigne, options) {
  const corps = await appeler(config, "saveEfact", enveloppeDepot(config, Buffer.from(xmlSigne, "utf8")), options);
  const reponse = corps.saveEfactResponse;
  if (!reponse) throw new ErreurTtn("REPONSE_ILLISIBLE", "La réponse du service TTN ne contient pas de réponse à saveEfact.");
  const brut = Array.isArray(reponse.return) ? reponse.return[0] : reponse.return;
  return epurer(texteDe(brut), config);
}

const scalaires = (o) => Object.fromEntries(Object.entries(o ?? {}).filter(([, v]) => v !== null && typeof v !== "object").map(([k, v]) => [k, epurerCourt(v)]));
const epurerCourt = (v) => String(v).slice(0, 300);

/** Consulte une facture par son numéro. Renvoie la liste des résultats normalisés (vide si TTN ne connaît pas ce numéro). */
export async function consulterFacture(config, numero, options) {
  const corps = await appeler(config, "consultEfact", enveloppeConsultation(config, numero), options);
  const reponse = corps.consultEfactResponse;
  if (reponse === undefined) throw new ErreurTtn("REPONSE_ILLISIBLE", "La réponse du service TTN ne contient pas de réponse à consultEfact.");
  const liste = reponse && typeof reponse === "object" ? (reponse.return ?? []) : [];
  return liste
    .filter((r) => r && typeof r === "object")
    .map((r) => {
      const acquittements = (r.listAcknowlegments ?? []).map((a) => (typeof a === "object" ? scalaires(a) : { message: epurerCourt(a) }));
      let xml = null;
      const contenu = texteDe(r.xmlContent);
      if (contenu) {
        const octets = Buffer.from(contenu, "base64");
        xml = octets.length > 0 ? octets.toString("utf8") : null;
      }
      return {
        documentNumber: texteDe(r.documentNumber),
        idSaveEfact: texteDe(r.idSaveEfact),
        generatedRef: texteDe(r.generatedRef),
        dateProcess: texteDe(r.dateProcess),
        acquittements,
        xml,
      };
    });
}
