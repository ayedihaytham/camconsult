import { Router } from "express";
import { z } from "zod";
import { query, withTransaction } from "../db.js";
import { requireAuth } from "../auth.js";
import { logAction } from "../journal.js";
import { safeRouter } from "../asyncRoutes.js";
import { alertesCoherence } from "../banque/coherence.js";
import { statutsMoisCompte } from "../../shared/banqueStatuts.js";
import { arrondi3 as r3 } from "../../shared/arrondi.js";

/** Suivi bancaire : comptes d'une société et leurs mouvements.
 * Lecture : admin, collaborateurs de la société et responsable de la société (jamais un délégué).
 * Écriture : admin et collaborateurs de la société. */
export const banqueRouter = safeRouter(Router());
banqueRouter.use(requireAuth);

const inScope = (s, societeId) => s.role === "admin" || s.poste === "responsable_collaborateurs" || (s.societeIds || []).includes(societeId);
const canWrite = (s, societeId) => s.poste !== "societe_employe" && inScope(s, societeId);
const canRead = (s, societeId) =>
  canWrite(s, societeId) || (s.poste === "societe_employe" && inScope(s, societeId));

const TYPES = ["encaissement_client", "paiement_fournisseur", "frais", "credit", "change", "autre"];

/** Date PostgreSQL (minuit local) -> AAAA-MM-JJ, sans décalage de fuseau. */
function jour(d) {
  if (!d) return null;
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}

async function etat(societeId) {
  const { rows: comptes } = await query(
    "select * from comptes_bancaires where societe_id = $1 order by ordre, cree_le",
    [societeId],
  );
  const { rows: mouvements } = await query(
    `select m.*, r.id as reglement_id, r.fournisseur_cle,
            coalesce((select sum(mv.montant) from suivi_devise_mouvements mv where mv.mouvement_bancaire_id = m.id), 0) as affecte_client,
            coalesce((select json_agg(json_build_object('suiviId', mv.suivi_id, 'mouvementId', mv.id)) from suivi_devise_mouvements mv where mv.mouvement_bancaire_id = m.id), '[]'::json) as reglements_client
       from mouvements_bancaires m
       left join fournisseur_reglements r on r.mouvement_bancaire_id = m.id
      where m.societe_id = $1
      order by m.date_op, m.ordre, m.cree_le`,
    [societeId],
  );
  // Jambes d'un même change : le cours réel est le montant en dinars ÷ le montant en devise (information, rien n'est recalculé avec).
  const devises = new Map(comptes.map((x) => [x.id, x.devise]));
  const parId = new Map(mouvements.map((x) => [x.id, x]));
  const montantDe = (x) => (Number(x.debit) > 0 ? Number(x.debit) : Number(x.credit));
  const changeLie = (m) => {
    const autre = m.change_lie_id ? parId.get(m.change_lie_id) : null;
    if (!autre) return null;
    const dm = devises.get(m.compte_id);
    const da = devises.get(autre.compte_id);
    const [tnd, dev] = dm === "TND" && da !== "TND" ? [m, autre] : da === "TND" && dm !== "TND" ? [autre, m] : [null, null];
    const cours = tnd && dev && montantDe(dev) > 0 ? Math.round((montantDe(tnd) / montantDe(dev)) * 10000) / 10000 : null;
    return { id: autre.id, compteId: autre.compte_id, devise: da, montant: montantDe(autre), dateOp: jour(autre.date_op), coursReel: cours };
  };
  // Conversions : part de chaque encaissement en devise vendue par un change du même compte (et part déjà utilisée de chaque change).
  const { rows: conv } = await query(
    `select e.encaissement_id, e.change_id, e.montant
       from encaissement_changes e join mouvements_bancaires m on m.id = e.encaissement_id
      where m.societe_id = $1`,
    [societeId],
  );
  const conversionsDe = new Map();
  const utiliseDe = new Map();
  for (const x of conv) {
    const ch = parId.get(x.change_id);
    if (!ch) continue;
    const lie = changeLie(ch);
    if (!conversionsDe.has(x.encaissement_id)) conversionsDe.set(x.encaissement_id, []);
    conversionsDe.get(x.encaissement_id).push({ changeId: x.change_id, montant: Number(x.montant), dateOp: jour(ch.date_op), coursReel: lie?.coursReel ?? null });
    utiliseDe.set(x.change_id, Math.round(((utiliseDe.get(x.change_id) ?? 0) + Number(x.montant)) * 1000) / 1000);
  }
  const { rows: releves } = await query(
    `select r.compte_id, r.mois, r.solde_reel, r.note
       from releves_mensuels r join comptes_bancaires c on c.id = r.compte_id
      where c.societe_id = $1 order by r.mois`,
    [societeId],
  );
  const { rows: enCours } = await query(
    `select o.id, o.compte_id, o.mois, o.designation, o.debit, o.credit
       from operations_en_cours o join comptes_bancaires c on c.id = o.compte_id
      where c.societe_id = $1 order by o.mois, o.ordre, o.cree_le`,
    [societeId],
  );
  return {
    releves: releves.map((r) => ({ compteId: r.compte_id, mois: r.mois, soldeReel: r.solde_reel == null ? null : Number(r.solde_reel), note: r.note })),
    enCours: enCours.map((o) => ({ id: o.id, compteId: o.compte_id, mois: o.mois, designation: o.designation, debit: Number(o.debit), credit: Number(o.credit) })),
    comptes: comptes.map((c) => ({
      id: c.id,
      banque: c.banque,
      devise: c.devise,
      numero: c.numero,
      soldeDepart: Number(c.solde_depart),
      dateDepart: jour(c.date_depart),
      soldeReel: c.solde_reel == null ? null : Number(c.solde_reel),
      dateReel: jour(c.date_reel),
    })),
    mouvements: mouvements.map((m) => ({
      id: m.id,
      compteId: m.compte_id,
      dateOp: jour(m.date_op),
      dateValeur: jour(m.date_valeur),
      libelle: m.libelle,
      details: m.details,
      reference: m.reference,
      numPiece: m.num_piece,
      debit: Number(m.debit),
      credit: Number(m.credit),
      type: m.type,
      cours: m.cours == null ? null : Number(m.cours),
      changeLie: changeLie(m),
      coursReel: changeLie(m)?.coursReel ?? null,
      /** Part de l'encaissement déjà reliée à des règlements du suivi client devise, et ces règlements. */
      affecteClient: Number(m.affecte_client),
      reglementsClient: m.reglements_client ?? [],
      /** Encaissement en devise : les changes qui l'ont converti ; et, pour un change, la part déjà attribuée à des encaissements. */
      conversions: conversionsDe.get(m.id) ?? [],
      changeUtilise: utiliseDe.get(m.id) ?? 0,
      aRevoir: Boolean(m.a_revoir),
      note: m.note ?? "",
      reglementId: m.reglement_id ?? null,
      fournisseurCle: m.fournisseur_cle ?? null,
    })),
  };
}

