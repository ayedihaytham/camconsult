import { validerMatriculeFiscal } from "../../../shared/mf.js";
import type { FactureCabinet, SignatureEtat, TtnEtat } from "@/types";

/**
 * Étapes de mise en route de la facture électronique, calculées à partir de l'état déjà connu de l'application (aucun appel réseau) :
 * identité du cabinet, certificat de signature, accès TTN, essai de connexion. Fonction pure, testée seule.
 */

export type EtatEtape = "ok" | "a_faire" | "attente";
export type CibleEtape = "cabinet" | "signature" | "ttn" | "tester";

export interface EtapeMiseEnRoute {
  id: "identite" | "certificat" | "ttn" | "essai";
  etat: EtatEtape;
  titre: string;
  detail: string;
  /** Action proposée pour terminer l'étape (absente si rien à faire de ce côté). */
  action?: { libelle: string; cible: CibleEtape };
  /** Étape terminée mais à surveiller (ex. certificat qui expire bientôt). */
  avertissement?: boolean;
}

export const JOURS_AVANT_EXPIRATION = 30;
const JOUR_MS = 24 * 3600 * 1000;

export const joursRestants = (iso: string, maintenant = new Date()) => Math.ceil((new Date(iso).getTime() - maintenant.getTime()) / JOUR_MS);

const dateCourte = (iso: string) => new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso));

export function etapesMiseEnRoute(entree: { cabinet: FactureCabinet | null; signature: SignatureEtat | null; ttn: TtnEtat | null; maintenant?: Date }): EtapeMiseEnRoute[] {
  const { cabinet, signature, ttn } = entree;
  const maintenant = entree.maintenant ?? new Date();

  // 1. Identité du cabinet
  const manque: string[] = [];
  if (!cabinet) manque.push("tout");
  else {
    if (!(cabinet.raisonSociale || cabinet.nom || "").trim()) manque.push("raison sociale");
    if (!validerMatriculeFiscal(cabinet.matriculeFiscal ?? "").ok) manque.push("matricule fiscal valide");
    if (!(cabinet.rue ?? "").trim()) manque.push("rue");
    if (!(cabinet.ville ?? "").trim()) manque.push("ville");
    if (!(cabinet.codePostal ?? "").trim()) manque.push("code postal");
  }
  const identite: EtapeMiseEnRoute = !cabinet
    ? { id: "identite", etat: "attente", titre: "Identité du cabinet", detail: "Vérification en cours…" }
    : manque.length === 0
      ? { id: "identite", etat: "ok", titre: "Identité du cabinet", detail: "Raison sociale, matricule fiscal et adresse renseignés." }
      : { id: "identite", etat: "a_faire", titre: "Identité du cabinet", detail: `À compléter : ${manque.join(", ")}.`, action: { libelle: "Compléter le cabinet", cible: "cabinet" } };

  // 2. Certificat de signature
  let certificat: EtapeMiseEnRoute;
  if (!signature) certificat = { id: "certificat", etat: "attente", titre: "Certificat de signature", detail: "Vérification en cours…" };
  else if (!signature.configuree)
    certificat = { id: "certificat", etat: "a_faire", titre: "Certificat de signature", detail: "La clé de chiffrement du serveur n'est pas définie : demandez à l'administrateur technique." };
  else if (!signature.certificat)
    certificat = { id: "certificat", etat: "a_faire", titre: "Certificat de signature", detail: "Aucun certificat (.p12 / .pfx) n'est chargé.", action: { libelle: "Charger le certificat", cible: "signature" } };
  else if (signature.certificat.expire)
    certificat = { id: "certificat", etat: "a_faire", titre: "Certificat de signature", detail: `Expiré depuis le ${dateCourte(signature.certificat.validAu)}.`, action: { libelle: "Remplacer le certificat", cible: "signature" } };
  else {
    const jours = joursRestants(signature.certificat.validAu, maintenant);
    const bientot = jours <= JOURS_AVANT_EXPIRATION;
    certificat = {
      id: "certificat",
      etat: "ok",
      titre: "Certificat de signature",
      detail: `Valide jusqu'au ${dateCourte(signature.certificat.validAu)} (${jours} jour${jours > 1 ? "s" : ""}).`,
      avertissement: bientot,
      action: bientot ? { libelle: "Remplacer le certificat", cible: "signature" } : undefined,
    };
  }

  // 3. Accès TTN
  let acces: EtapeMiseEnRoute;
  if (!ttn) acces = { id: "ttn", etat: "attente", titre: "Accès TTN", detail: "Vérification en cours…" };
  else if (!ttn.configuree) acces = { id: "ttn", etat: "a_faire", titre: "Accès TTN", detail: "La clé de chiffrement du serveur n'est pas définie : demandez à l'administrateur technique." };
  else if (!ttn.connexion) acces = { id: "ttn", etat: "a_faire", titre: "Accès TTN", detail: "Adresse du service et identifiants El Fatoora à enregistrer.", action: { libelle: "Enregistrer les accès", cible: "ttn" } };
  else acces = { id: "ttn", etat: "ok", titre: "Accès TTN", detail: `Enregistrés (environnement ${ttn.connexion.environnement === "reel" ? "réel" : "de test"}).` };

  // 4. Essai de connexion
  let essai: EtapeMiseEnRoute;
  const connexion = ttn?.connexion ?? null;
  if (!ttn) essai = { id: "essai", etat: "attente", titre: "Essai de connexion TTN", detail: "Vérification en cours…" };
  else if (!connexion) essai = { id: "essai", etat: "a_faire", titre: "Essai de connexion TTN", detail: "À faire une fois les accès enregistrés." };
  else if (connexion.dernierEssai?.ok) essai = { id: "essai", etat: "ok", titre: "Essai de connexion TTN", detail: `Réussi le ${dateCourte(connexion.dernierEssai.le)}.` };
  else if (connexion.dernierEssai)
    essai = { id: "essai", etat: "a_faire", titre: "Essai de connexion TTN", detail: `Le dernier essai (${dateCourte(connexion.dernierEssai.le)}) a échoué : vérifiez les accès.`, action: { libelle: "Tester de nouveau", cible: "tester" } };
  else essai = { id: "essai", etat: "a_faire", titre: "Essai de connexion TTN", detail: "Pas encore effectué : rien n'a été envoyé à TTN.", action: { libelle: "Tester la connexion", cible: "tester" } };

  return [identite, certificat, acces, essai];
}
