import "dotenv/config";
import { ensureSchema } from "./ensureSchema.js";
import { randomBytes } from "node:crypto";
import { hashPassword } from "./passwords.js";
import { pool, withTransaction } from "./db.js";
import { ENVIRONNEMENT } from "./modules.js";

/**
 * Données de démonstration pour la Collecte de pièces, réservées à l'environnement de TEST.
 * Ajoute des sociétés fictives et des collectes à tous les états (client, à examiner, à corriger, validées, en retard), avec leurs totaux et dates
 * de suivi, notes de récap, documents, demandes de pièces, historique, collaborateurs et tâches, sans toucher aux autres données. Relançable : les lignes qu'il crée ont des identifiants fixes et sont recréées à chaque fois.
 *
 *   docker exec app-comptable-test node server/seedDemoCollectes.js
 */
if (ENVIRONNEMENT !== "test") {
  console.error(`[demo] Refusé : ce script ne s'exécute que dans l'environnement de test (ENVIRONNEMENT=test, ici « ${ENVIRONNEMENT} »).`);
  process.exit(1);
}

const uuid = (prefix, i) => `${prefix}-0000-4000-8000-${String(i).padStart(12, "0")}`;
const jour = (decalage) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + decalage); return d.toISOString().slice(0, 10); };
const heure = (heuresAvant) => { const d = new Date(); d.setMinutes(0, 0, 0); d.setHours(d.getHours() - heuresAvant); return d.toISOString(); };

const SOCIETES = [
  ["Carthage Digital (démo)", "Grande entreprise"], ["Amilcar Conseil (démo)", "PME"], ["Medina Textile (démo)", "PME"], ["Olivier & Fils (démo)", "PME"],
  ["Sahel Export (démo)", "Grande entreprise"], ["Lagune Services (démo)", "PME"], ["Nour Logistique (démo)", "PME"], ["Mécanique du Sud (démo)", "Grande entreprise"],
  ["Cabinet d'architecture Yasmine (démo)", "Profession libérale"], ["Évasion Djerba (démo)", "PME"], ["Atelier Food Lab (démo)", "Auto-entrepreneur"], ["Cabinet médical Ben Salem (démo)", "Profession libérale"],
].map(([raison, theme], i) => ({ id: uuid("a1000000", i + 1), raison, theme, code: `DEMO-${String(i + 1).padStart(2, "0")}` }));

const ONGLETS = ["souche_cheques", "etat_cheques_emis", "bordereaux_remise_cheques", "virements_recus", "virements_emis", "virements_salaire", "chiffre_affaires", "detail_achats", "etat_caisse", "etat_clients", "etat_fournisseurs", "reglements_cb"];

// [société, période, statut, échéance (jours depuis aujourd'hui), nb de tableaux, tableaux déjà reçus]
const COLLECTES = [
  [0, "Octobre 2026", "a_corriger", -9, 8, 5], [0, "Novembre 2026", "brouillon", 12, 6, 1],
  [1, "Octobre 2026", "transmis", -2, 7, 7], [1, "Novembre 2026", "brouillon", 18, 5, 0],
  [2, "Octobre 2026", "brouillon", -6, 9, 3], [3, "Octobre 2026", "valide", -20, 6, 6],
  [4, "Octobre 2026", "transmis", 1, 10, 10], [4, "Septembre 2026", "valide", -40, 8, 8],
  [5, "Novembre 2026", "brouillon", 9, 4, 2], [6, "Octobre 2026", "a_corriger", -3, 6, 4],
  [7, "Octobre 2026", "transmis", 3, 9, 9], [8, "Octobre 2026", "brouillon", -1, 5, 2],
  [9, "Octobre 2026", "a_corriger", -12, 7, 4], [10, "Novembre 2026", "valide", -10, 5, 5],
  [11, "Octobre 2026", "brouillon", -4, 8, 6], [11, "Septembre 2026", "valide", -35, 8, 8],
].map(([s, periode, statut, echeance, nb, recus], i) => ({ id: uuid("a2000000", i + 1), societeId: SOCIETES[s].id, periode, statut, echeance: jour(echeance), nb, recus, rang: i }));

const ids = (liste) => liste.map((x) => x.id);