banqueRouter.get("/", async (req, res) => {
  const societeId = req.query.societeId;
  if (!societeId) return res.status(400).json({ error: "societeId requis" });
  if (!canRead(req.session, societeId)) return res.status(403).json({ error: "Accès non autorisé" });
  res.json(await etat(societeId));
});

/** Cohérence entre le suivi bancaire, le suivi fournisseur et le suivi client devise : réservée au cabinet (elle reprend des données des trois modules). */
banqueRouter.get("/coherence", async (req, res) => {
  const societeId = req.query.societeId;
  if (!societeId) return res.status(400).json({ error: "societeId requis" });
  if (!canWrite(req.session, societeId)) return res.status(403).json({ error: "Accès non autorisé" });
  res.json({ alertes: await alertesCoherence(societeId) });
});

/**
 * Situation bancaire de toutes les sociétés visibles (page de choix de la société) : comptes et soldes, ce qu'il reste à rapprocher, les lignes à revoir et,
 * mois par mois, ce qui tombe juste, ce qui a un écart et ce dont le solde réel n'est pas saisi (même règle que le rapprochement mensuel d'un compte).
 * Calculée avec quelques requêtes groupées, jamais ligne par ligne.
 */
banqueRouter.get("/synthese", async (req, res) => {
  const { rows: tousComptes } = await query("select * from comptes_bancaires order by societe_id, ordre, cree_le");
  const comptes = tousComptes.filter((c) => canRead(req.session, c.societe_id));
  if (comptes.length === 0) return res.json([]);
  const ids = comptes.map((c) => c.id);
  const [totaux, parMois, releves, enCours] = await Promise.all([
    query(
      `select m.compte_id, count(*) as n, max(m.date_op) as dernier, coalesce(sum(m.debit), 0) as debit, coalesce(sum(m.credit), 0) as credit,
              count(*) filter (where m.a_revoir) as a_revoir,
              count(*) filter (where m.type = 'paiement_fournisseur' and m.debit > 0 and not exists (select 1 from fournisseur_reglements r where r.mouvement_bancaire_id = m.id)) as a_rapprocher
         from mouvements_bancaires m where m.compte_id = any($1::uuid[]) group by m.compte_id`,
      [ids],
    ),
    query(
      `select compte_id, to_char(date_op, 'YYYY-MM') as mois, coalesce(sum(debit), 0) as debit, coalesce(sum(credit), 0) as credit
         from mouvements_bancaires where compte_id = any($1::uuid[]) group by compte_id, to_char(date_op, 'YYYY-MM')`,
      [ids],
    ),
    query("select compte_id, mois, solde_reel from releves_mensuels where compte_id = any($1::uuid[])", [ids]),
    query("select distinct compte_id, mois from operations_en_cours where compte_id = any($1::uuid[])", [ids]),
  ]);
  const parSociete = new Map();
  for (const c of comptes) {
    const t = totaux.rows.find((x) => x.compte_id === c.id);
    const statuts = statutsMoisCompte(
      { soldeDepart: Number(c.solde_depart) },
      parMois.rows.filter((x) => x.compte_id === c.id).map((x) => ({ mois: x.mois, debit: Number(x.debit), credit: Number(x.credit) })),
      releves.rows.filter((x) => x.compte_id === c.id).map((x) => ({ mois: x.mois, soldeReel: x.solde_reel == null ? null : Number(x.solde_reel) })),
      enCours.rows.filter((x) => x.compte_id === c.id).map((x) => x.mois),
    );
    const s = parSociete.get(c.societe_id) ?? { societeId: c.societe_id, comptes: [], mouvements: 0, dernierMouvement: null, paiementsARapprocher: 0, aRevoir: 0, statuts: [] };
    s.comptes.push({ id: c.id, banque: c.banque, devise: c.devise, solde: r3(Number(c.solde_depart) + Number(t?.credit ?? 0) - Number(t?.debit ?? 0)) });
    s.mouvements += Number(t?.n ?? 0);
    const dernier = t?.dernier ? jour(t.dernier) : null;
    if (dernier && (!s.dernierMouvement || dernier > s.dernierMouvement)) s.dernierMouvement = dernier;
    s.paiementsARapprocher += Number(t?.a_rapprocher ?? 0);
    s.aRevoir += Number(t?.a_revoir ?? 0);
    for (const m of statuts) s.statuts.push({ ...m, devise: c.devise, banque: c.banque });
    parSociete.set(c.societe_id, s);
  }
  const ordreGravite = { ecart: 2, saisir: 1, ok: 0 };
  res.json(
    [...parSociete.values()].map(({ statuts, ...s }) => {
      // Les 12 mois de l'année de la dernière opération (à défaut, de l'année en cours) : le pire statut des comptes pour chaque mois.
      const annee = Number((s.dernierMouvement ?? new Date().toISOString()).slice(0, 4));
      const mois = Array.from({ length: 12 }, (_, i) => {
        const cle = `${annee}-${String(i + 1).padStart(2, "0")}`;
        const duMois = statuts.filter((x) => x.mois === cle);
        return duMois.length === 0 ? null : duMois.reduce((pire, x) => (ordreGravite[x.statut] > ordreGravite[pire] ? x.statut : pire), "ok");
      });
      const ecarts = statuts.filter((x) => x.statut === "ecart").map((x) => ({ mois: x.mois, devise: x.devise, banque: x.banque, ecart: x.ecart }));
      const aSaisir = statuts.filter((x) => x.statut === "saisir").map((x) => ({ mois: x.mois, devise: x.devise, banque: x.banque }));
      return { ...s, annee, mois, moisEnEcart: ecarts.length, moisASaisir: aSaisir.length, ecarts: ecarts.slice(-6), aSaisir: aSaisir.slice(-6) };
    }),
  );
});

