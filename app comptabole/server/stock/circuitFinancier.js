import { query } from "../db.js";
import { arrondi3 as r3 } from "../../shared/arrondi.js";

/**
 * Circuit financier d'un mouvement de stock : la facture d'achat et ce qui l'a payée (règlements fournisseur, avec la retenue à la source et le paiement
 * en banque), la vente et ce qui l'a encaissée (fiche du suivi client devise, règlements, encaissements en banque), avec le décaissé et l'encaissé en dinars.
 * Un montant en devise est converti avec le cours du règlement, à défaut avec celui de la facture : le cours utilisé est toujours dit.
 */

function jour(d) {
  if (!d) return null;
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}

const banqueDto = (r) =>
  r.mb_id
    ? { id: r.mb_id, dateOp: jour(r.mb_date), libelle: r.mb_libelle, montant: Number(r.mb_debit) > 0 ? Number(r.mb_debit) : Number(r.mb_credit), devise: r.mb_devise }
    : null;

/** Cours à appliquer à un montant en devise : celui du règlement, à défaut celui de la facture. */
function coursPour(devise, coursReglement, coursFacture, sourceFacture) {
  if (devise === "TND") return { cours: 1, source: "tnd" };
  if (coursReglement > 0) return { cours: coursReglement, source: "reglement" };
  if (coursFacture > 0) return { cours: coursFacture, source: sourceFacture };
  return { cours: null, source: null };
}

