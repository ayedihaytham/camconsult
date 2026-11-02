import { arrondi3 as r3 } from "../../shared/arrondi.js";
import { TVA_COMMISSION, type RapprochementMois } from "@/lib/banqueMois";
import type { MouvementBancaire } from "@/types";

/**
 * Où chercher l'écart d'un mois : des pistes déduites des données (jamais une réponse inventée). Chaque piste dit ce qui est constaté ;
 * la dernière est toujours le pointage ligne à ligne du relevé de la banque.
 */
export interface Piste {
  texte: string;
  /** Lignes concernées par la piste. */
  lignes: string[];
}

const TOLERANCE = 0.0006;
const fr = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const net = (l: Pick<MouvementBancaire, "credit" | "debit">[]) => r3(l.reduce((s, m) => s + m.credit - m.debit, 0));
const montant = (m: Pick<MouvementBancaire, "credit" | "debit">) => (m.credit > 0 ? m.credit : m.debit);
const egal = (a: number, b: number) => Math.abs(a - b) < TOLERANCE;
const suivant = (mois: string) => {
  const [y, m] = mois.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
};
const precedent = (mois: string) => {
  const [y, m] = mois.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
};
const nom = (m: Pick<MouvementBancaire, "libelle" | "dateOp">) => `« ${m.libelle.trim() || "sans libellé"} » du ${m.dateOp.slice(8, 10)}/${m.dateOp.slice(5, 7)}`;

export function pistesEcart(periode: RapprochementMois, mouvements: MouvementBancaire[]): Piste[] {
  const e = periode.ecart;
  if (e === null || Math.abs(e) <= TOLERANCE) return [];
  const abs = Math.abs(e);
  const pistes: Piste[] = [
    {
      texte:
        e > 0
          ? `La banque a ${fr(abs)} de plus que le tableau : il manque un crédit, ou un débit est en trop dans le tableau.`
          : `La banque a ${fr(abs)} de moins que le tableau : il manque un débit, ou un crédit est en trop dans le tableau.`,
      lignes: [],
    },
  ];
  const ceMois = mouvements.filter((m) => m.dateOp.startsWith(periode.mois));
  const moisSuivant = suivant(periode.mois);
  const moisPrecedent = precedent(periode.mois);

  // Commission et TVA : l'écart est un montant rond hors taxe + 19 %.
  const ht = abs / TVA_COMMISSION;
  if (ht <= 1000 && egal(ht * 1000, Math.round(ht * 1000)) && egal(r3(Math.round(ht * 1000) / 1000 * TVA_COMMISSION), abs)) {
    pistes.push({ texte: `${fr(abs)} = ${fr(Math.round(ht * 1000) / 1000)} + TVA ${Math.round((TVA_COMMISSION - 1) * 100)} % : une commission de ${fr(Math.round(ht * 1000) / 1000)} avec sa TVA n'est comptée que d'un côté (relevé ou tableau).`, lignes: [] });
  }

  // Dates de valeur à cheval entre deux mois.
  const valeurCeMoisSaisieSuivant = mouvements.filter((m) => m.dateOp.startsWith(moisSuivant) && m.dateValeur?.startsWith(periode.mois));
  if (valeurCeMoisSaisieSuivant.length > 0 && egal(net(valeurCeMoisSaisieSuivant), e)) {
    pistes.push({ texte: `${valeurCeMoisSaisieSuivant.length} ligne${valeurCeMoisSaisieSuivant.length > 1 ? "s" : ""} du mois suivant ont leur date de valeur dans ce mois et expliquent exactement l'écart : la banque les compte déjà dans ce mois (${valeurCeMoisSaisieSuivant.slice(0, 3).map(nom).join(", ")}).`, lignes: valeurCeMoisSaisieSuivant.map((m) => m.id) });
  }
  const valeurMoisSuivantSaisieCeMois = ceMois.filter((m) => m.dateValeur && m.dateValeur.slice(0, 7) > periode.mois);
  if (valeurMoisSuivantSaisieCeMois.length > 0 && egal(net(valeurMoisSuivantSaisieCeMois), -e)) {
    pistes.push({ texte: `${valeurMoisSuivantSaisieCeMois.length} ligne${valeurMoisSuivantSaisieCeMois.length > 1 ? "s" : ""} de ce mois ont leur date de valeur le mois suivant et expliquent exactement l'écart : la banque ne les compte pas encore (${valeurMoisSuivantSaisieCeMois.slice(0, 3).map(nom).join(", ")}).`, lignes: valeurMoisSuivantSaisieCeMois.map((m) => m.id) });
  }

  // Une ligne de même montant, ou du double (sens inversé).
  const memeMontant = (liste: MouvementBancaire[]) => liste.filter((m) => egal(montant(m), abs));
  const ici = memeMontant(ceMois);
  if (ici.length === 1) pistes.push({ texte: `Une ligne de ce mois a exactement ce montant (${nom(ici[0])}) : est-elle bien enregistrée une seule fois, dans le bon sens ?`, lignes: [ici[0].id] });
  else if (ici.length > 1) pistes.push({ texte: `${ici.length} lignes de ce mois ont exactement ce montant (par exemple ${ici.slice(0, 2).map(nom).join(", ")}) : il suffit qu'une seule soit enregistrée d'un côté (relevé ou tableau) et pas de l'autre.`, lignes: ici.map((m) => m.id) });
  const voisines = memeMontant(mouvements.filter((m) => m.dateOp.startsWith(moisPrecedent) || m.dateOp.startsWith(moisSuivant)));
  if (voisines.length > 0) pistes.push({ texte: `Une ligne d'un mois voisin a exactement ce montant (${voisines.slice(0, 3).map(nom).join(", ")}) : sa date est peut-être à cheval entre deux mois.`, lignes: voisines.map((m) => m.id) });
  const inversees = ceMois.filter((m) => egal(montant(m) * 2, abs));
  if (inversees.length > 0) pistes.push({ texte: `La moitié de l'écart est le montant de ${inversees.slice(0, 3).map(nom).join(", ")} : cette ligne est peut-être enregistrée dans le mauvais sens (débit au lieu de crédit).`, lignes: inversees.map((m) => m.id) });

  // Opération en cours du même montant.
  const enCours = periode.enCours.filter((o) => egal(o.debit || o.credit, abs));
  if (enCours.length > 0) pistes.push({ texte: `L'opération en cours « ${enCours[0].designation} » a ce montant : est-elle déjà passée en banque ?`, lignes: [] });

  // Montant rond.
  if (abs >= 50 && egal(abs % 50, 0)) pistes.push({ texte: `${fr(abs)} est un montant rond : typique d'un virement, d'un versement ou d'un chèque entier oublié, ou saisi deux fois.`, lignes: [] });

  if (periode.aRevoir > 0) pistes.push({ texte: `${periode.aRevoir} ligne${periode.aRevoir > 1 ? "s" : ""} de ce mois ${periode.aRevoir > 1 ? "sont marquées" : "est marquée"} « à revoir » : commencez par ${periode.aRevoir > 1 ? "elles" : "elle"}.`, lignes: ceMois.filter((m) => m.aRevoir).map((m) => m.id) });

  pistes.push({ texte: "Pointez le relevé de la banque ligne par ligne avec le tableau de ce mois : l'écart est la somme des lignes présentes d'un côté seulement.", lignes: [] });
  return pistes;
}
