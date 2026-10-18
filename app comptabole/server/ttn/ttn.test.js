import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ErreurTtn } from "./erreur.js";
import { PNG_FACTICE, demarrerFauxTtn } from "./fixtures/fauxTtn.js";
import { dateTtn, lireRefTtn, qrValide } from "./refTtn.js";
import { appeler, consulterFacture, deposerFacture, enveloppeConsultation, enveloppeDepot, verifierUrl } from "./soap.js";

// Faux serveur TTN local et données SYNTHÉTIQUES uniquement ; aucune requête vers un vrai service.
const XML_SIGNE = '<?xml version="1.0" encoding="UTF-8"?>\n<TEIF><InvoiceBody><Bgm><DocumentIdentifier>2026-0001</DocumentIdentifier></Bgm></InvoiceBody><ds:Signature></ds:Signature>\n</TEIF>\n';
const lever = async (p) => {
  try {
    await p;
  } catch (e) {
    return e;
  }
  throw new Error("une erreur était attendue");
};

describe("adresse du service TTN", () => {
  it("HTTPS obligatoire, pas d'identifiant dans l'adresse, pas d'adresse locale ou privée", () => {
    expect(verifierUrl("https://elfatoora.tn/ElfatouraServices/EfactService")).toBe("https://elfatoora.tn/ElfatouraServices/EfactService");
    for (const [url, code] of [
      ["http://elfatoora.tn/ElfatouraServices/EfactService", "URL_NON_SECURISEE"],
      ["https://utilisateur:mdp@elfatoora.tn/x", "URL_INVALIDE"],
      ["pas une adresse", "URL_INVALIDE"],
      ["https://localhost/x", "URL_LOCALE"],
      ["https://127.0.0.1:8080/x", "URL_LOCALE"],
      ["https://10.0.0.5/x", "URL_LOCALE"],
      ["https://192.168.1.10/x", "URL_LOCALE"],
      ["https://172.20.0.3/x", "URL_LOCALE"],
      ["https://169.254.169.254/latest/meta-data", "URL_LOCALE"],
      ["https://[::1]/x", "URL_LOCALE"],
      ["https://serveur.interne.local/x", "URL_LOCALE"],
      ["ftp://elfatoora.tn/x", "URL_NON_SECURISEE"],
    ]) {
      let erreur;
      try {
        verifierUrl(url);
      } catch (e) {
        erreur = e;
      }
      expect(erreur, url).toBeInstanceOf(ErreurTtn);
      expect(erreur.code, url).toBe(code);
    }
    expect(verifierUrl("http://127.0.0.1:9999/x", { autoriserLocal: true })).toBe("http://127.0.0.1:9999/x");
  });
});

describe("enveloppes SOAP", () => {
  const acces = { login: "ident<&>", motDePasse: 'mdp"\'&', matricule: "1234567ABM000" };
  it("saveEfact : paramètres dans l'ordre de la spécification, XML échappé, document en base64 des octets UTF-8", () => {
    const xml = enveloppeDepot(acces, Buffer.from("<a>é</a>", "utf8"));
    expect(xml).toContain('xmlns:ser="http://services.elfatoura.tradenet.com.tn/"');
    expect(xml).toMatch(/<ser:saveEfact><login>ident&lt;&amp;&gt;<\/login><password>.*<\/password><matricule>1234567ABM000<\/matricule><documentEfact>[A-Za-z0-9+/=]+<\/documentEfact><\/ser:saveEfact>/);
    expect(xml).toContain(`<documentEfact>${Buffer.from("<a>é</a>", "utf8").toString("base64")}</documentEfact>`);
    expect(xml).not.toContain("ident<&>");
  });
  it("consultEfact : critère limité au numéro de facture", () => {
    const xml = enveloppeConsultation(acces, "2026-0001");
    expect(xml).toContain("<ser:consultEfact>");
    expect(xml).toContain("<efactCriteria><documentNumber>2026-0001</documentNumber></efactCriteria>");
  });
});

