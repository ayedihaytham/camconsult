import { Router } from "express";
import { z } from "zod";
import { query, withTransaction } from "../db.js";
import { requireAuth } from "../auth.js";
import { logAction } from "../journal.js";
import {
  balanceDto,
  balanceLigneDto,
  immoMouvementDto,
  financementMouvementDto,
  tdrfLigneDto,
  tdrfParametresDto,
} from "../mappers.js";

export const balancesRouter = Router();
balancesRouter.use(requireAuth);

/** États financiers = données comptables internes : admin + collaborateurs
 * de la société uniquement. Jamais l'employé de société cliente. */
function canAccess(session, societeId) {
  if (session.role === "admin") return true;
  if (session.poste === "societe_employe") return false;
  return (session.societeIds || []).includes(societeId);
}

const ligneSchema = z.object({
  compte: z.string().default(""),
  libelle: z.string().default(""),
  debit: z.coerce.number().default(0),
  credit: z.coerce.number().default(0),
  affectat: z.string().default(""),
  // true = la ligne suivante d'apprentissage n'écrit que dans
  // grille_comptes_societe (ce dossier), jamais dans le référentiel
  // cabinet-wide grille_comptes — pour un compte dont le classement est
  // particulier à cette société, sans changer les autres dossiers.
  scopeSociete: z.coerce.boolean().default(false),
});

/** Mémorise l'association compte -> code AFFECTAT (et son libellé) pour
 * préremplir les futurs imports. Par défaut référentiel partagé par tout le
 * cabinet (grille_comptes) ; si `scopeSociete` est coché sur la ligne,
 * l'association n'est apprise que pour cette société (grille_comptes_societe,
 * consultée en priorité — voir routes/grilleAffectat.js). Le code AFFECTAT
 * lui-même (grille_affectat_codes) reste toujours cabinet-wide : seule
 * l'association compte -> code peut être limitée à un dossier. Ne bloque
 * jamais l'enregistrement de la balance en cas d'échec. */
async function learnMapping(client, lignes, societeId) {
  for (const l of lignes) {
    const compte = (l.compte || "").trim();
    const affectat = (l.affectat || "").trim();
    if (!affectat) continue;
    await client.query(
      `insert into grille_affectat_codes (code, libelle)
       values ($1, '')
       on conflict (code) do update set maj_le = now()`,
      [affectat],
    );
    if (!compte) continue;
    if (l.scopeSociete) {
      await client.query(
        `insert into grille_comptes_societe (societe_id, compte, affectat_code, libelle_compte)
         values ($1, $2, $3, $4)
         on conflict (societe_id, compte) do update
           set affectat_code = excluded.affectat_code,
               libelle_compte = coalesce(nullif(excluded.libelle_compte, ''), grille_comptes_societe.libelle_compte),
               maj_le = now()`,
        [societeId, compte, affectat, l.libelle || ""],
      );
      continue;
    }
    await client.query(
      `insert into grille_comptes (compte, affectat_code, libelle_compte)
       values ($1, $2, $3)
       on conflict (compte) do update
         set affectat_code = excluded.affectat_code,
             libelle_compte = coalesce(nullif(excluded.libelle_compte, ''), grille_comptes.libelle_compte),
             maj_le = now()`,
      [compte, affectat, l.libelle || ""],
    );
  }
}

// ── Balances (en-têtes par société/exercice) ──────
balancesRouter.get("/", async (req, res) => {
  const societeId = req.query.societeId;
  if (!societeId) return res.status(400).json({ error: "societeId requis" });
  if (!canAccess(req.session, societeId))
    return res.status(403).json({ error: "Accès non autorisé" });
  const { rows } = await query(
    "select * from balances where societe_id = $1 order by exercice desc",
    [societeId],
  );
  res.json(rows.map(balanceDto));
});

/** Étape 2 — Bilan/Etat de résultat/SIG : sommes par poste, pour tous les
 * exercices de la société, en une seule requête. Le backend ne fait que
 * l'agrégation ; la mise en page (Bilan Actif/Passif, CPC, SIG, sous-totaux)
 * est portée par le frontend (src/lib/etatsFinanciers/postes.ts). Les
 * lignes dont le code AFFECTAT n'a pas encore de poste assigné tombent dans
 * la clé "" ("non affecté") plutôt que de disparaître silencieusement.
 * Déclarée avant "/:id" pour ne pas être capturée par ce paramètre. */