// Collaborateurs fictifs (comptes inutilisables : mot de passe aléatoire jamais communiqué) et tâches de démonstration.
const COLLABORATEURS = [
  ["Mansouri", "Lina", "Assistante", "lina.demo"], ["Kallel", "Rim", "Assistante", "rim.demo"], ["Chaabane", "Walid", "Stagiaire", "walid.demo"], ["Trabelsi", "Sana", "Gestionnaire de paie", "sana.demo"],
].map(([nom, prenom, type, identifiant], i) => ({ id: uuid("a3000000", i + 1), nom, prenom, type, identifiant }));

// [titre, société, collaborateur (null = non assignée), statut, début (jours), fin (jours), module]
const TACHES = [
  ["Relancer les pièces manquantes d'octobre", 0, 0, "en_cours", -6, 1, "collectes"], ["Contrôler la déclaration de TVA d'octobre", 1, 3, "a_faire", 0, 6, null],
  ["Préparer le rapprochement bancaire", 2, 1, "en_cours", -4, 2, "collectes"], ["Classer les justificatifs du mois", 3, 2, "a_faire", 0, 9, "structuration"],
  ["Réviser les comptes fournisseurs", 4, 0, "en_cours", -8, -1, null], ["Répondre aux questions du client sur la facture 2026-114", 5, 1, "a_faire", 0, 3, "messagerie"],
  ["Préparer la déclaration CNSS du trimestre", 6, 3, "a_faire", 2, 12, null], ["Mettre à jour le dossier permanent", 7, null, "a_faire", 0, 20, "structuration"],
  ["Vérifier les écritures de paie de novembre", 8, 3, "en_cours", -2, 4, null], ["Contrôler les factures d'export", 9, 2, "en_cours", -3, 5, "collectes"],
  ["Préparer le bordereau de remise des chèques", 10, 1, "a_faire", 1, 7, "collectes"], ["Analyser les écarts de trésorerie", 11, 0, "a_faire", 3, 15, null],
  ["Valider le grand livre auxiliaire", 0, 0, "termine", -20, -12, null], ["Archiver les pièces validées de septembre", 1, 2, "termine", -18, -10, "structuration"],
  ["Préparer le reporting de direction", 2, 3, "termine", -25, -15, null], ["Finaliser la révision des immobilisations", 3, 0, "termine", -30, -21, null],
  ["Relancer le client pour le relevé de la BIAT", 4, 1, "a_faire", -4, -2, "collectes"], ["Préparer la clôture mensuelle", 5, null, "a_faire", 5, 18, null],
  ["Contrôler les règlements clients", 6, 2, "en_cours", -5, 3, null], ["Mettre à jour les provisions", 7, 3, "a_faire", 6, 25, null],
].map(([titre, soc, collab, statut, debut, fin, module], i) => ({ id: uuid("a4000000", i + 1), titre, societeId: SOCIETES[soc].id, assigneId: collab === null ? null : COLLABORATEURS[collab].id, statut, debut: jour(debut), fin: jour(fin), module }));

const TOTAUX = [1250, 18420.5, 74960.25, 41305, 212884.9, 9870.125, 56300, 3120.75, 128450, 8250.5];
const COMMENTAIRES = ["Carnet n° 4 — 25 feuilles", "", "Reçu par e-mail", "", "Relevé de la BIAT", "Scan complet", "", "Pièces classées par mois"];
const LIBELLES = {
  souche_cheques: "Souche de chèques", etat_cheques_emis: "État des chèques émis", bordereaux_remise_cheques: "Bordereaux de remise de chèques",
  virements_recus: "Virements reçus", virements_emis: "Virements émis", virements_salaire: "Virements multiples (salaires)",
  chiffre_affaires: "Chiffre d'affaires", detail_achats: "Détail des achats", etat_caisse: "État de caisse",
  etat_clients: "État clients", etat_fournisseurs: "État fournisseurs", reglements_cb: "Règlements par carte bancaire",
};
const NOM_CLIENT = "Karim Mansour";
const NOM_CABINET = "Haytham Ben Amor";
// PDF d'une page, valide mais minimal : suffisant pour télécharger et ouvrir un document d'exemple.
const PDF = "data:application/pdf;base64,JVBERi0xLjQKMSAwIG9iajw8L1R5cGUvQ2F0YWxvZy9QYWdlcyAyIDAgUj4+ZW5kb2JqCjIgMCBvYmo8PC9UeXBlL1BhZ2VzL0tpZHNbMyAwIFJdL0NvdW50IDE+PmVuZG9iagozIDAgb2JqPDwvVHlwZS9QYWdlL1BhcmVudCAyIDAgUi9NZWRpYUJveFswIDAgMjAwIDIwMF0+PmVuZG9iagp0cmFpbGVyPDwvUm9vdCAxIDAgUj4+CiUlRU9GCg==";