export async function circuitDuMouvement(mouvementId) {
  const { rows } = await query("select * from stock_mouvements where id = $1", [mouvementId]);
  const m = rows[0];
  if (!m) return null;

  // Les montants d'une facture sont la somme de ses lignes (stock_lignes), pas une colonne de l'en-tête du mouvement.
  const { rows: lignes } = await query(
    "select categorie, coalesce(sum(montant_devise), 0) as devise, coalesce(sum(montant_tnd), 0) as tnd from stock_lignes where mouvement_id = $1 group by categorie",
    [mouvementId],
  );
  const total = (categorie) => {
    const l = lignes.find((x) => x.categorie === categorie);
    return { devise: l ? r3(Number(l.devise)) : 0, tnd: l ? r3(Number(l.tnd)) : 0 };
  };
  const achatTotal = total("achat");
  const venteTotal = total("vente");

  const { rows: regs } = await query(
    `select r.id, r.date_reglement, r.mode, r.reference, r.devise, r.cours, r.rs_montant, a.montant as affecte,
            (select coalesce(sum(x.montant), 0) from fournisseur_affectations x where x.reglement_id = r.id) as brut_total,
            mb.id as mb_id, mb.date_op as mb_date, mb.libelle as mb_libelle, mb.debit as mb_debit, mb.credit as mb_credit, c.devise as mb_devise
       from fournisseur_affectations a
       join fournisseur_reglements r on r.id = a.reglement_id
       left join mouvements_bancaires mb on mb.id = r.mouvement_bancaire_id
       left join comptes_bancaires c on c.id = mb.compte_id
      where a.mouvement_id = $1
      order by r.date_reglement nulls last, r.cree_le`,
    [mouvementId],
  );
  const reglementsFournisseur = regs.map((r) => {
    const affecte = Number(r.affecte);
    const brutTotal = Number(r.brut_total);
    const retenue = brutTotal > 0 ? r3((affecte / brutTotal) * Number(r.rs_montant)) : 0;
    const vire = r3(affecte - retenue);
    const { cours, source } = coursPour(r.devise, Number(r.cours), Number(m.achat_cours), "achat");
    return {
      id: r.id,
      date: jour(r.date_reglement),
      mode: r.mode,
      reference: r.reference,
      devise: r.devise,
      brut: affecte,
      retenue,
      vire,
      cours,
      coursSource: source,
      brutTnd: cours === null ? null : r3(affecte * cours),
      vireTnd: cours === null ? null : r3(vire * cours),
      banque: banqueDto(r),
    };
  });

  const { rows: facs } = await query(
    `select f.id, f.n_facture, f.montant_total, f.avoir_montant, s.id as suivi_id, s.client, s.exercice, s.devise
       from suivi_devise_factures f join suivi_devise s on s.id = f.suivi_id
      where f.mouvement_stock_id = $1`,
    [mouvementId],
  );
  const fac = facs[0] ?? null;
  let reglementsClient = [];
  if (fac) {
    const { rows: rc } = await query(
      `select mv.id, mv.date, mv.libelle, af.montant as affecte,
              mb.id as mb_id, mb.date_op as mb_date, mb.libelle as mb_libelle, mb.debit as mb_debit, mb.credit as mb_credit, c.devise as mb_devise
         from suivi_devise_affectations af
         join suivi_devise_mouvements mv on mv.id = af.mouvement_id
         left join mouvements_bancaires mb on mb.id = mv.mouvement_bancaire_id
         left join comptes_bancaires c on c.id = mb.compte_id
        where af.facture_id = $1
        order by mv.date nulls last, mv.ordre`,
      [fac.id],
    );
    reglementsClient = rc.map((r) => {
      const affecte = Number(r.affecte);
      const { cours, source } = coursPour(fac.devise, 0, Number(m.vente_cours), "vente");
      return { id: r.id, date: jour(r.date), libelle: r.libelle, devise: fac.devise, montant: affecte, cours, coursSource: source, montantTnd: cours === null ? null : r3(affecte * cours), banque: banqueDto(r) };
    });
  }

  const regleFournisseur = r3(reglementsFournisseur.filter((r) => r.devise === m.achat_devise).reduce((s, r) => s + r.brut, 0));
  const regleClient = r3(reglementsClient.reduce((s, r) => s + r.montant, 0));
  const totalFacture = fac ? r3(Number(fac.montant_total) - Number(fac.avoir_montant ?? 0)) : 0;
  const somme = (liste, champ) => r3(liste.reduce((s, x) => s + (x[champ] ?? 0), 0));
  const decaisseTnd = somme(reglementsFournisseur, "vireTnd");
  const encaisseTnd = somme(reglementsClient, "montantTnd");
  const achat = m.achat_num_facture || achatTotal.devise > 0
    ? { numFacture: m.achat_num_facture, date: jour(m.achat_date), fournisseur: m.fournisseur, devise: m.achat_devise, montant: achatTotal.devise, cours: Number(m.achat_cours), montantTnd: achatTotal.tnd }
    : null;
  const vente = m.vente_num_facture || venteTotal.devise > 0
    ? { numFacture: m.vente_num_facture, date: jour(m.vente_date), client: m.client, devise: m.vente_devise, montant: venteTotal.devise, cours: Number(m.vente_cours), montantTnd: venteTotal.tnd }
    : null;
  return {
    mouvementId: m.id,
    societeId: m.societe_id,
    achat,
    reglementsFournisseur,
    vente,
    suiviDevise: fac
      ? { suiviId: fac.suivi_id, factureId: fac.id, client: fac.client, exercice: fac.exercice, devise: fac.devise, nFacture: fac.n_facture, montantTotal: r3(Number(fac.montant_total)), avoir: Number(fac.avoir_montant ?? 0), regle: regleClient, reste: r3(totalFacture - regleClient) }
      : null,
    reglementsClient,
    totaux: {
      decaisseTnd,
      encaisseTnd,
      tresorerieTnd: r3(encaisseTnd - decaisseTnd),
      resteAPayer: achat ? { devise: m.achat_devise, montant: r3(achatTotal.devise - regleFournisseur) } : null,
      resteAEncaisser: fac ? { devise: fac.devise, montant: r3(totalFacture - regleClient) } : null,
      /** Vrai si un montant en devise n'a pas pu être converti (aucun cours connu) : les totaux en dinars sont alors incomplets. */
      incomplet: [...reglementsFournisseur, ...reglementsClient].some((x) => x.cours === null),
    },
  };
}