balancesRouter.get("/postes", async (req, res) => {
  const societeId = req.query.societeId;
  if (!societeId) return res.status(400).json({ error: "societeId requis" });
  if (!canAccess(req.session, societeId))
    return res.status(403).json({ error: "Accès non autorisé" });

  // debit/credit renvoyés séparément (pas juste le solde net) pour permettre
  // au frontend de suggérer les mouvements d'immobilisations (acquisitions/
  // cessions/dotations/reprises) par différence d'un exercice à l'autre —
  // voir suggestImmoMouvement() dans immobilisations.ts. Sans effet sur les
  // autres tableaux, qui continuent à n'utiliser que "postes" (le solde).
  const { rows } = await query(
    `select b.exercice,
            coalesce(g.poste, '') as poste,
            sum(bl.debit - bl.credit) as solde,
            sum(bl.debit) as debit,
            sum(bl.credit) as credit
     from balances b
     join balance_lignes bl on bl.balance_id = b.id
     left join grille_affectat_codes g on g.code = bl.affectat
     where b.societe_id = $1
     group by b.exercice, coalesce(g.poste, '')`,
    [societeId],
  );

  const byExercice = new Map();
  for (const r of rows) {
    if (!byExercice.has(r.exercice))
      byExercice.set(r.exercice, {
        postes: {},
        postesDebit: {},
        postesCredit: {},
        codes: {},
        caLocalSuggere: 0,
        caExportSuggere: 0,
      });
    const entry = byExercice.get(r.exercice);
    entry.postes[r.poste] = Math.round(Number(r.solde) * 1000) / 1000;
    entry.postesDebit[r.poste] = Math.round(Number(r.debit) * 1000) / 1000;
    entry.postesCredit[r.poste] = Math.round(Number(r.credit) * 1000) / 1000;
  }

  // Synthèse par code AFFECTAT brut (pas par poste) — pour la vérification
  // ligne par ligne d'un import (onglet "Synthèse AFFECTAT"), indépendamment
  // du reclassement Bilan/CPC. "" = lignes sans code.
  const { rows: codeRows } = await query(
    `select b.exercice, coalesce(bl.affectat, '') as code, sum(bl.debit - bl.credit) as solde
     from balances b
     join balance_lignes bl on bl.balance_id = b.id
     where b.societe_id = $1
     group by b.exercice, coalesce(bl.affectat, '')`,
    [societeId],
  );
  for (const r of codeRows) {
    if (!byExercice.has(r.exercice)) continue;
    byExercice.get(r.exercice).codes[r.code] = Math.round(Number(r.solde) * 1000) / 1000;
  }

  // Suggestion CA local/export (TDRF, régime partiellement exportateur) :
  // repose sur le libellé du compte (contient "export" ou non), seul signal
  // disponible dans la balance — fiable seulement quand le client tient un
  // compte de vente export dédié (ex. "CA EXPORT ..."), pas déductible du
  // tout si les ventes sont regroupées sous un compte générique même pour un
  // exercice réellement 100 % export. Reste une suggestion, jamais imposée.
  const { rows: ventesRows } = await query(
    `select b.exercice,
            (bl.libelle ilike '%export%') as is_export,
            sum(bl.debit - bl.credit) as solde
     from balances b
     join balance_lignes bl on bl.balance_id = b.id
     left join grille_affectat_codes g on g.code = bl.affectat
     where b.societe_id = $1 and g.poste = 'cpc.ventes_marchandises'
     group by b.exercice, (bl.libelle ilike '%export%')`,
    [societeId],
  );
  for (const r of ventesRows) {
    if (!byExercice.has(r.exercice)) continue;
    const entry = byExercice.get(r.exercice);
    const ca = Math.round(-Number(r.solde) * 1000) / 1000;
    if (r.is_export) entry.caExportSuggere += ca;
    else entry.caLocalSuggere += ca;
  }

  const result = [...byExercice.entries()]
    .map(([exercice, v]) => ({ exercice, ...v }))
    .sort((a, b) => b.exercice.localeCompare(a.exercice));
  res.json(result);
});

// ── Mouvements d'immobilisations (étape 3 — TAB VAR Immob + volet
// investissement du Flux de trésorerie) : saisie manuelle par
// société/exercice/masse, la balance ne donnant que le solde de clôture.
// Déclarées avant "/:id" — même raison que "/postes" ci-dessus.
const MASSES = ["incorporelles", "corporelles", "financieres"];

