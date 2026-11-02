import { query } from "../db.js";
import { arrondi3 as r3 } from "../../shared/arrondi.js";
import { cleFournisseur, resoudre } from "../fournisseurCle.js";

/**
 * Situation du suivi fournisseur de toutes les sociétés visibles (page de choix de la société) : fournisseurs, factures à régler, solde dû par devise,
 * ce qu'il reste à faire (paiements en banque à rapprocher, n° de facture en double, règlements datés avant leur facture) et les principaux soldes dus.
 * Mêmes règles que l'écran d'une société (src/lib/fournisseurs.ts : un fournisseur est regroupé par clé et par fusions ; une facture est à régler tant que
 * son solde dépasse 0,0015) ; quelques requêtes groupées, jamais société par société.
 */
const TOLERANCE_SOLDE = 0.0015;

const cleNumero = (n) =>
  String(n || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

function jour(d) {
  if (!d) return null;
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}

export async function syntheseFournisseurs(societeIds) {
  if (societeIds.length === 0) return [];
  const [mouvements, affectations, fusionsLignes, reglements, avantFacture, paiements] = await Promise.all([
    query(
      `select m.id, m.societe_id, m.fournisseur, m.achat_num_facture, m.achat_devise, coalesce(sum(l.montant_devise), 0) as montant
         from stock_mouvements m
         left join stock_lignes l on l.mouvement_id = m.id and l.categorie = 'achat'
        where m.societe_id = any($1::uuid[]) and (m.fournisseur <> '' or m.achat_num_facture <> '')
        group by m.id
        order by m.achat_date nulls last, m.ordre, m.cree_le`,
      [societeIds],
    ),
    query(
      `select a.mouvement_id, sum(a.montant) as regle
         from fournisseur_affectations a join fournisseur_reglements r on r.id = a.reglement_id
        where r.societe_id = any($1::uuid[]) group by a.mouvement_id`,
      [societeIds],
    ),
    query("select societe_id, cle_source, cle_cible from fournisseur_fusions where societe_id = any($1::uuid[])", [societeIds]),
    query("select societe_id, count(*) as n, max(date_reglement) as dernier from fournisseur_reglements where societe_id = any($1::uuid[]) group by societe_id", [societeIds]),
    query(
      `select r.societe_id, count(distinct r.id) as n
         from fournisseur_reglements r
         join fournisseur_affectations a on a.reglement_id = r.id
         join stock_mouvements m on m.id = a.mouvement_id
        where r.societe_id = any($1::uuid[]) and r.date_reglement is not null and m.achat_date is not null and m.achat_date > r.date_reglement
        group by r.societe_id`,
      [societeIds],
    ),
    query(
      `select m.societe_id, count(*) as n
         from mouvements_bancaires m
        where m.societe_id = any($1::uuid[]) and m.type = 'paiement_fournisseur' and m.debit > 0
          and not exists (select 1 from fournisseur_reglements r where r.mouvement_bancaire_id = m.id)
        group by m.societe_id`,
      [societeIds],
    ),
  ]);

  const regle = new Map(affectations.rows.map((a) => [a.mouvement_id, Number(a.regle)]));
  const fusionsDe = new Map();
  for (const f of fusionsLignes.rows) {
    if (!fusionsDe.has(f.societe_id)) fusionsDe.set(f.societe_id, new Map());
    fusionsDe.get(f.societe_id).set(f.cle_source, f.cle_cible);
  }
  const parSociete = new Map();
  const ligne = (id) => {
    if (!parSociete.has(id)) parSociete.set(id, { societeId: id, factures: [], reglements: 0, dernierReglement: null, reglementsAvantFacture: 0, paiementsARapprocher: 0 });
    return parSociete.get(id);
  };
  for (const m of mouvements.rows) ligne(m.societe_id).factures.push(m);
  for (const r of reglements.rows) Object.assign(ligne(r.societe_id), { reglements: Number(r.n), dernierReglement: jour(r.dernier) });
  for (const r of avantFacture.rows) ligne(r.societe_id).reglementsAvantFacture = Number(r.n);
  for (const r of paiements.rows) ligne(r.societe_id).paiementsARapprocher = Number(r.n);

  return [...parSociete.values()].map((s) => {
    const fusions = fusionsDe.get(s.societeId) ?? new Map();
    const parCle = new Map();
    const soldesDevise = new Map();
    let impayees = 0;
    const numeros = new Map();
    for (const f of s.factures) {
      const cle = resoudre(fusions, cleFournisseur(f.fournisseur));
      const montant = Number(f.montant);
      const solde = Math.max(0, r3(montant - r3(regle.get(f.id) ?? 0)));
      const aRegler = montant - r3(regle.get(f.id) ?? 0) > TOLERANCE_SOLDE;
      if (aRegler) impayees++;
      const g = parCle.get(cle) ?? { noms: new Map(), soldes: new Map() };
      g.noms.set(f.fournisseur, (g.noms.get(f.fournisseur) ?? 0) + 1);
      g.soldes.set(f.achat_devise, r3((g.soldes.get(f.achat_devise) ?? 0) + solde));
      parCle.set(cle, g);
      soldesDevise.set(f.achat_devise, r3((soldesDevise.get(f.achat_devise) ?? 0) + solde));
      // n° de facture en double : même fournisseur (regroupé) et même numéro comparable
      const n = cleNumero(f.achat_num_facture);
      if (n) {
        const k = `${cleNumero(cle)}|${n}`;
        numeros.set(k, (numeros.get(k) ?? 0) + 1);
      }
    }
    const dette = (g) => [...g.soldes.values()].reduce((t, x) => t + x, 0);
    const principaux = [...parCle.values()]
      .filter((g) => dette(g) > TOLERANCE_SOLDE)
      .sort((a, b) => dette(b) - dette(a))
      .slice(0, 3)
      .map((g) => ({
        nom: [...g.noms.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "Fournisseur non renseigné",
        soldes: [...g.soldes.entries()].filter(([, m]) => m > TOLERANCE_SOLDE).map(([devise, montant]) => ({ devise, montant })),
      }));
    return {
      societeId: s.societeId,
      fournisseurs: parCle.size,
      factures: s.factures.length,
      impayees,
      soldes: [...soldesDevise.entries()].filter(([, m]) => m > TOLERANCE_SOLDE).map(([devise, montant]) => ({ devise, montant })).sort((a, b) => b.montant - a.montant),
      reglements: s.reglements,
      dernierReglement: s.dernierReglement,
      paiementsARapprocher: s.paiementsARapprocher,
      doublons: [...numeros.values()].filter((n) => n > 1).reduce((t, n) => t + n, 0),
      reglementsAvantFacture: s.reglementsAvantFacture,
      principaux,
    };
  });
}
