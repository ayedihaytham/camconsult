import { hash } from "./audit.js";
import { totals } from "./amounts.js";
export function invoiceControls(row) {
  const controls = [];
  const add = (code, severity, message) =>
    controls.push({
      code,
      severity,
      message,
      factureId: row.id,
      version: row.version,
    });
  if (!row.bc_id) add("BC_MANQUANT", "blocage", "Affecter un BC.");
  if (row.date_precision !== "day" || !row.date_facture)
    add("DATE_INCOMPLETE", "blocage", "Compléter la date de facture.");
  if (!row.matricule_fiscal_normalise)
    add(
      "IDENTITE_NON_VERIFIEE",
      "blocage",
      "Vérifier le matricule fiscal fournisseur.",
    );
  if (row.identite_corrigee)
    add(
      "IDENTITE_FOURNISSEUR_CORRIGEE",
      "avertissement",
      "L’identité fiscale du fournisseur a été modifiée. Vérifier l’historique et le justificatif.",
    );
  const mf=value=>String(value||"").replace(/\s+/g,"").toUpperCase();
  if(row.import_declarant_mf&&row.profil_declarant_mf&&mf(row.import_declarant_mf)!==mf(row.profil_declarant_mf))add("DECLARANT_SOURCE_DIFFERENT","avertissement","Le matricule déclarant du fichier source diffère du profil courant. Vérifier la société et les composantes fiscales avant validation.");
  if (row.bc_id && !row.date_bc)
    add("DATE_BC_MANQUANTE", "blocage", "Compléter la date du BC.");
  if (row.tva_mode === "manuel")
    add(
      "TVA_MANUELLE",
      "avertissement",
      "TVA corrigée manuellement : contrôler le justificatif.",
    );
  if (row.date_facture) {
    const date =
      typeof row.date_facture === "string"
        ? row.date_facture.slice(0, 10)
        : `${row.date_facture.getFullYear()}-${String(row.date_facture.getMonth() + 1).padStart(2, "0")}-${String(row.date_facture.getDate()).padStart(2, "0")}`;
    const quarter = `T${Math.ceil(Number(date.slice(5, 7)) / 3)}`;
    if (Number(date.slice(0, 4)) !== row.annee || quarter !== row.trimestre)
      add(
        "HORS_PERIODE",
        row.motif_periode ? "avertissement" : "blocage",
        "Date hors trimestre affecté : justification requise.",
      );
    const bcDate =
      row.date_bc instanceof Date
        ? `${row.date_bc.getFullYear()}-${String(row.date_bc.getMonth() + 1).padStart(2, "0")}-${String(row.date_bc.getDate()).padStart(2, "0")}`
        : row.date_bc;
    if (bcDate && date < bcDate)
      add("AVANT_BC", "avertissement", "Facture antérieure au BC.");
  }
  if (row.conflit)
    add("ECART_STOCK", "blocage", "Résoudre le conflit avec Stock.");
  if (!row.has_piece)
    add("PIECE_MANQUANTE", "blocage", "Associer le justificatif de facture.");
  if (row.bc_id && !row.has_bc_piece)
    add("PIECE_BC_MANQUANTE", "blocage", "Associer le justificatif du BC.");
  if (row.autorisation_id && !row.has_autorisation_piece)
    add(
      "PIECE_AUTORISATION_MANQUANTE",
      "blocage",
      "Associer le justificatif d’autorisation.",
    );
  if (row.duplicate_count > 1)
    add(
      "DOUBLON_POSSIBLE",
      "avertissement",
      "Facture potentiellement en double.",
    );
  if (
    row.bc_plafond != null &&
    BigInt(row.bc_total_ht) > BigInt(row.bc_plafond)
  )
    add("PLAFOND_BC", "blocage", "Le plafond HT renseigné du BC est dépassé.");
  if (
    row.autorisation_plafond_ht != null &&
    BigInt(row.autorisation_total_ht) > BigInt(row.autorisation_plafond_ht)
  )
    add(
      "PLAFOND_AUTORISATION_HT",
      "blocage",
      "Le plafond HT renseigné de l’autorisation est dépassé.",
    );
  if (
    row.autorisation_plafond_tva != null &&
    BigInt(row.autorisation_total_tva) > BigInt(row.autorisation_plafond_tva)
  )
    add(
      "PLAFOND_AUTORISATION_TVA",
      "blocage",
      "Le plafond TVA renseigné de l’autorisation est dépassé.",
    );
  if (
    row.date_facture &&
    ((row.autorisation_debut && row.date_facture < row.autorisation_debut) ||
      (row.autorisation_fin && row.date_facture > row.autorisation_fin))
  )
    add(
      "VALIDITE_AUTORISATION",
      "avertissement",
      "La date sort de la validité renseignée de l’autorisation.",
    );
  if (row.autorisation_statut === "annulee")
    add(
      "AUTORISATION_ANNULEE",
      "blocage",
      "L’autorisation a été annulée dans le dossier.",
    );
  for (const c of controls) c.fingerprint = hash({ row, code: c.code });
  return controls;
}
export async function periodData(client, societeId, annee, trimestre) {
  const rows = (
    await client.query(
      `with bc_totaux as (select bc_id,sum(montant_ht_millimes)::text ht,sum(tva_suspendue_millimes)::text tva from apurement_factures where societe_id=$1 and not archived group by bc_id),
    autorisation_totaux as (select b.autorisation_id,sum(bt.ht::numeric)::text ht,sum(bt.tva::numeric)::text tva from bc_totaux bt join apurement_bons_commande b on b.id=bt.bc_id and b.societe_id=$1 group by b.autorisation_id),
    identites_corrigees as (select distinct entity_id from apurement_audit where societe_id=$1 and action='fournisseurs.modifier' and avant->>'matricule_fiscal_normalise' is distinct from apres->>'matricule_fiscal_normalise'),
    import_declarants as materialized (select id,preview->'profil'->>'matriculeFiscal' as mf from apurement_imports where societe_id=$1)
    select f.*,to_char(f.date_facture,'YYYY-MM-DD') as date_facture,s.raison_sociale,s.matricule_fiscal_raw,s.matricule_fiscal_normalise,
    b.numero as bc_numero,to_char(b.date_bc,'YYYY-MM-DD') as date_bc,b.autorisation_id,a.numero as autorisation_numero,
    ic.entity_id is not null as identite_corrigee,
    im.mf as import_declarant_mf,pf.donnees->>'matriculeFiscal' as profil_declarant_mf,
    b.plafond_ht_millimes as bc_plafond,bt.ht as bc_total_ht,a.plafond_ht_millimes as autorisation_plafond_ht,a.plafond_tva_millimes as autorisation_plafond_tva,
    at.ht as autorisation_total_ht,at.tva as autorisation_total_tva,to_char(a.date_debut,'YYYY-MM-DD') as autorisation_debut,to_char(a.date_fin,'YYYY-MM-DD') as autorisation_fin,a.statut_interne as autorisation_statut,
    exists(select 1 from apurement_pieces_liens p where p.societe_id=f.societe_id and p.parent_type='bc' and p.parent_id=b.id) has_bc_piece,
    exists(select 1 from apurement_pieces_liens p where p.societe_id=f.societe_id and p.parent_type='autorisation' and p.parent_id=a.id) has_autorisation_piece,
    exists(select 1 from apurement_pieces_liens p where p.societe_id=f.societe_id and p.parent_type='facture' and p.parent_id=f.id) has_piece,
    (select count(*) from apurement_factures d join apurement_fournisseurs ds on ds.id=d.fournisseur_id and ds.societe_id=d.societe_id where d.societe_id=f.societe_id
      and (d.fournisseur_id=f.fournisseur_id or (s.matricule_fiscal_normalise is not null and ds.matricule_fiscal_normalise=s.matricule_fiscal_normalise))
      and lower(trim(d.numero_facture))=lower(trim(f.numero_facture)) and not d.archived
      and (d.date_facture=f.date_facture or d.date_facture is null or f.date_facture is null))::int duplicate_count
    from apurement_factures f join apurement_fournisseurs s on s.id=f.fournisseur_id and s.societe_id=f.societe_id
    left join apurement_bons_commande b on b.id=f.bc_id and b.societe_id=f.societe_id
    left join apurement_autorisations a on a.id=b.autorisation_id and a.societe_id=b.societe_id
    left join bc_totaux bt on bt.bc_id=b.id left join autorisation_totaux at on at.autorisation_id=a.id
    left join identites_corrigees ic on ic.entity_id=s.id
    left join import_declarants im on im.id=f.import_id left join apurement_profils_fiscaux pf on pf.societe_id=f.societe_id
    where f.societe_id=$1 and f.annee=$2 and f.trimestre=$3 and not f.archived order by f.id`,
      [societeId, annee, trimestre],
    )
  ).rows;
  const acks = (
    await client.query(
      "select * from apurement_controles_ack where societe_id=$1 and facture_id=any($2::uuid[])",
      [societeId, rows.map((r) => r.id)],
    )
  ).rows;
  const ackMap = new Map(
    acks.map((a) => [`${a.facture_id}|${a.code}|${a.fingerprint}`, a]),
  );
  const controls = rows.flatMap(invoiceControls).map((c) => ({
    ...c,
    ack: ackMap.get(`${c.factureId}|${c.code}|${c.fingerprint}`) || null,
  }));
  return { rows, controls, totals: totals(rows), provisoire: true };
}