balancesRouter.get("/immo-mouvements", async (req, res) => {
  const societeId = req.query.societeId;
  if (!societeId) return res.status(400).json({ error: "societeId requis" });
  if (!canAccess(req.session, societeId))
    return res.status(403).json({ error: "Accès non autorisé" });
  const { rows } = await query(
    "select * from immo_mouvements where societe_id = $1 order by exercice desc, masse",
    [societeId],
  );
  res.json(rows.map(immoMouvementDto));
});

const immoMouvementSchema = z.object({
  societeId: z.string().uuid(),
  exercice: z.string().min(1, "Exercice requis"),
  masse: z.enum(MASSES),
  acquisitions: z.coerce.number().default(0),
  cessions: z.coerce.number().default(0),
  dotations: z.coerce.number().default(0),
  reprises: z.coerce.number().default(0),
});

balancesRouter.put("/immo-mouvements", async (req, res) => {
  const parsed = immoMouvementSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0].message });
  const v = parsed.data;
  if (!canAccess(req.session, v.societeId))
    return res.status(403).json({ error: "Accès non autorisé" });

  const { rows } = await query(
    `insert into immo_mouvements (societe_id, exercice, masse, acquisitions, cessions, dotations, reprises)
     values ($1, $2, $3, $4, $5, $6, $7)
     on conflict (societe_id, exercice, masse) do update set
       acquisitions = excluded.acquisitions,
       cessions = excluded.cessions,
       dotations = excluded.dotations,
       reprises = excluded.reprises,
       maj_le = now()
     returning *`,
    [v.societeId, v.exercice, v.masse, v.acquisitions, v.cessions, v.dotations, v.reprises],
  );
  logAction(req.session.nom, "modification", "balance", `Mouvements ${v.masse} ${v.exercice}`);
  res.json(immoMouvementDto(rows[0]));
});

// ── Mouvements de financement (étape 3 — volet financement du Flux de
// trésorerie) : idem, ne peut pas être déduit fiablement de la seule
// variation du bilan (emprunt contracté ET remboursé la même année,
// dividendes compensés par un apport, etc.).
balancesRouter.get("/financement-mouvements", async (req, res) => {
  const societeId = req.query.societeId;
  if (!societeId) return res.status(400).json({ error: "societeId requis" });
  if (!canAccess(req.session, societeId))
    return res.status(403).json({ error: "Accès non autorisé" });
  const { rows } = await query(
    "select * from financement_mouvements where societe_id = $1 order by exercice desc",
    [societeId],
  );
  res.json(rows.map(financementMouvementDto));
});

const financementMouvementSchema = z.object({
  societeId: z.string().uuid(),
  exercice: z.string().min(1, "Exercice requis"),
  empruntsContractes: z.coerce.number().default(0),
  empruntsRembourses: z.coerce.number().default(0),
  dividendesDistribues: z.coerce.number().default(0),
  capitalNumeraire: z.coerce.number().default(0),
  interetsCourusNonEchus: z.coerce.number().default(0),
});

balancesRouter.put("/financement-mouvements", async (req, res) => {
  const parsed = financementMouvementSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0].message });
  const v = parsed.data;
  if (!canAccess(req.session, v.societeId))
    return res.status(403).json({ error: "Accès non autorisé" });

  const { rows } = await query(
    `insert into financement_mouvements
       (societe_id, exercice, emprunts_contractes, emprunts_rembourses, dividendes_distribues, capital_numeraire, interets_courus_non_echus)
     values ($1, $2, $3, $4, $5, $6, $7)
     on conflict (societe_id, exercice) do update set
       emprunts_contractes = excluded.emprunts_contractes,
       emprunts_rembourses = excluded.emprunts_rembourses,
       dividendes_distribues = excluded.dividendes_distribues,
       capital_numeraire = excluded.capital_numeraire,
       interets_courus_non_echus = excluded.interets_courus_non_echus,
       maj_le = now()
     returning *`,
    [
      v.societeId,
      v.exercice,
      v.empruntsContractes,
      v.empruntsRembourses,
      v.dividendesDistribues,
      v.capitalNumeraire,
      v.interetsCourusNonEchus,
    ],
  );
  logAction(req.session.nom, "modification", "balance", `Mouvements de financement ${v.exercice}`);
  res.json(financementMouvementDto(rows[0]));
});

