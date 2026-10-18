import { createServer } from "node:http";

/**
 * FAUX serveur TTN pour les tests : il parle le même SOAP que le service El Fatoora (d'après la spécification V5) sur une adresse locale.
 * Il ne prouve pas que le vrai service répond ainsi : il fixe le contrat que le code suppose, pour détecter nos propres régressions.
 * Les tests pilotent son comportement : valider(), rejeter(), comportement.depot / comportement.consultation.
 */

const NS = "http://services.elfatoura.tradenet.com.tn/";
/** PNG 1×1 valide (QR factice, sans valeur réelle). */
export const PNG_FACTICE = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const echapper = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const enveloppe = (corps) =>
  `<?xml version="1.0" encoding="UTF-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body>${corps}</soap:Body></soap:Envelope>`;
const faute = (texte) => enveloppe(`<soap:Fault><faultcode>soap:Server</faultcode><faultstring>${echapper(texte)}</faultstring></soap:Fault>`);
const extraire = (xml, balise) => new RegExp(`<${balise}>([^<]*)</${balise}>`).exec(xml)?.[1] ?? "";

export async function demarrerFauxTtn({ login = "compte-test", motDePasse = "mot-de-passe-factice-ttn" } = {}) {
  const etat = {
    login,
    motDePasse,
    appels: [], // { operation, numero }
    factures: new Map(), // numero → { xml, etat: "attente" | "valide" | "rejete", ref, acquittements }
    comportement: { depot: "ok", consultation: "ok", delaiMs: 0, messageDepot: "Facture reçue" }, // depot : ok | faute | panne ; consultation : ok | faute | panne
    reponsesBrutes: [],
  };

  const serveur = createServer((req, res) => {
    const morceaux = [];
    req.on("data", (c) => morceaux.push(c));
    req.on("end", async () => {
      const corps = Buffer.concat(morceaux).toString("utf8");
      const operation = /<ser:(saveEfact|consultEfact)>/.exec(corps)?.[1];
      const envoyer = (statut, texte) => {
        res.writeHead(statut, { "Content-Type": "text/xml; charset=utf-8" });
        res.end(texte);
      };
      if (etat.comportement.delaiMs) await new Promise((r) => setTimeout(r, etat.comportement.delaiMs));
      if (!operation) return envoyer(500, faute("Opération inconnue"));
      if (extraire(corps, "login") !== etat.login || extraire(corps, "password") !== etat.motDePasse) {
        // Le vrai service pourrait renvoyer le mot de passe saisi dans son message : on le fait ici exprès pour vérifier qu'il est épuré.
        return envoyer(500, faute(`Identifiants invalides pour ${extraire(corps, "login")} / ${extraire(corps, "password")}`));
      }
      const mode = operation === "saveEfact" ? etat.comportement.depot : etat.comportement.consultation;
      if (mode === "panne") return req.socket.destroy();
      if (mode === "faute") return envoyer(500, faute("Erreur interne du service de test"));

      if (operation === "saveEfact") {
        const xml = Buffer.from(extraire(corps, "documentEfact"), "base64").toString("utf8");
        const numero = extraire(xml, "DocumentIdentifier");
        etat.appels.push({ operation, numero, octets: Buffer.byteLength(xml), matricule: extraire(corps, "matricule") });
        if (!xml.includes("<ds:Signature")) return envoyer(200, enveloppe(`<ns2:saveEfactResponse xmlns:ns2="${NS}"><return>Echec : facture non signée</return></ns2:saveEfactResponse>`));
        etat.factures.set(numero, { xml, etat: "attente", ref: "", acquittements: [] });
        return envoyer(200, enveloppe(`<ns2:saveEfactResponse xmlns:ns2="${NS}"><return>${echapper(etat.comportement.messageDepot)}</return></ns2:saveEfactResponse>`));
      }

      const numero = extraire(corps, "documentNumber");
      etat.appels.push({ operation, numero });
      const f = etat.factures.get(numero);
      let resultat = "";
      if (f) {
        const acquittements = f.acquittements.map((m) => `<listAcknowlegments><message>${echapper(m)}</message></listAcknowlegments>`).join("");
        if (f.etat === "valide") {
          const complete = f.xml.replace(
            "</TEIF>",
            `<RefTtnVal><ReferenceTTN refID="I-88">${f.ref}</ReferenceTTN><ReferenceDate><DateText format="ddMMyyHHmm" functionCode="I-37">1710261142</DateText></ReferenceDate><ReferenceCEV>${PNG_FACTICE}</ReferenceCEV></RefTtnVal></TEIF>`,
          );
          resultat = `<return><documentNumber>${numero}</documentNumber><generatedRef>${f.ref}</generatedRef><xmlContent>${Buffer.from(complete).toString("base64")}</xmlContent></return>`;
        } else if (f.etat === "rejete") {
          resultat = `<return><documentNumber>${numero}</documentNumber>${acquittements}</return>`;
        } else {
          resultat = `<return><documentNumber>${numero}</documentNumber></return>`;
        }
      }
      envoyer(200, enveloppe(`<ns2:consultEfactResponse xmlns:ns2="${NS}">${resultat}</ns2:consultEfactResponse>`));
    });
  });
  await new Promise((r) => serveur.listen(0, "127.0.0.1", r));
  const { port } = serveur.address();

  return {
    url: `http://127.0.0.1:${port}/ElfatouraServices/EfactService`,
    login,
    motDePasse,
    etat,
    valider(numero, ref = `REF-${numero}`) {
      const f = etat.factures.get(numero);
      f.etat = "valide";
      f.ref = ref;
    },
    rejeter(numero, messages = ["Matricule fiscal du client invalide"]) {
      const f = etat.factures.get(numero);
      f.etat = "rejete";
      f.acquittements = messages;
    },
    oublier(numero) {
      etat.factures.delete(numero);
    },
    appels: (operation) => etat.appels.filter((a) => a.operation === operation),
    arreter: () => new Promise((r) => serveur.close(r)),
  };
}
