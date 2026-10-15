import { stockMouvementDto, quantiteComparable } from "./mappers.js";

import { arrondi3 as r3 } from "../shared/arrondi.js";
const estDevise = (code) => Boolean(code) && String(code).trim().toUpperCase() !== "TND";

/** Valeur du stock restant d'un mouvement : le montant TND de l'achat, au prorata de la quantité encore en stock
 * (écart entre quantité achetée et vendue). Zéro quand tout est vendu ou qu'aucune quantité n'est renseignée. */
export function valeurRestante(dto) {
  const achatQuantite = dto.achatLignes.reduce((s, l) => s + quantiteComparable(l, dto.ecartUnite), 0);
  const achatTnd = dto.achatLignes.reduce((s, l) => s + (l.montantTnd || 0), 0);
  if (achatQuantite <= 0 || dto.ecart <= 0) return 0;
  return achatTnd * (Math.min(dto.ecart, achatQuantite) / achatQuantite);
}

/** Cours à saisir : un côté (achat ou vente) facturé en devise dont le cours de change n'est pas renseigné. */
export function coursASaisir(dto) {
  return (
    Number(estDevise(dto.achatDevise) && dto.achatLignes.length > 0 && !dto.achatCours) +
    Number(estDevise(dto.venteDevise) && dto.venteLignes.length > 0 && !dto.venteCours)
  );
}

/** Synthèse par société pour l'accueil du stock : mouvements, dernier mouvement, valeur du stock, alertes (écarts) et cours à saisir.
 * `mouvements` : lignes de stock_mouvements ; `lignes` : lignes de stock_lignes de ces mouvements. */
export function syntheseStock(mouvements, lignes, peutVoir = () => true) {
  const parMouvement = new Map();
  for (const l of lignes) parMouvement.set(l.mouvement_id, [...(parMouvement.get(l.mouvement_id) ?? []), l]);
  const synthese = {};
  for (const m of mouvements) {
    if (!peutVoir(m.societe_id)) continue;
    const dto = stockMouvementDto(m, parMouvement.get(m.id) ?? []);
    const s = (synthese[m.societe_id] ??= { mouvements: 0, dernierLe: null, valeur: 0, alertes: 0, coursManquants: 0, enDevise: 0 });
    s.mouvements += 1;
    if (dto.majLe && (!s.dernierLe || dto.majLe > s.dernierLe)) s.dernierLe = dto.majLe;
    s.valeur = r3(s.valeur + valeurRestante(dto));
    s.alertes += Number(dto.ecart !== 0);
    s.coursManquants += coursASaisir(dto);
    s.enDevise += Number((estDevise(dto.achatDevise) && dto.achatLignes.length > 0) || (estDevise(dto.venteDevise) && dto.venteLignes.length > 0));
  }
  return synthese;
}