const BANQUES = ["BIAT", "ZITOUNA", "STB", "ATTIJARI"];
const TIERS = ["Atlas Conseil", "Medina Textile", "Sahel Export", "Olivier & Fils", "Lagune Services"];
const FOURNISSEURS = ["STEG", "SONEDE", "Tunisie Telecom", "Papeterie Centrale", "Ooredoo"];

/** Lignes de saisie d'exemple pour les tableaux déjà reçus : de quoi juger les grilles avec de vraies données. */
const LIGNES = {
  souche_cheques: (i) => ({ date: jour(-20 + i * 2), num_cheque: String(104200 + i), beneficiaire: FOURNISSEURS[i % 5], motif: ["Facture électricité", "Eau", "Téléphone", "Fournitures", "Internet"][i % 5], montant: [412.5, 96.3, 184, 1250, 88.9][i % 5], banque: BANQUES[i % 4], observations: i === 2 ? "À rapprocher" : "" }),
  etat_cheques_emis: (i) => ({ date: jour(-22 + i * 2), num_cheque: String(104300 + i), beneficiaire: FOURNISSEURS[(i + 1) % 5], motif: "Règlement facture", montant: [2310, 740.25, 5120, 389.9][i % 4], banque: BANQUES[i % 4], observations: "" }),
  virements_recus: (i) => ({ date: jour(-15 + i * 3), reference: `VIR-${2026110 + i}`, montant: [12480, 8250.5, 54229.75, 3120][i % 4], observations: TIERS[i % 5] }),
  virements_emis: (i) => ({ date: jour(-14 + i * 3), reference: `VIR-E-${3310 + i}`, montant: [9870.125, 41305, 1560.4][i % 3], observations: FOURNISSEURS[i % 5] }),
  chiffre_affaires: (i) => ({ date: jour(-25 + i * 4), client: TIERS[i % 5], montant_ht: [8200, 15400.5, 3320, 27800, 1980][i % 5], tva_pct: 19, non_soumis: 0, timbre: 1 }),
  detail_achats: (i) => ({ date: jour(-24 + i * 4), num_facture: `F-${7710 + i}`, fournisseur: FOURNISSEURS[i % 5], montant_ht: [1240, 560.8, 9320, 275, 3180][i % 5], tva_pct: 19, non_soumis: 0, timbre: 1 }),
};
const NB_LIGNES = { souche_cheques: 5, etat_cheques_emis: 4, virements_recus: 4, virements_emis: 3, chiffre_affaires: 5, detail_achats: 5 };

async function semerLignes(client, c, recus) {
  for (const onglet of recus) {
    const faire = LIGNES[onglet];
    if (!faire) continue;
    for (let i = 0; i < NB_LIGNES[onglet]; i += 1) {
      await client.query("insert into collecte_lignes (collecte_id, onglet, ordre, data, cree_le) values ($1,$2,$3,$4::jsonb,$5)", [c.id, onglet, i, JSON.stringify(faire(i)), heure(96 - i)]);
    }
  }
}

/** Récap d'anomalies : une note du cabinet, une case manquante ciblée, et parfois la réponse du client. */
async function semerRecap(client, c, onglets) {
  if (!["a_corriger", "transmis"].includes(c.statut) && c.rang % 4 !== 0) return;
  const cible = onglets[Math.min(2, onglets.length - 1)];
  await client.query(
    "insert into collecte_notes (collecte_id, onglet, kind, auteur, texte, cree_le) values ($1,'','note','admin',$2,$3)",
    [c.id, "Merci de compléter les tableaux en attente avant la fin de la semaine ; les relevés de septembre sont déjà classés.", heure(60 + c.rang)],
  );
  const manque = await client.query(
    "insert into collecte_notes (collecte_id, onglet, kind, auteur, ref, cible_ordre, cible_col, texte, cree_le) values ($1,$2,'manque','admin','Ligne 3 · Montant',2,'montant',$3,$4) returning id",
    [c.id, cible, `Le montant de la ligne 3 de « ${LIBELLES[cible] ?? cible} » est manquant.`, heure(48 + c.rang)],
  );
  if (c.rang % 2 === 0) {
    await client.query(
      "insert into collecte_notes (collecte_id, onglet, kind, parent_id, auteur, texte, cree_le) values ($1,$2,'reponse',$3,'client',$4,$5)",
      [c.id, cible, manque.rows[0].id, "Montant complété, le justificatif est joint au dossier.", heure(30 + c.rang)],
    );
  }
}