// ── TDRF (étape 3) — réintégrations/déductions fiscales, saisie libre.
balancesRouter.get("/tdrf-lignes", async (req, res) => {
  const societeId = req.query.societeId;
  if (!societeId) return res.status(400).json({ error: "societeId requis" });
  if (!canAccess(req.session, societeId))
    return res.status(403).json({ error: "Accès non autorisé" });
  const { rows } = await query(
    "select * from tdrf_lignes where societe_id = $1 order by exercice desc, ordre",
    [societeId],
  );
  res.json(rows.map(tdrfLigneDto));
});

const tdrfLigneSchema = z.object({
  societeId: z.string().uuid(),
  exercice: z.string().min(1, "Exercice requis"),
  kind: z.enum(["reintegration", "deduction"]),
  libelle: z.string().default(""),
  montant: z.coerce.number().default(0),
});

balancesRouter.post("/tdrf-lignes", async (req, res) => {
  const parsed = tdrfLigneSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0].message });
  const v = parsed.data;
  if (!canAccess(req.session, v.societeId))
    return res.status(403).json({ error: "Accès non autorisé" });

  const { rows } = await query(
    `insert into tdrf_lignes (societe_id, exercice, ordre, kind, libelle, montant)
     values (
       $1, $2,
       (select coalesce(max(ordre), 0) + 1 from tdrf_lignes where societe_id = $1 and exercice = $2),
       $3, $4, $5
     ) returning *`,
    [v.societeId, v.exercice, v.kind, v.libelle, v.montant],
  );
  logAction(req.session.nom, "creation", "balance", `Ligne TDRF ${v.exercice} ajoutée`);
  res.status(201).json(tdrfLigneDto(rows[0]));
});

async function loadTdrfLigneOrFail(id, session, res) {
  const ligne = (await query("select * from tdrf_lignes where id = $1", [id])).rows[0];
  if (!ligne) {
    res.status(404).json({ error: "Ligne introuvable" });
    return null;
  }
  if (!canAccess(session, ligne.societe_id)) {
    res.status(403).json({ error: "Accès non autorisé" });
    return null;
  }
  return ligne;
}

balancesRouter.patch("/tdrf-lignes/:id", async (req, res) => {
  const existing = await loadTdrfLigneOrFail(req.params.id, req.session, res);
  if (!existing) return;
  const parsed = tdrfLigneSchema
    .pick({ kind: true, libelle: true, montant: true })
    .partial()
    .safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0].message });
  const v = parsed.data;

  const { rows } = await query(
    `update tdrf_lignes set
       kind = coalesce($2, kind),
       libelle = coalesce($3, libelle),
       montant = coalesce($4, montant),
       maj_le = now()
     where id = $1 returning *`,
    [req.params.id, v.kind ?? null, v.libelle ?? null, v.montant ?? null],
  );
  logAction(req.session.nom, "modification", "balance", "Ligne TDRF modifiée");
  res.json(tdrfLigneDto(rows[0]));
});

balancesRouter.delete("/tdrf-lignes/:id", async (req, res) => {
  const existing = await loadTdrfLigneOrFail(req.params.id, req.session, res);
  if (!existing) return;
  await query("delete from tdrf_lignes where id = $1", [req.params.id]);
  logAction(req.session.nom, "suppression", "balance", "Ligne TDRF supprimée");
  res.json({ ok: true });
});

// ── Paramètres TDRF (étape 3 — suite) : CA, taux, plancher, CSS,
// acomptes/excédents imputables. Déclarée avant "/:id" — même raison que
// les routes précédentes.
balancesRouter.get("/tdrf-parametres", async (req, res) => {
  const societeId = req.query.societeId;
  if (!societeId) return res.status(400).json({ error: "societeId requis" });
  if (!canAccess(req.session, societeId))
    return res.status(403).json({ error: "Accès non autorisé" });
  const { rows } = await query(
    "select * from tdrf_parametres where societe_id = $1 order by exercice desc",
    [societeId],
  );
  res.json(rows.map(tdrfParametresDto));
});

