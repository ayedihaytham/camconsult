import "dotenv/config";
import { ensureSchema } from "./ensureSchema.js";
import { pool, withTransaction } from "./db.js";
import { ENVIRONNEMENT } from "./modules.js";

/**
 * Données de démonstration pour la Collecte de pièces, réservées à l'environnement de TEST.
 * Ajoute des sociétés fictives et des collectes à tous les états (client, à examiner, à corriger, validées, en retard),
 * sans toucher aux autres données. Relançable : les lignes qu'il crée ont des identifiants fixes et sont recréées à chaque fois.
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

async function main() {
  await ensureSchema();
  await withTransaction(async (client) => {
    await client.query("delete from collectes where id = any($1::uuid[])", [ids(COLLECTES)]);
    await client.query("delete from societes where id = any($1::uuid[])", [ids(SOCIETES)]);
    for (const s of SOCIETES) {
      await client.query(
        `insert into societes (id, raison_sociale, rne, tva, theme, code, statut, telephone, email, adresse, cree_le)
         values ($1,$2,$3,$4,$5,$6,'actif','+216 70 000 000',$7,'Tunis, Tunisie',now() - interval '90 days')`,
        [s.id, s.raison, `RNE-${s.code}`, `TN${s.code.slice(5)}`, s.theme, s.code, `contact@${s.code.toLowerCase()}.test`],
      );
    }
    for (const c of COLLECTES) {
      const onglets = Array.from({ length: c.nb }, (_, k) => ONGLETS[(c.rang + k) % ONGLETS.length]);
      const transmet = c.statut !== "brouillon";
      await client.query(
        `insert into collectes (id, societe_id, periode, statut, onglets, devise, echeance, cree_le, maj_le, transmis_le, valide_le)
         values ($1,$2,$3,$4,$5::jsonb,'TND',$6,$7,$8,$9,$10)`,
        [c.id, c.societeId, c.periode, c.statut, JSON.stringify(onglets), c.echeance, heure(24 * 20), heure(c.rang + 2), transmet ? heure(c.rang + 8) : null, c.statut === "valide" ? heure(c.rang + 4) : null],
      );
      for (const [k, onglet] of onglets.entries()) {
        await client.query(
          "insert into collecte_sections (collecte_id, onglet, recu_manuel, date_suivi) values ($1,$2,$3,$4)",
          [c.id, onglet, k < c.recus, k < c.recus ? jour(-3) : null],
        );
      }
    }
  });
  console.log(`[demo] ${SOCIETES.length} sociétés et ${COLLECTES.length} collectes de démonstration créées.`);
}

main().then(() => pool.end()).catch(async (err) => { console.error("[demo] Échec :", err.message); await pool.end(); process.exit(1); });