/** Documents : pièces jointes aux tableaux, et demandes de pièces (en attente ou fournies). */
async function semerDocuments(client, c, onglets) {
  const fichiers = [
    ["releve-bancaire-octobre.pdf", "pdf", "214 Ko", onglets[0], NOM_CLIENT],
    ["facture-steg-1043.pdf", "pdf", "96 Ko", onglets[Math.min(6, onglets.length - 1)], NOM_CLIENT],
    ["bordereau-remise-0481.pdf", "pdf", "132 Ko", onglets[Math.min(2, onglets.length - 1)], NOM_CABINET],
  ];
  for (const [k, [nom, format, taille, onglet, par]] of fichiers.entries()) {
    await client.query(
      "insert into collecte_fichiers (collecte_id, onglet, nom, format, taille, data_url, depose_par, cree_le) values ($1,$2,$3,$4,$5,$6,$7,$8)",
      [c.id, onglet, nom, format, taille, PDF, par, heure(72 - k * 20 + c.rang)],
    );
  }
  await client.query(
    "insert into collecte_demandes_pieces (collecte_id, texte, demande_par, categorie, tiers, statut, fournie_par, fournie_le, cree_le) values ($1,$2,$3,'client','Atlas Conseil','fournie',$4,$5,$6)",
    [c.id, "Facture de décembre 2025 (copie signée)", NOM_CABINET, NOM_CLIENT, heure(20), heure(90)],
  );
  await client.query(
    "insert into collecte_demandes_pieces (collecte_id, texte, demande_par, categorie, tiers, statut, cree_le) values ($1,$2,$3,'fournisseur','Steg','en_attente',$4)",
    [c.id, "Facture d'électricité d'octobre", NOM_CABINET, heure(36)],
  );
}

/** Historique : les actions que le journal enregistre pour une collecte, de la création à la relance. */
async function semerHistorique(client, c, onglets) {
  // Le journal est en ajout seul (aucune suppression possible) : l'historique d'une collecte de démonstration n'est écrit qu'une fois.
  const deja = await client.query("select 1 from journal where entity = 'collecte' and entity_id = $1 and actor = any($2) limit 1", [c.id, [NOM_CLIENT, NOM_CABINET]]);
  if (deja.rowCount > 0) return;
  const societe = SOCIETES.find((x) => x.id === c.societeId)?.raison ?? "";
  const lib = (cle) => LIBELLES[cle] ?? cle;
  const evenements = [
    [24 * 20, NOM_CABINET, "création", `Collecte créée — ${societe} ${c.periode}`],
    [24 * 19, NOM_CABINET, "modification", `Tableaux demandés : ${onglets.slice(0, 3).map(lib).join(", ")} — ${societe}`],
    [24 * 12, NOM_CLIENT, "modification", `Transmis « ${lib(onglets[0])} » — ${societe} ${c.periode}`],
    [24 * 8, NOM_CABINET, "modification", `Renvoyé pour correction « ${lib(onglets[Math.min(2, onglets.length - 1)])} » — ${societe} ${c.periode}`],
    [24 * 5, "Système", "modification", `Relance automatique envoyée — ${societe}`],
    [24 * 2, NOM_CLIENT, "modification", `Transmis « ${lib(onglets[Math.min(2, onglets.length - 1)])} » (incomplet) — ${societe} ${c.periode}`],
  ];
  if (c.statut === "valide") evenements.push([6, NOM_CABINET, "modification", `Validé « ${lib(onglets[0])} » — ${societe} ${c.periode}`]);
  for (const [h, acteur, action, label] of evenements) {
    await client.query(
      "insert into journal (at, actor, action, entity, label, entity_id) values ($1,$2,$3,'collecte',$4,$5)",
      [heure(h), acteur, action, label, c.id],
    );
  }
}

