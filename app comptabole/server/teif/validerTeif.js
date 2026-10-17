import { arrondi3, calculerTotaux } from "../../shared/factureTotaux.js";
import { validerMatriculeFiscal } from "../../shared/mf.js";
import { DOCUMENT_IDENTIFIER, LONGUEURS } from "./constantes.js";

/**
 * Contrôles avant de produire le message TEIF. Chaque problème a un niveau (« bloquant » empêche la préparation, « avertissement » non),
 * un champ, un message en français et l'endroit où le corriger (« cabinet », « societe » ou « facture »).
 *
 * Entrées (objets déjà lus en base) :
 *   facture : { numero, statut, dateEmission, echeance, tvaTaux, timbre, note, lignes: [{ description, quantite, montantHt }] }
 *   cabinet : { nom, matriculeFiscal, adresse, rue, ville, codePostal, pays, rc, rib }
 *   client  : { nom, matriculeFiscal, adresse, rue, ville, codePostal, pays }
 */

const probleme = (niveau, ou, champ, message) => ({ niveau, ou, champ, message });
const bloquant = (ou, champ, message) => probleme("bloquant", ou, champ, message);
const avertissement = (ou, champ, message) => probleme("avertissement", ou, champ, message);

const decimales = (n) => {
  const t = String(n);
  if (t.includes("e")) return 99;
  const i = t.indexOf(".");
  return i < 0 ? 0 : t.length - i - 1;
};

const dateValide = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ""));
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
};

function controlerPartie(ou, libelle, p, out) {
  const mf = validerMatriculeFiscal(p.matriculeFiscal);
  if (!mf.ok) out.push(bloquant(ou, "matriculeFiscal", `${libelle} : ${mf.erreur}`));
  const nom = String(p.nom ?? "").trim();
  if (!nom) out.push(bloquant(ou, "nom", `${libelle} : raison sociale absente.`));
  else if (nom.length > LONGUEURS.nomPartenaire) out.push(bloquant(ou, "nom", `${libelle} : la raison sociale dépasse ${LONGUEURS.nomPartenaire} caractères.`));

  const rue = String(p.rue ?? "").trim();
  const ville = String(p.ville ?? "").trim();
  const cp = String(p.codePostal ?? "").trim();
  const pays = String(p.pays ?? "").trim();
  const adresse = String(p.adresse ?? "").trim();
  if (!rue && !adresse) out.push(bloquant(ou, "rue", `${libelle} : adresse absente (rue ou adresse complète).`));
  if (!ville) out.push(bloquant(ou, "ville", `${libelle} : ville absente.`));
  if (!cp) out.push(bloquant(ou, "codePostal", `${libelle} : code postal absent.`));
  if (!/^[A-Za-z]{2}$/.test(pays)) out.push(bloquant(ou, "pays", `${libelle} : le pays doit être un code à 2 lettres (ex. TN).`));
  if (rue.length > LONGUEURS.rue) out.push(bloquant(ou, "rue", `${libelle} : la rue dépasse ${LONGUEURS.rue} caractères (${rue.length}) : abrégez-la.`));
  if (ville.length > LONGUEURS.ville) out.push(bloquant(ou, "ville", `${libelle} : la ville dépasse ${LONGUEURS.ville} caractères.`));
  if (cp.length > LONGUEURS.codePostal) out.push(bloquant(ou, "codePostal", `${libelle} : le code postal dépasse ${LONGUEURS.codePostal} caractères.`));
  if ((adresse || rue).length > LONGUEURS.adresseDescription) out.push(bloquant(ou, "adresse", `${libelle} : l'adresse dépasse ${LONGUEURS.adresseDescription} caractères.`));
}