// Champs numériques du TDRF détaillé (Annexe n°2, note commune n°26/2016) —
// [clé camelCase du body, colonne snake_case] ; tous optionnels, défaut 0.
const TDRF_NUMERIC_FIELDS = [
  ["chiffreAffairesLocal", "chiffre_affaires_local"],
  ["chiffreAffairesExport", "chiffre_affaires_export"],
  ["tauxImposition", "taux_imposition"],
  ["tauxExport", "taux_export"],
  ["tauxMinimum", "taux_minimum"],
  ["plancherMinimum", "plancher_minimum"],
  ["contributionSociale", "contribution_sociale"],
  ["excedentsAcomptes", "excedents_acomptes"],
  ["pertesChangeNonRealisees", "pertes_change_non_realisees"],
  ["gainsChangeNonRealisesAnterieurs", "gains_change_non_realises_anterieurs"],
  ["remunerationsExcedentairesTitres", "remunerations_excedentaires_titres"],
  ["chargesEspeces5000", "charges_especes_5000"],
  ["moinsValueCessionTitresOpcvm", "moins_value_cession_titres_opcvm"],
  ["impotsDirectsLieuAutrui", "impots_directs_lieu_autrui"],
  ["taxeVoyage", "taxe_voyage"],
  ["transactionsAmendesPenalites", "transactions_amendes_penalites"],
  ["depensesEssaimage", "depenses_essaimage"],
  ["facturesNonParvenues", "factures_non_parvenues"],
  ["amortissementsBiensReevalues", "amortissements_biens_reevalues"],
  ["provisionsNonDeductibles", "provisions_non_deductibles"],
  ["provisionsCreancesDouteusesReintegrees", "provisions_creances_douteuses_reintegrees"],
  ["produitsEtranger", "produits_etranger"],
  ["provisionsCreancesDouteuses", "provisions_creances_douteuses"],
  ["provisionsDeprecStocksVente", "provisions_deprec_stocks_vente"],
  ["provisionsDeprecActionsCotees", "provisions_deprec_actions_cotees"],
  ["provisionsNonExigibiliteEngagements", "provisions_non_exigibilite_engagements"],
  ["moinsValueLeveeOption", "moins_value_levee_option"],
  ["reintegrationAmortissementsExercice", "reintegration_amortissements_exercice"],
  ["deductionDeficitsReportes", "deduction_deficits_reportes"],
  ["deductionAmortissementsExercice", "deduction_amortissements_exercice"],
  ["deductionAmortissementsDifferes", "deduction_amortissements_differes"],
  ["interetsDepotsTitresDevises", "interets_depots_titres_devises"],
  ["excedentsAnterieurs", "excedents_anterieurs"],
  ["acomptesProvisionnelsPayes", "acomptes_provisionnels_payes"],
  ["retenueALaSource", "retenue_a_la_source"],
  ["avanceIrppImport", "avance_irpp_import"],
];

const tdrfParametresSchema = z.object({
  societeId: z.string().uuid(),
  exercice: z.string().min(1, "Exercice requis"),
  ...Object.fromEntries(
    TDRF_NUMERIC_FIELDS.map(([key]) => [
      key,
      z.coerce.number().default(key === "tauxImposition" || key === "tauxExport" ? 0.2 : key === "tauxMinimum" ? 0.002 : key === "plancherMinimum" ? 500 : 0),
    ]),
  ),
});

balancesRouter.put("/tdrf-parametres", async (req, res) => {
  const parsed = tdrfParametresSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0].message });
  const v = parsed.data;
  if (!canAccess(req.session, v.societeId))
    return res.status(403).json({ error: "Accès non autorisé" });

  const cols = TDRF_NUMERIC_FIELDS.map(([, col]) => col);
  const values = TDRF_NUMERIC_FIELDS.map(([key]) => v[key]);
  const placeholders = values.map((_, i) => `$${i + 3}`);
  const updates = cols.map((c) => `${c} = excluded.${c}`);

  const { rows } = await query(
    `insert into tdrf_parametres (societe_id, exercice, ${cols.join(", ")})
     values ($1, $2, ${placeholders.join(", ")})
     on conflict (societe_id, exercice) do update set
       ${updates.join(",\n       ")},
       maj_le = now()
     returning *`,
    [v.societeId, v.exercice, ...values],
  );
  logAction(req.session.nom, "modification", "balance", `Paramètres TDRF ${v.exercice}`);
  res.json(tdrfParametresDto(rows[0]));
});

