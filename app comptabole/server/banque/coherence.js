import { query } from "../db.js";
import { arrondi3 as r3 } from "../../shared/arrondi.js";

/**
 * Cohérence entre le suivi bancaire, le suivi fournisseur et le suivi client devise d'une société : ce qui ne tombe pas juste, dit en clair, avec le lien
 * vers l'écran où le corriger. Rien n'est corrigé automatiquement.
 */
const TOLERANCE = 0.0015;

function jour(d) {
  if (!d) return null;
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}
const fr = (n) => n.toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).replace(/[  ]/g, " ");
const date = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "sans date");
const ordreGravite = { erreur: 0, attention: 1, info: 2 };

export async function alertesCoherence(societeId) {
  const alertes = [];
  const ajouter = (a) => alertes.push(a);

  // 1. Encaissements en banque pas (entièrement) affectés à une facture du suivi client devise.
  const { rows: encaissements } = await query(
    `select m.id, m.date_op, m.libelle, m.credit, c.devise,
            coalesce((select sum(mv.montant) from suivi_devise_mouvements mv where mv.mouvement_bancaire_id = m.id), 0) as affecte
       from mouvements_bancaires m join comptes_bancaires c on c.id = m.compte_id
      where m.societe_id = $1 and m.credit > 0 and m.type = 'encaissement_client'`,
    [societeId],
  );
  for (const e of encaissements) {
    const reste = r3(Number(e.credit) - Number(e.affecte));
    if (reste <= TOLERANCE) continue;
    const partiel = Number(e.affecte) > TOLERANCE;
    ajouter({
      code: "encaissement_non_affecte",
      modules: ["banque", "devise"],
      gravite: "attention",
      date: jour(e.date_op),
      message: partiel
        ? `Encaissement du ${date(jour(e.date_op))} « ${e.libelle.trim()} » : ${fr(reste)} ${e.devise} sur ${fr(Number(e.credit))} ne sont affectés à aucune facture client.`
        : `Encaissement du ${date(jour(e.date_op))} « ${e.libelle.trim()} » de ${fr(Number(e.credit))} ${e.devise} : aucune facture client n'est encore affectée.`,
      lien: { route: `/banque/${societeId}`, libelle: "Suivi bancaire" },
      mouvementBancaireId: e.id,
    });
  }

  // 2. Paiement en banque différent de la facture moins la retenue à la source (règlements fournisseur rapprochés, même devise que le compte).
  const { rows: paiements } = await query(
    `select r.id, r.date_reglement, r.devise, r.rs_montant, r.fournisseur_cle,
            (select coalesce(sum(a.montant), 0) from fournisseur_affectations a where a.reglement_id = r.id) as brut,
            m.debit, m.libelle, c.devise as compte_devise
       from fournisseur_reglements r
       join mouvements_bancaires m on m.id = r.mouvement_bancaire_id
       join comptes_bancaires c on c.id = m.compte_id
      where r.societe_id = $1`,
    [societeId],
  );
  for (const p of paiements) {
    if (p.compte_devise !== p.devise) continue; // montants en devises différentes : pas comparables sans cours
    const vire = r3(Number(p.brut) - Number(p.rs_montant));
    const ecart = r3(Number(p.debit) - vire);
    if (Math.abs(ecart) <= TOLERANCE) continue;
    ajouter({
      code: "montant_banque_different",
      modules: ["banque", "fournisseur"],
      gravite: "erreur",
      date: jour(p.date_reglement),
      message: `Règlement du ${date(jour(p.date_reglement))} (${p.fournisseur_cle}) : ${fr(Number(p.debit))} ${p.devise} sortis de la banque, mais factures moins retenue = ${fr(vire)} ${p.devise} (écart ${fr(ecart)}).`,
      lien: { route: `/fournisseurs/${societeId}`, libelle: "Suivi fournisseur" },
      reglementId: p.id,
    });
  }

  // 3. Factures sur-réglées : fournisseur (stock) et client (suivi devise).
  const { rows: achats } = await query(
    `select m.id, m.achat_num_facture, m.fournisseur, m.achat_devise,
            coalesce((select sum(l.montant_devise) from stock_lignes l where l.mouvement_id = m.id and l.categorie = 'achat'), 0) as montant,
            coalesce((select sum(a.montant) from fournisseur_affectations a where a.mouvement_id = m.id), 0) as regle
       from stock_mouvements m where m.societe_id = $1`,
    [societeId],
  );
  for (const a of achats) {
    const trop = r3(Number(a.regle) - Number(a.montant));
    if (trop <= TOLERANCE || Number(a.regle) <= 0) continue;
    ajouter({
      code: "facture_surreglee",
      modules: ["fournisseur", "stock"],
      gravite: "erreur",
      date: null,
      message: `Facture d'achat ${a.achat_num_facture || "sans numéro"} (${a.fournisseur}) sur-réglée de ${fr(trop)} ${a.achat_devise} : ${fr(Number(a.regle))} ${a.achat_devise} réglés pour ${fr(Number(a.montant))} ${a.achat_devise}.`,
      lien: { route: `/fournisseurs/${societeId}`, libelle: "Suivi fournisseur" },
      mouvementStockId: a.id,
    });
  }
  const { rows: ventes } = await query(
    `select f.id, f.n_facture, f.montant_total, f.avoir_montant, s.id as suivi_id, s.client, s.devise,
            coalesce((select sum(af.montant) from suivi_devise_affectations af where af.facture_id = f.id), 0) as regle
       from suivi_devise_factures f join suivi_devise s on s.id = f.suivi_id where s.societe_id = $1`,
    [societeId],
  );
  for (const f of ventes) {
    const du = Number(f.montant_total) - Number(f.avoir_montant ?? 0);
    const trop = r3(Number(f.regle) - du);
    if (trop <= TOLERANCE) continue;
    ajouter({
      code: "facture_surreglee",
      modules: ["devise"],
      gravite: "erreur",
      date: null,
      message: `Facture client ${f.n_facture || "sans numéro"} (${f.client}) sur-réglée de ${fr(trop)} ${f.devise} : ${fr(Number(f.regle))} ${f.devise} affectés pour ${fr(du)} ${f.devise}.`,
      lien: { route: `/suivi-devise/${societeId}/${f.suivi_id}`, libelle: "Suivi client devise" },
      factureId: f.id,
    });
  }

  // 4. Changes dont l'autre jambe n'est pas reliée (possible seulement avec deux comptes de devises différentes).
  const { rows: comptes } = await query("select distinct devise from comptes_bancaires where societe_id = $1", [societeId]);
  if (comptes.length >= 2) {
    const { rows: changes } = await query(
      `select m.id, m.date_op, m.libelle, m.debit, m.credit, c.devise
         from mouvements_bancaires m join comptes_bancaires c on c.id = m.compte_id
        where m.societe_id = $1 and m.type = 'change' and m.change_lie_id is null`,
      [societeId],
    );
    for (const c of changes) {
      const montant = Number(c.debit) > 0 ? Number(c.debit) : Number(c.credit);
      ajouter({
        code: "change_non_lie",
        modules: ["banque"],
        gravite: "info",
        date: jour(c.date_op),
        message: `Change du ${date(jour(c.date_op))} « ${c.libelle.trim()} » (${fr(montant)} ${c.devise}) : l'autre jambe n'est pas reliée, le cours réel n'est pas connu.`,
        lien: { route: `/banque/${societeId}`, libelle: "Suivi bancaire" },
        mouvementBancaireId: c.id,
      });
    }
  }

  // 5. Paiements fournisseur en banque qu'aucun règlement du suivi fournisseur ne rapproche : une seule alerte pour toute la société.
  const { rows: sansReglement } = await query(
    `select count(*) as n, coalesce(max(m.date_op), null) as dernier
       from mouvements_bancaires m
      where m.societe_id = $1 and m.type = 'paiement_fournisseur' and m.debit > 0
        and not exists (select 1 from fournisseur_reglements r where r.mouvement_bancaire_id = m.id)`,
    [societeId],
  );
  const nSans = Number(sansReglement[0]?.n ?? 0);
  if (nSans > 0) {
    ajouter({
      code: "paiement_non_rapproche",
      modules: ["banque", "fournisseur"],
      gravite: "attention",
      date: jour(sansReglement[0].dernier),
      message: `${nSans} paiement${nSans > 1 ? "s" : ""} fournisseur en banque ${nSans > 1 ? "n'ont" : "n'a"} pas de règlement dans le suivi fournisseur : les factures concernées restent à régler.`,
      lien: { route: `/fournisseurs/${societeId}`, libelle: "Suivi fournisseur" },
    });
  }

  return alertes.sort((a, b) => ordreGravite[a.gravite] - ordreGravite[b.gravite] || String(b.date ?? "").localeCompare(String(a.date ?? "")));
}