describe("dialogue avec le faux service TTN", () => {
  let ttn;
  let config;
  const options = { autoriserLocal: true };
  beforeAll(async () => {
    ttn = await demarrerFauxTtn();
    config = { url: ttn.url, login: ttn.login, motDePasse: ttn.motDePasse, matricule: "1234567ABM000" };
  });
  afterAll(() => ttn.arreter());

  it("dépose le fichier signé (octets exacts) et renvoie le message tel quel", async () => {
    const message = await deposerFacture(config, XML_SIGNE, options);
    expect(message).toBe("Facture reçue");
    const appel = ttn.appels("saveEfact").at(-1);
    expect(appel).toMatchObject({ numero: "2026-0001", matricule: "1234567ABM000", octets: Buffer.byteLength(XML_SIGNE) });
  });

  it("consultation : facture connue en attente, validée (référence + XML complété), rejetée (acquittements), inconnue", async () => {
    const attente = await consulterFacture(config, "2026-0001", options);
    expect(attente).toHaveLength(1);
    expect(attente[0]).toMatchObject({ documentNumber: "2026-0001", generatedRef: "", acquittements: [], xml: null });

    ttn.valider("2026-0001", "REF-TTN-42");
    const validee = (await consulterFacture(config, "2026-0001", options))[0];
    expect(validee.generatedRef).toBe("REF-TTN-42");
    expect(validee.xml).toContain("<RefTtnVal>");
    expect(lireRefTtn(validee.xml)).toMatchObject({ ref: "REF-TTN-42", dateIso: "2026-10-17T10:42:00.000Z", qrPng: PNG_FACTICE });

    await deposerFacture(config, XML_SIGNE.replace("2026-0001", "2026-0002"), options);
    ttn.rejeter("2026-0002", ["Matricule fiscal du client invalide", "Date incohérente"]);
    const rejetee = (await consulterFacture(config, "2026-0002", options))[0];
    expect(rejetee.acquittements).toEqual([{ message: "Matricule fiscal du client invalide" }, { message: "Date incohérente" }]);

    expect(await consulterFacture(config, "2099-0001", options)).toEqual([]);
  });

  it("identifiants refusés : message clair, SANS jamais répéter l'identifiant ni le mot de passe saisis", async () => {
    const mauvais = { ...config, login: "intrus-visible", motDePasse: "secret-visible-123" };
    const e = await lever(consulterFacture(mauvais, "2026-0001", options));
    expect(e).toBeInstanceOf(ErreurTtn);
    expect(e.code).toBe("FAULT");
    expect(e.message).toContain("Identifiants invalides");
    expect(e.message).not.toContain("secret-visible-123");
    expect(e.message).not.toContain("intrus-visible");
  });

  it("panne du service, erreur interne, lenteur et réponse trop grosse : erreurs distinctes", async () => {
    ttn.etat.comportement.consultation = "panne";
    expect((await lever(consulterFacture(config, "x", options))).code).toBe("RESEAU");
    ttn.etat.comportement.consultation = "faute";
    expect((await lever(consulterFacture(config, "x", options))).code).toBe("FAULT");
    ttn.etat.comportement.consultation = "ok";
    ttn.etat.comportement.delaiMs = 300;
    expect((await lever(appeler(config, "consultEfact", enveloppeConsultation(config, "x"), { ...options, delaiMs: 50 }))).code).toBe("DELAI");
    ttn.etat.comportement.delaiMs = 0;
    expect((await lever(appeler(config, "consultEfact", enveloppeConsultation(config, "x"), { ...options, maxOctets: 50 }))).code).toBe("REPONSE_TROP_GRANDE");
  });

  it("adresse non sécurisée refusée avant tout envoi", async () => {
    const e = await lever(consulterFacture({ ...config, url: "http://elfatoora.tn/x" }, "x"));
    expect(e.code).toBe("URL_NON_SECURISEE");
  });
});

describe("bloc RefTtnVal", () => {
  it("date ddMMyyHHmm (heure de Tunis) → ISO ; valeurs absurdes refusées", () => {
    expect(dateTtn("1609201239")).toBe("2020-09-16T11:39:00.000Z");
    expect(dateTtn("3102260000")).toBeNull();
    expect(dateTtn("abc")).toBeNull();
    expect(dateTtn("")).toBeNull();
  });
  it("QR : seulement un vrai PNG de taille raisonnable", () => {
    expect(qrValide(PNG_FACTICE)).toBe(PNG_FACTICE);
    expect(qrValide(Buffer.from("pas un png du tout, juste du texte").toString("base64"))).toBeNull();
    expect(qrValide("$$$")).toBeNull();
    expect(qrValide("")).toBeNull();
    expect(qrValide(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(300_000)]).toString("base64"))).toBeNull();
  });
  it("sans bloc RefTtnVal ou sans référence : null (rien d'inventé)", () => {
    expect(lireRefTtn("<TEIF><InvoiceBody/></TEIF>")).toBeNull();
    expect(lireRefTtn("<TEIF><RefTtnVal><ReferenceTTN></ReferenceTTN></RefTtnVal></TEIF>")).toBeNull();
    expect(lireRefTtn("pas du xml <<<")).toBeNull();
    expect(lireRefTtn(null)).toBeNull();
  });
  const ZIP = "samples/Specifications_techniques_Elfatoora (2).zip";
  let pack = null;
  try {
    pack = { JSZip: createRequire(import.meta.url)("jszip"), zip: readFileSync(ZIP) };
  } catch {
    pack = null;
  }
  it.skipIf(!pack)("exemple officiel de TTN : référence, date et QR (PNG) lus correctement", async () => {
    const zip = await pack.JSZip.loadAsync(pack.zip);
    const xml = await zip.file("elfatooraSpecTech/exemple_signe_elfatoora.xml").async("string");
    const ref = lireRefTtn(xml);
    expect(ref.ref).toBe("073620200053562920196810312");
    expect(ref.dateIso).toBe("2020-09-16T11:39:00.000Z");
    expect(ref.qrPng).toMatch(/^iVBORw0KGgo/);
  });
});