balancesRouter.get("/:id", async (req, res) => {
  const bal = (
    await query("select * from balances where id = $1", [req.params.id])
  ).rows[0];
  if (!bal) return res.status(404).json({ error: "Balance introuvable" });
  if (!canAccess(req.session, bal.societe_id))
    return res.status(403).json({ error: "Accès non autorisé" });
  const { rows: lignes } = await query(
    "select * from balance_lignes where balance_id = $1 order by ordre",
    [req.params.id],
  );
  res.json({ ...balanceDto(bal), lignes: lignes.map(balanceLigneDto) });
});

const createSchema = z.object({
  societeId: z.string().uuid(),
  exercice: z.string().min(1, "Exercice requis"),
  note: z.string().default(""),
});

balancesRouter.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0].message });
  const v = parsed.data;
  if (!canAccess(req.session, v.societeId))
    return res.status(403).json({ error: "Accès non autorisé" });

  const soc = (
    await query("select raison_sociale from societes where id = $1", [v.societeId])
  ).rows[0];
  if (!soc) return res.status(400).json({ error: "Société introuvable" });

  try {
    const { rows } = await query(
      `insert into balances (societe_id, exercice, note)
       values ($1, $2, $3) returning *`,
      [v.societeId, v.exercice, v.note],
    );
    logAction(req.session.nom, "creation", "balance", `${soc.raison_sociale} — ${v.exercice}`);
    res.status(201).json(balanceDto(rows[0]));
  } catch (err) {
    if (err.code === "23505")
      return res.status(409).json({ error: "Un exercice porte déjà ce nom pour cette société." });
    throw err;
  }
});

balancesRouter.patch("/:id", async (req, res) => {
  const existing = (
    await query("select * from balances where id = $1", [req.params.id])
  ).rows[0];
  if (!existing) return res.status(404).json({ error: "Balance introuvable" });
  if (!canAccess(req.session, existing.societe_id))
    return res.status(403).json({ error: "Accès non autorisé" });

  const parsed = createSchema.partial().safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0].message });
  const v = parsed.data;
  try {
    const { rows } = await query(
      `update balances set
         exercice = coalesce($2, exercice),
         note = coalesce($3, note),
         maj_le = now()
       where id = $1 returning *`,
      [req.params.id, v.exercice ?? null, v.note ?? null],
    );
    logAction(req.session.nom, "modification", "balance", rows[0].exercice);
    res.json(balanceDto(rows[0]));
  } catch (err) {
    if (err.code === "23505")
      return res.status(409).json({ error: "Un exercice porte déjà ce nom pour cette société." });
    throw err;
  }
});

balancesRouter.delete("/:id", async (req, res) => {
  const existing = (
    await query("select * from balances where id = $1", [req.params.id])
  ).rows[0];
  if (!existing) return res.status(404).json({ error: "Balance introuvable" });
  if (!canAccess(req.session, existing.societe_id))
    return res.status(403).json({ error: "Accès non autorisé" });

  // Les saisies manuelles (TAB VAR Immob, financement, TDRF, Notes) sont
  // indexées par société+exercice, pas par balance_id — elles ne sont donc
  // pas supprimées en cascade par la FK sur balances. On les efface ici
  // explicitement pour qu'un exercice supprimé reparte bien de zéro s'il
  // est recréé plus tard sous le même nom.
  await withTransaction(async (client) => {
    await client.query("delete from balances where id = $1", [req.params.id]);
    await client.query("delete from immo_mouvements where societe_id = $1 and exercice = $2", [
      existing.societe_id,
      existing.exercice,
    ]);
    await client.query(
      "delete from financement_mouvements where societe_id = $1 and exercice = $2",
      [existing.societe_id, existing.exercice],
    );
    await client.query("delete from tdrf_lignes where societe_id = $1 and exercice = $2", [
      existing.societe_id,
      existing.exercice,
    ]);
    await client.query("delete from notes_exercice where societe_id = $1 and exercice = $2", [
      existing.societe_id,
      existing.exercice,
    ]);
    await client.query("delete from tdrf_parametres where societe_id = $1 and exercice = $2", [
      existing.societe_id,
      existing.exercice,
    ]);
  });
  logAction(req.session.nom, "suppression", "balance", existing.exercice);
  res.json({ ok: true });
});