/** @returns {Array<{ niveau: "bloquant" | "avertissement", ou: string, champ: string, message: string }>} */
export function controlerFactureTeif({ facture, cabinet, client }) {
  const out = [];

  controlerPartie("cabinet", "Cabinet", cabinet ?? {}, out);
  controlerPartie("societe", "Client", client ?? {}, out);
  if (String(cabinet?.rc ?? "").length > LONGUEURS.referenceRc) out.push(bloquant("cabinet", "rc", "Cabinet : le registre de commerce dépasse 200 caractères."));

  if (facture.statut === "annulee") out.push(bloquant("facture", "statut", "Cette facture est annulée."));
  if (!DOCUMENT_IDENTIFIER.test(String(facture.numero ?? "")))
    out.push(bloquant("facture", "numero", "Le numéro de facture doit avoir 30 caractères au plus : lettres, chiffres, point, tiret ou tiret bas (ni espace, ni accent, ni « / »)."));
  if (!dateValide(facture.dateEmission)) out.push(bloquant("facture", "dateEmission", "La date d'émission est absente ou invalide."));
  if (facture.echeance) {
    if (!dateValide(facture.echeance)) out.push(bloquant("facture", "echeance", "La date d'échéance est invalide."));
    else if (dateValide(facture.dateEmission) && facture.echeance < facture.dateEmission) out.push(avertissement("facture", "echeance", "L'échéance précède la date d'émission."));
  }
  if (String(facture.note ?? "").length > LONGUEURS.texteLibre) out.push(bloquant("facture", "note", `La note dépasse ${LONGUEURS.texteLibre} caractères.`));

  const taux = Number(facture.tvaTaux);
  if (!Number.isFinite(taux) || taux < 0) out.push(bloquant("facture", "tvaTaux", "Taux de TVA invalide."));
  else if (String(taux).length > LONGUEURS.tauxTva) out.push(bloquant("facture", "tvaTaux", "Le taux de TVA dépasse 5 caractères."));
  else if (taux === 0)
    out.push(avertissement("facture", "tvaTaux", "TVA à 0 % : le traitement TEIF d'une facture exonérée ou en suspension n'est pas détaillé dans le pack (code d'exonération à confirmer auprès de TTN)."));
  const timbre = Number(facture.timbre);
  if (!Number.isFinite(timbre) || timbre < 0) out.push(bloquant("facture", "timbre", "Timbre fiscal invalide."));

  const lignes = facture.lignes ?? [];
  if (lignes.length === 0) out.push(bloquant("facture", "lignes", "La facture n'a aucune ligne."));
  lignes.forEach((l, i) => {
    const n = i + 1;
    const description = String(l.description ?? "").trim();
    if (!description) out.push(bloquant("facture", "lignes", `Ligne ${n} : description absente.`));
    else if (description.length > LONGUEURS.descriptionArticle) out.push(bloquant("facture", "lignes", `Ligne ${n} : la description dépasse ${LONGUEURS.descriptionArticle} caractères.`));
    if (!(Number(l.quantite) > 0)) out.push(bloquant("facture", "lignes", `Ligne ${n} : quantité invalide.`));
    else if (String(Number(l.quantite)).length > LONGUEURS.quantite) out.push(bloquant("facture", "lignes", `Ligne ${n} : quantité trop longue.`));
    if (!(Number(l.montantHt) >= 0)) out.push(bloquant("facture", "lignes", `Ligne ${n} : montant HT invalide.`));
    else if (decimales(Number(l.montantHt)) > 3) out.push(bloquant("facture", "lignes", `Ligne ${n} : le prix unitaire HT a plus de 3 décimales (le message n'accepte que les millimes).`));
    if (Number(l.quantite) > 0 && decimales(Number(l.quantite)) > 3) out.push(bloquant("facture", "lignes", `Ligne ${n} : la quantité a plus de 3 décimales.`));
  });

  // Cohérence des arrondis : le message porte le total de chaque ligne ET le total de la facture ; TTN attend que la somme des lignes soit
  // égale au total. Chez nous le total est arrondi une seule fois ; si les deux divergent, on s'arrête plutôt que d'arrondir en silence.
  if (lignes.length > 0 && lignes.every((l) => Number(l.quantite) > 0 && Number(l.montantHt) >= 0)) {
    const totaux = calculerTotaux(lignes, taux, timbre);
    const somme = arrondi3(lignes.reduce((s, l) => s + arrondi3(Number(l.quantite) * Number(l.montantHt)), 0));
    if (Math.abs(somme - totaux.totalHt) > 0.0004)
      out.push(
        bloquant(
          "facture",
          "lignes",
          `Les lignes arrondies au millime totalisent ${somme.toFixed(3)} alors que le total HT de la facture est ${totaux.totalHt.toFixed(3)} : ajustez les quantités ou les prix pour que chaque ligne soit un nombre exact de millimes.`,
        ),
      );
    if (totaux.totalHt === 0) out.push(avertissement("facture", "lignes", "Le total HT est nul."));
  }
  return out;
}

export const aDesBloquants = (problemes) => problemes.some((p) => p.niveau === "bloquant");
