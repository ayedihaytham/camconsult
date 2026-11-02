import { arrondi3 as r3 } from "./arrondi.js";

/**
 * Statut de chaque mois d'un compte bancaire, sans le détail des lignes : il ne faut que le total des débits et des crédits du mois.
 * Même règle que le rapprochement mensuel de l'écran du compte (src/lib/banqueMois.ts, `synthesePeriodes`) : le départ d'un mois est la fin du mois précédent
 * (solde réel de la banque s'il est saisi, sinon solde calculé) ; l'écart est solde réel − solde calculé ; au-delà de la tolérance, c'est un écart.
 * Un test compare les deux calculs sur les mêmes données.
 *
 * @param {{ soldeDepart: number }} compte
 * @param {{ mois: string, debit: number, credit: number }[]} totauxParMois totaux des lignes de chaque mois (« AAAA-MM »)
 * @param {{ mois: string, soldeReel: number | null }[]} releves soldes réels saisis ou importés
 * @param {string[]} autresMois mois qui existent sans ligne (opérations en cours seulement)
 * @returns {{ mois: string, calcule: number, soldeReel: number | null, ecart: number | null, statut: "ok" | "ecart" | "saisir" }[]}
 */
export const TOLERANCE_ECART = 0.0005;

export function statutsMoisCompte(compte, totauxParMois, releves = [], autresMois = []) {
  const mois = [...new Set([...totauxParMois.map((t) => t.mois), ...releves.map((r) => r.mois), ...autresMois])].sort();
  let ouverture = compte.soldeDepart;
  return mois.map((m) => {
    const t = totauxParMois.find((x) => x.mois === m);
    const calcule = r3(ouverture + (t?.credit ?? 0) - (t?.debit ?? 0));
    const soldeReel = releves.find((r) => r.mois === m)?.soldeReel ?? null;
    const ecart = soldeReel === null ? null : r3(soldeReel - calcule);
    const statut = soldeReel === null ? "saisir" : Math.abs(ecart) > TOLERANCE_ECART ? "ecart" : "ok";
    ouverture = soldeReel ?? calcule;
    return { mois: m, calcule, soldeReel, ecart, statut };
  });
}