async function main() {
  await ensureSchema();
  await withTransaction(async (client) => {
    await client.query("delete from taches where id = any($1::uuid[])", [ids(TACHES)]);
    await client.query("delete from employes where id = any($1::uuid[])", [ids(COLLABORATEURS)]);
    await client.query("delete from collectes where id = any($1::uuid[])", [ids(COLLECTES)]);
    await client.query("delete from societes where id = any($1::uuid[])", [ids(SOCIETES)]);
    for (const s of SOCIETES) {
      await client.query(
        `insert into societes (id, raison_sociale, rne, tva, theme, code, statut, telephone, email, adresse, cree_le)
         values ($1,$2,$3,$4,$5,$6,'actif','+216 70 000 000',$7,'Tunis, Tunisie',now() - interval '90 days')`,
        [s.id, s.raison, `RNE-${s.code}`, `TN${s.code.slice(5)}`, s.theme, s.code, `contact@${s.code.toLowerCase()}.test`],
      );
    }
    for (const e of COLLABORATEURS) {
      await client.query(
        `insert into employes (id, nom, prenom, identifiant, mot_de_passe, mdp_hash, type, role, email, statut, societes_assignees, permissions, cree_le)
         values ($1,$2,$3,$4,'',$5,$6,'collaborateur',$7,'actif',$8::jsonb,$9::jsonb,now() - interval '60 days')`,
        [e.id, e.nom, e.prenom, e.identifiant, await hashPassword(randomBytes(18).toString("hex")), e.type, `${e.identifiant}@demo.test`, JSON.stringify(ids(SOCIETES)), JSON.stringify({ consulterDossiers: true, deposerFichiers: true, modifierSocietes: false, supprimer: false, messagerie: true })],
      );
    }
    for (const [i, t] of TACHES.entries()) {
      const fait = t.statut === "termine";
      await client.query(
        `insert into taches (id, titre, description, societe_id, assigne_id, statut, cree_par, cree_le, maj_le, termine_le, module, debut_prevu, fin_prevue)
         values ($1,$2,$3,$4,$5,$6,'Mohamed Ayedi',$7,$8,$9,$10,$11,$12)`,
        [t.id, t.titre, "", t.societeId, t.assigneId, t.statut, heure(24 * 12 - i * 5), heure(i * 3 + 2), fait ? heure(24 * 3 + i) : null, t.module, t.debut, t.fin],
      );
    }
    for (const c of COLLECTES) {
      const onglets = Array.from({ length: c.nb }, (_, k) => ONGLETS[k % ONGLETS.length]);
      const transmet = c.statut !== "brouillon";
      await client.query(
        `insert into collectes (id, societe_id, periode, statut, onglets, devise, echeance, cree_le, maj_le, transmis_le, valide_le)
         values ($1,$2,$3,$4,$5::jsonb,'TND',$6,$7,$8,$9,$10)`,
        [c.id, c.societeId, c.periode, c.statut, JSON.stringify(onglets), c.echeance, heure(24 * 20), heure(c.rang + 2), transmet ? heure(c.rang + 8) : null, c.statut === "valide" ? heure(c.rang + 4) : null],
      );
      for (const [k, onglet] of onglets.entries()) {
        const recu = k < c.recus;
        await client.query(
          `insert into collecte_sections (collecte_id, onglet, recu_manuel, date_suivi, total_saisi, commentaire, recap_statut)
           values ($1,$2,$3,$4,$5,$6,$7)`,
          [c.id, onglet, recu, recu ? jour(-1 - (k % 5)) : null, recu ? TOTAUX[(c.rang * 3 + k) % TOTAUX.length] : null, recu ? (COMMENTAIRES[(c.rang + k) % COMMENTAIRES.length] ?? "") : (k === c.recus && c.statut === "a_corriger" ? "Fichier illisible, à renvoyer" : ""), c.statut === "a_corriger" && k === c.recus ? "envoye" : "none"],
        );
      }
      if (c.rang % 2 === 0) await semerLignes(client, c, onglets.slice(0, c.recus));
      await semerRecap(client, c, onglets);
      await semerDocuments(client, c, onglets);
      await semerHistorique(client, c, onglets);
    }
  });
  console.log(`[demo] ${SOCIETES.length} sociétés, ${COLLECTES.length} collectes (totaux, récap, documents, demandes de pièces, historique), ${COLLABORATEURS.length} collaborateurs et ${TACHES.length} tâches de démonstration créés.`);
}

main().then(() => pool.end()).catch(async (err) => { console.error("[demo] Échec :", err.message); await pool.end(); process.exit(1); });