const montant = z.coerce.number().min(0, "Montant invalide").default(0);
const dateOptionnelle = z.string().nullish();

const compteSchema = z.object({
  societeId: z.string().uuid(),
  banque: z.string().trim().min(1, "Banque requise"),
  devise: z.string().trim().min(1).default("TND").transform((d) => d.toUpperCase()),
  numero: z.string().default(""),
  soldeDepart: z.coerce.number().default(0),
  dateDepart: dateOptionnelle,
  soldeReel: z.coerce.number().nullish(),
  dateReel: dateOptionnelle,
});

banqueRouter.post("/comptes", async (req, res) => {
  const parsed = compteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Données invalides" });
  const v = parsed.data;
  if (!canWrite(req.session, v.societeId)) return res.status(403).json({ error: "Accès non autorisé" });
  await query(
    `insert into comptes_bancaires (societe_id, banque, devise, numero, solde_depart, date_depart, solde_reel, date_reel, ordre)
     values ($1,$2,$3,$4,$5,$6,$7,$8, (select coalesce(max(ordre), -1) + 1 from comptes_bancaires where societe_id = $1))`,
    [v.societeId, v.banque, v.devise, v.numero, v.soldeDepart, v.dateDepart || null, v.soldeReel ?? null, v.dateReel || null],
  );
  logAction(req.session.nom, "creation", "suivi bancaire", `Compte ${v.banque} ${v.devise}`);
  res.json(await etat(v.societeId));
});