// ── Lignes ─────────────────────────────────────────
async function loadBalanceOrFail(id, session, res) {
  const bal = (await query("select * from balances where id = $1", [id])).rows[0];
  if (!bal) {
    res.status(404).json({ error: "Balance introuvable" });
    return null;
  }
  if (!canAccess(session, bal.societe_id)) {
    res.status(403).json({ error: "Accès non autorisé" });
    return null;
  }
  return bal;
}

balancesRouter.post("/:id/lignes", async (req, res) => {
  const bal = await loadBalanceOrFail(req.params.id, req.session, res);
  if (!bal) return;
  const parsed = ligneSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0].message });
  const v = parsed.data;

  const result = await withTransaction(async (client) => {
    const { rows: ordreRows } = await client.query(
      "select coalesce(max(ordre), 0) + 1 as n from balance_lignes where balance_id = $1",
      [req.params.id],
    );
    const { rows } = await client.query(
      `insert into balance_lignes (balance_id, ordre, compte, libelle, debit, credit, affectat)
       values ($1, $2, $3, $4, $5, $6, $7) returning *`,
      [req.params.id, ordreRows[0].n, v.compte, v.libelle, v.debit, v.credit, v.affectat],
    );
    await learnMapping(client, [v], bal.societe_id);
    return rows[0];
  });
  await query("update balances set maj_le = now() where id = $1", [req.params.id]);
  logAction(req.session.nom, "creation", "balance", `Ligne ${v.compte || "—"} ajoutée`);
  res.status(201).json(balanceLigneDto(result));
});

balancesRouter.patch("/:id/lignes/:ligneId", async (req, res) => {
  const bal = await loadBalanceOrFail(req.params.id, req.session, res);
  if (!bal) return;
  const existing = (
    await query("select * from balance_lignes where id = $1 and balance_id = $2", [
      req.params.ligneId,
      req.params.id,
    ])
  ).rows[0];
  if (!existing) return res.status(404).json({ error: "Ligne introuvable" });

  const parsed = ligneSchema.partial().safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0].message });
  const v = { ...balanceLigneDto(existing), ...parsed.data };

  const result = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `update balance_lignes set compte=$2, libelle=$3, debit=$4, credit=$5, affectat=$6
       where id = $1 returning *`,
      [req.params.ligneId, v.compte, v.libelle, v.debit, v.credit, v.affectat],
    );
    await learnMapping(client, [v], bal.societe_id);
    return rows[0];
  });
  await query("update balances set maj_le = now() where id = $1", [req.params.id]);
  logAction(req.session.nom, "modification", "balance", `Ligne ${v.compte || "—"} modifiée`);
  res.json(balanceLigneDto(result));
});

balancesRouter.delete("/:id/lignes/:ligneId", async (req, res) => {
  const bal = await loadBalanceOrFail(req.params.id, req.session, res);
  if (!bal) return;
  await query("delete from balance_lignes where id = $1 and balance_id = $2", [
    req.params.ligneId,
    req.params.id,
  ]);
  await query("update balances set maj_le = now() where id = $1", [req.params.id]);
  logAction(req.session.nom, "suppression", "balance", "Ligne supprimée");
  res.json({ ok: true });
});

/** Remplacement en bloc — utilisé par l'import Excel/CSV. */
const bulkSchema = z.object({ lignes: z.array(ligneSchema) });

balancesRouter.put("/:id/lignes", async (req, res) => {
  const bal = await loadBalanceOrFail(req.params.id, req.session, res);
  if (!bal) return;
  const parsed = bulkSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0].message });
  const { lignes } = parsed.data;

  await withTransaction(async (client) => {
    await client.query("delete from balance_lignes where balance_id = $1", [req.params.id]);
    let i = 0;
    for (const l of lignes) {
      i += 1;
      await client.query(
        `insert into balance_lignes (balance_id, ordre, compte, libelle, debit, credit, affectat)
         values ($1, $2, $3, $4, $5, $6, $7)`,
        [req.params.id, i, l.compte, l.libelle, l.debit, l.credit, l.affectat],
      );
    }
    await learnMapping(client, lignes, bal.societe_id);
  });
  await query("update balances set maj_le = now() where id = $1", [req.params.id]);
  logAction(req.session.nom, "import", "balance", `${lignes.length} ligne(s) importée(s)`);

  const { rows } = await query(
    "select * from balance_lignes where balance_id = $1 order by ordre",
    [req.params.id],
  );
  res.json(rows.map(balanceLigneDto));
});