banqueRouter.patch("/comptes/:id", async (req, res) => {
  const { rows } = await query("select societe_id from comptes_bancaires where id = $1", [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: "Compte introuvable" });
  const parsed = compteSchema.safeParse({ ...req.body, societeId: rows[0].societe_id });
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Données invalides" });
  const v = parsed.data;
  if (!canWrite(req.session, v.societeId)) return res.status(403).json({ error: "Accès non autorisé" });
  await query(
    `update comptes_bancaires set banque=$2, devise=$3, numero=$4, solde_depart=$5, date_depart=$6, solde_reel=$7, date_reel=$8 where id=$1`,
    [req.params.id, v.banque, v.devise, v.numero, v.soldeDepart, v.dateDepart || null, v.soldeReel ?? null, v.dateReel || null],
  );
  logAction(req.session.nom, "modification", "suivi bancaire", `Compte ${v.banque} ${v.devise}`);
  res.json(await etat(v.societeId));
});

banqueRouter.delete("/comptes/:id", async (req, res) => {
  const { rows } = await query("select societe_id, banque, devise from comptes_bancaires where id = $1", [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: "Compte introuvable" });
  if (!canWrite(req.session, rows[0].societe_id)) return res.status(403).json({ error: "Accès non autorisé" });
  await query("delete from comptes_bancaires where id = $1", [req.params.id]);
  logAction(req.session.nom, "suppression", "suivi bancaire", `Compte ${rows[0].banque} ${rows[0].devise}`);
  res.json(await etat(rows[0].societe_id));
});

const mouvementSchema = z
  .object({
    dateOp: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date de l'opération invalide"),
    dateValeur: dateOptionnelle,
    libelle: z.string().default(""),
    details: z.string().default(""),
    reference: z.string().default(""),
    numPiece: z.string().default(""),
    debit: montant,
    credit: montant,
    type: z.enum(TYPES).default("autre"),
    cours: z.coerce.number().positive().nullish(),
  })
  .refine((m) => !(m.debit > 0 && m.credit > 0), { message: "Un mouvement est soit un débit, soit un crédit" });

const SELECT_MOUVEMENT = "select societe_id, compte_id from mouvements_bancaires where id = $1";

banqueRouter.post("/comptes/:id/mouvements", async (req, res) => {
  const { rows } = await query("select societe_id from comptes_bancaires where id = $1", [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: "Compte introuvable" });
  const societeId = rows[0].societe_id;
  if (!canWrite(req.session, societeId)) return res.status(403).json({ error: "Accès non autorisé" });
  const parsed = mouvementSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Données invalides" });
  const v = parsed.data;
  await query(
    `insert into mouvements_bancaires (societe_id, compte_id, date_op, date_valeur, libelle, details, reference, num_piece, debit, credit, type, cours, ordre)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, (select coalesce(max(ordre), -1) + 1 from mouvements_bancaires where compte_id = $2))`,
    [societeId, req.params.id, v.dateOp, v.dateValeur || null, v.libelle, v.details, v.reference, v.numPiece, v.debit, v.credit, v.type, v.cours ?? null],
  );
  logAction(req.session.nom, "creation", "suivi bancaire", v.libelle || "Mouvement");
  res.json(await etat(societeId));
});

const moisSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Mois invalide");
const enCoursSchema = z.object({ designation: z.string().trim().min(1, "Désignation requise").max(300), debit: montant, credit: montant });
const importSchema = z.object({
  mouvements: z.array(mouvementSchema.and(z.object({ aRevoir: z.boolean().default(false), note: z.string().max(2000).default("") }))).min(1, "Aucun mouvement à importer").max(5000),
  /** Soldes réels de la banque par mois, lus dans le classeur (facultatif). */
  releves: z.array(z.object({ mois: moisSchema, soldeReel: z.coerce.number().nullable() })).max(60).default([]),
  /** Opérations en cours par mois, lues dans le classeur : elles remplacent celles du mois (facultatif). */
  enCours: z.array(enCoursSchema.extend({ mois: moisSchema })).max(2000).default([]),
});
const cle = (m) => [m.dateOp, m.libelle.trim().toLowerCase(), m.debit, m.credit].join("|");

/** Import d'un relevé : les mouvements déjà présents (même date, libellé et montant) ne sont pas recréés,
 * même si le même relevé est importé deux fois. */
banqueRouter.post("/comptes/:id/import", async (req, res) => {
  const { rows } = await query("select societe_id from comptes_bancaires where id = $1", [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: "Compte introuvable" });
  const societeId = rows[0].societe_id;
  if (!canWrite(req.session, societeId)) return res.status(403).json({ error: "Accès non autorisé" });
  const parsed = importSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Données invalides" });
  const bilan = await withTransaction(async (client) => {
    const { rows: existants } = await client.query(
      "select date_op, libelle, debit, credit from mouvements_bancaires where compte_id = $1",
      [req.params.id],
    );
    const deja = new Map();
    for (const e of existants) {
      const k = cle({ dateOp: jour(e.date_op), libelle: e.libelle, debit: Number(e.debit), credit: Number(e.credit) });
      deja.set(k, (deja.get(k) ?? 0) + 1);
    }
    let { rows: [{ prochain }] } = await client.query(
      "select coalesce(max(ordre), -1) + 1 as prochain from mouvements_bancaires where compte_id = $1",
      [req.params.id],
    );
    prochain = Number(prochain);
    let importes = 0;
    for (const m of parsed.data.mouvements) {
      const k = cle(m);
      if ((deja.get(k) ?? 0) > 0) {
        deja.set(k, deja.get(k) - 1);
        continue;
      }
      await client.query(
        `insert into mouvements_bancaires (societe_id, compte_id, date_op, date_valeur, libelle, details, reference, num_piece, debit, credit, type, cours, ordre, a_revoir, note)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [societeId, req.params.id, m.dateOp, m.dateValeur || null, m.libelle, m.details, m.reference, m.numPiece, m.debit, m.credit, m.type, m.cours ?? null, prochain++, m.aRevoir, m.note],
      );
      importes++;
    }
    // Soldes réels et opérations en cours des mois lus : posés d'un coup, un nouvel import remplace ceux du mois.
    for (const r of parsed.data.releves) {
      await client.query(
        `insert into releves_mensuels (compte_id, mois, solde_reel) values ($1,$2,$3)
         on conflict (compte_id, mois) do update set solde_reel = excluded.solde_reel`,
        [req.params.id, r.mois, r.soldeReel],
      );
    }
    for (const mois of new Set(parsed.data.enCours.map((o) => o.mois))) {
      await client.query("delete from operations_en_cours where compte_id = $1 and mois = $2", [req.params.id, mois]);
      let ordre = 0;
      for (const o of parsed.data.enCours.filter((x) => x.mois === mois)) {
        await client.query(
          "insert into operations_en_cours (compte_id, mois, designation, debit, credit, ordre) values ($1,$2,$3,$4,$5,$6)",
          [req.params.id, mois, o.designation, o.debit, o.credit, ordre++],
        );
      }
    }
    return { importes, ignores: parsed.data.mouvements.length - importes };
  });
  logAction(req.session.nom, "creation", "suivi bancaire", `Import de ${bilan.importes} mouvement(s)`);
  res.json({ ...(await etat(societeId)), ...bilan });
});

/** Compte et société d'un compte bancaire, après contrôle de l'écriture (répond lui-même en cas d'erreur, et renvoie null). */
async function compteEcriture(req, res) {
  const { rows } = await query("select societe_id from comptes_bancaires where id = $1", [req.params.id]);
  if (!rows[0]) return void res.status(404).json({ error: "Compte introuvable" });
  if (!canWrite(req.session, rows[0].societe_id)) return void res.status(403).json({ error: "Accès non autorisé" });
  return rows[0].societe_id;
}

/** Solde réel de la banque en fin de mois (celui du relevé) et note du mois : sert à rapprocher le solde calculé. */
banqueRouter.put("/comptes/:id/mois/:mois", async (req, res) => {
  const societeId = await compteEcriture(req, res);
  if (!societeId) return;
  const mois = moisSchema.safeParse(req.params.mois);
  const corps = z.object({ soldeReel: z.coerce.number().nullable(), note: z.string().max(2000).default("") }).safeParse(req.body);
  if (!mois.success || !corps.success) return res.status(400).json({ error: mois.error?.issues[0]?.message || corps.error?.issues[0]?.message || "Données invalides" });
  await query(
    `insert into releves_mensuels (compte_id, mois, solde_reel, note) values ($1,$2,$3,$4)
     on conflict (compte_id, mois) do update set solde_reel = excluded.solde_reel, note = excluded.note`,
    [req.params.id, mois.data, corps.data.soldeReel, corps.data.note],
  );
  logAction(req.session.nom, "modification", "suivi bancaire", `Solde réel ${mois.data}`);
  res.json(await etat(societeId));
});

/** Opération en cours d'un mois : écrite chez la société, pas encore passée en banque. */
banqueRouter.post("/comptes/:id/mois/:mois/en-cours", async (req, res) => {
  const societeId = await compteEcriture(req, res);
  if (!societeId) return;
  const mois = moisSchema.safeParse(req.params.mois);
  const corps = enCoursSchema.refine((o) => !(o.debit > 0 && o.credit > 0), { message: "Une opération est soit un débit, soit un crédit" }).safeParse(req.body);
  if (!mois.success || !corps.success) return res.status(400).json({ error: mois.error?.issues[0]?.message || corps.error?.issues[0]?.message || "Données invalides" });
  await query(
    `insert into operations_en_cours (compte_id, mois, designation, debit, credit, ordre)
     values ($1,$2,$3,$4,$5, (select coalesce(max(ordre), -1) + 1 from operations_en_cours where compte_id = $1 and mois = $2))`,
    [req.params.id, mois.data, corps.data.designation, corps.data.debit, corps.data.credit],
  );
  logAction(req.session.nom, "creation", "suivi bancaire", `Opération en cours ${mois.data} : ${corps.data.designation}`);
  res.json(await etat(societeId));
});

banqueRouter.patch("/en-cours/:id", async (req, res) => {
  const { rows } = await query("select o.id, c.societe_id from operations_en_cours o join comptes_bancaires c on c.id = o.compte_id where o.id = $1", [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: "Opération introuvable" });
  if (!canWrite(req.session, rows[0].societe_id)) return res.status(403).json({ error: "Accès non autorisé" });
  const corps = enCoursSchema.refine((o) => !(o.debit > 0 && o.credit > 0), { message: "Une opération est soit un débit, soit un crédit" }).safeParse(req.body);
  if (!corps.success) return res.status(400).json({ error: corps.error.issues[0]?.message || "Données invalides" });
  await query("update operations_en_cours set designation=$2, debit=$3, credit=$4 where id=$1", [req.params.id, corps.data.designation, corps.data.debit, corps.data.credit]);
  logAction(req.session.nom, "modification", "suivi bancaire", `Opération en cours : ${corps.data.designation}`);
  res.json(await etat(rows[0].societe_id));
});

banqueRouter.delete("/en-cours/:id", async (req, res) => {
  const { rows } = await query("select o.designation, c.societe_id from operations_en_cours o join comptes_bancaires c on c.id = o.compte_id where o.id = $1", [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: "Opération introuvable" });
  if (!canWrite(req.session, rows[0].societe_id)) return res.status(403).json({ error: "Accès non autorisé" });
  await query("delete from operations_en_cours where id = $1", [req.params.id]);
  logAction(req.session.nom, "suppression", "suivi bancaire", `Opération en cours : ${rows[0].designation}`);
  res.json(await etat(rows[0].societe_id));
});

/** Marque ou démarque une ligne « à revoir » (le jaune du classeur du cabinet), avec une note facultative. */
banqueRouter.patch("/mouvements/:id/revoir", async (req, res) => {
  const { rows } = await query(SELECT_MOUVEMENT, [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: "Mouvement introuvable" });
  if (!canWrite(req.session, rows[0].societe_id)) return res.status(403).json({ error: "Accès non autorisé" });
  const corps = z.object({ aRevoir: z.boolean(), note: z.string().max(2000).optional() }).safeParse(req.body);
  if (!corps.success) return res.status(400).json({ error: "Données invalides" });
  await query("update mouvements_bancaires set a_revoir=$2, note = coalesce($3, note) where id=$1", [req.params.id, corps.data.aRevoir, corps.data.note ?? null]);
  res.json(await etat(rows[0].societe_id));
});

banqueRouter.patch("/mouvements/:id", async (req, res) => {
  const { rows } = await query(SELECT_MOUVEMENT, [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: "Mouvement introuvable" });
  if (!canWrite(req.session, rows[0].societe_id)) return res.status(403).json({ error: "Accès non autorisé" });
  const parsed = mouvementSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Données invalides" });
  const v = parsed.data;
  await query(
    `update mouvements_bancaires set date_op=$2, date_valeur=$3, libelle=$4, details=$5, reference=$6, num_piece=$7, debit=$8, credit=$9, type=$10, cours=$11 where id=$1`,
    [req.params.id, v.dateOp, v.dateValeur || null, v.libelle, v.details, v.reference, v.numPiece, v.debit, v.credit, v.type, v.cours ?? null],
  );
  logAction(req.session.nom, "modification", "suivi bancaire", v.libelle || "Mouvement");
  res.json(await etat(rows[0].societe_id));
});

banqueRouter.delete("/mouvements/:id", async (req, res) => {
  const { rows } = await query("select societe_id, libelle from mouvements_bancaires where id = $1", [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: "Mouvement introuvable" });
  if (!canWrite(req.session, rows[0].societe_id)) return res.status(403).json({ error: "Accès non autorisé" });
  await query("delete from mouvements_bancaires where id = $1", [req.params.id]);
  logAction(req.session.nom, "suppression", "suivi bancaire", rows[0].libelle || "Mouvement");
  res.json(await etat(rows[0].societe_id));
});

/** Deux lignes sont-elles les deux jambes d'un même change ? Renvoie le message du refus, sinon null. */
function refusChange(a, b) {
  if (!a || !b) return "Ligne introuvable";
  if (a.id === b.id) return "Une ligne ne peut pas être reliée à elle-même";
  if (a.societe_id !== b.societe_id) return "Les deux lignes ne sont pas de la même société";
  if (a.compte_id === b.compte_id) return "Les deux jambes d'un change sont sur deux comptes différents";
  if (a.devise === b.devise) return "Les deux comptes ont la même devise : ce n'est pas un change";
  const sorties = Number(a.debit) > 0 && Number(b.credit) > 0;
  const entrees = Number(a.credit) > 0 && Number(b.debit) > 0;
  if (!sorties && !entrees) return "Une jambe fait sortir de l'argent d'un compte et l'autre en fait entrer sur l'autre compte";
  for (const [x, y] of [[a, b], [b, a]]) if (x.change_lie_id && x.change_lie_id !== y.id) return "Une des deux lignes est déjà reliée à un autre change";
  return null;
}

const parLigne = (ids) =>
  query(
    `select m.*, c.devise from mouvements_bancaires m join comptes_bancaires c on c.id = m.compte_id where m.id = any($1::uuid[])`,
    [ids],
  );

/** Relie des paires de lignes comme jambes d'un même change (toutes ou aucune) : chaque ligne pointe vers l'autre et devient de type « change ». */
banqueRouter.post("/changes-lies", async (req, res) => {
  const parsed = z.object({ paires: z.array(z.object({ a: z.string().uuid(), b: z.string().uuid() })).min(1, "Aucune paire").max(200) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Données invalides" });
  const ids = [...new Set(parsed.data.paires.flatMap((p) => [p.a, p.b]))];
  const { rows } = await parLigne(ids);
  const parId = new Map(rows.map((r) => [r.id, r]));
  const societes = new Set(rows.map((r) => r.societe_id));
  if (societes.size !== 1 || rows.length !== ids.length) return res.status(400).json({ error: "Lignes introuvables ou de sociétés différentes" });
  const societeId = rows[0].societe_id;
  if (!canWrite(req.session, societeId)) return res.status(403).json({ error: "Accès non autorisé" });
  const utilisees = new Set();
  for (const p of parsed.data.paires) {
    const refus = refusChange(parId.get(p.a), parId.get(p.b));
    if (refus) return res.status(400).json({ error: refus });
    if (utilisees.has(p.a) || utilisees.has(p.b)) return res.status(400).json({ error: "Une ligne figure dans deux paires" });
    utilisees.add(p.a);
    utilisees.add(p.b);
  }
  await withTransaction(async (client) => {
    for (const p of parsed.data.paires) {
      await client.query("update mouvements_bancaires set change_lie_id = $2, type = 'change' where id = $1", [p.a, p.b]);
      await client.query("update mouvements_bancaires set change_lie_id = $2, type = 'change' where id = $1", [p.b, p.a]);
    }
  });
  logAction(req.session.nom, "modification", "suivi bancaire", `${parsed.data.paires.length} change(s) relié(s)`);
  res.json(await etat(societeId));
});

/**
 * Relie un encaissement en devise aux changes qui l'ont converti en dinars (remplace la liste). Contrôles : encaissement client d'un compte en devise ;
 * chaque change est une sortie du même compte ; la somme attribuée ne dépasse ni l'encaissement, ni ce qui reste de chaque change (autres encaissements compris).
 */
banqueRouter.post("/mouvements/:id/conversions", async (req, res) => {
  const parsed = z
    .object({ conversions: z.array(z.object({ changeId: z.string().uuid(), montant: z.number().positive() })).max(100) })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Données invalides" });
  if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) return res.status(404).json({ error: "Mouvement introuvable" });
  const { rows } = await parLigne([req.params.id]);
  const enc = rows[0];
  if (!enc) return res.status(404).json({ error: "Mouvement introuvable" });
  if (!canWrite(req.session, enc.societe_id)) return res.status(403).json({ error: "Accès non autorisé" });
  if (!(Number(enc.credit) > 0) || enc.type !== "encaissement_client") return res.status(400).json({ error: "Seul un encaissement client peut être relié à un change" });
  if (enc.devise === "TND") return res.status(400).json({ error: "Un encaissement en dinars n'a pas besoin de change" });
  const ids = parsed.data.conversions.map((x) => x.changeId);
  if (new Set(ids).size !== ids.length) return res.status(400).json({ error: "Un change figure deux fois" });
  const changes = ids.length ? (await parLigne(ids)).rows : [];
  const parId = new Map(changes.map((x) => [x.id, x]));
  let total = 0;
  for (const x of parsed.data.conversions) {
    const ch = parId.get(x.changeId);
    if (!ch) return res.status(400).json({ error: "Change introuvable" });
    if (ch.societe_id !== enc.societe_id) return res.status(400).json({ error: "Ce change n'est pas de la même société" });
    if (ch.compte_id !== enc.compte_id || !(Number(ch.debit) > 0) || ch.type !== "change")
      return res.status(400).json({ error: "Le change doit être une sortie de change du compte qui a reçu l'encaissement" });
    const { rows: autres } = await query("select coalesce(sum(montant), 0) as s from encaissement_changes where change_id = $1 and encaissement_id <> $2", [ch.id, enc.id]);
    if (x.montant > Number(ch.debit) - Number(autres[0].s) + 0.0005) return res.status(400).json({ error: "Le montant dépasse ce qui reste de ce change" });
    total += x.montant;
  }
  if (total > Number(enc.credit) + 0.0005) return res.status(400).json({ error: "Le total dépasse le montant de l'encaissement" });
  await withTransaction(async (client) => {
    await client.query("delete from encaissement_changes where encaissement_id = $1", [enc.id]);
    for (const x of parsed.data.conversions) await client.query("insert into encaissement_changes (encaissement_id, change_id, montant) values ($1,$2,$3)", [enc.id, x.changeId, x.montant]);
  });
  logAction(req.session.nom, "modification", "suivi bancaire", `Encaissement relié à ${parsed.data.conversions.length} change(s)`);
  res.json(await etat(enc.societe_id));
});

/** Délie les deux jambes d'un change (les lignes restent de type « change »). */
banqueRouter.delete("/mouvements/:id/change-lie", async (req, res) => {
  const { rows } = await query("select societe_id from mouvements_bancaires where id = $1", [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: "Mouvement introuvable" });
  if (!canWrite(req.session, rows[0].societe_id)) return res.status(403).json({ error: "Accès non autorisé" });
  await query("update mouvements_bancaires set change_lie_id = null where id = $1 or change_lie_id = $1", [req.params.id]);
  logAction(req.session.nom, "modification", "suivi bancaire", "Change délié");
  res.json(await etat(rows[0].societe_id));
});
