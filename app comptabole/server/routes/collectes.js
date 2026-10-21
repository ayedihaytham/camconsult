import { Router } from "express";
import { z } from "zod";
import { query, withTransaction } from "../db.js";
import { requireAuth, requireAdmin, canSeeSociete, porteeSocietes } from "../auth.js";
import { logAction } from "../journal.js";
import {
  notify,
  notifyMany,
  notifKey,
  concernedBySociete,
} from "../notifications.js";
import {
  collecteDto,
  collecteSectionDto,
  collecteLigneDto,
  collecteNoteDto,
  collecteFichierDto,
  collecteDemandePieceDto,
} from "../mappers.js";
import { sendRelance } from "../relances.js";
import { pushToUser } from "../sse.js";
import { acteurSession, nomsActeurs } from "../acteurs.js";

export const collectesRouter = Router();
collectesRouter.use(requireAuth);

/** Signal temps réel : « cette collecte a changé » (jamais son contenu : le client refait la lecture habituelle). Envoyé à tous ceux qui la
 * voient — admin, responsables des collaborateurs, collaborateurs de la société, employés de la société — sauf à l'auteur du changement, dont
 * l'écran est déjà à jour. Les autres écrans ouverts sur la collecte se mettent alors à jour sans rechargement de page. */
async function diffuserCollecte(collecteId, session) {
  const c = (await query("select societe_id from collectes where id = $1", [collecteId])).rows[0];
  if (!c) return;
  const [concernes, responsables] = await Promise.all([
    concernedBySociete(c.societe_id, { includeAdmin: true }),
    query("select id from employes where role = 'responsable_collaborateurs' and statut = 'actif'"),
  ]);
  const auteur = notifKey(session);
  const cibles = new Set([...concernes, ...responsables.rows.map((r) => r.id)]);
  cibles.delete(auteur);
  for (const cle of cibles) pushToUser(cle, "collecte", { id: collecteId });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Toute modification réussie d'une collecte (lignes, tableau transmis/validé/renvoyé, notes, pièces, récap, statut) est signalée aux autres écrans.
collectesRouter.use("/:id", (req, res, next) => {
  if (req.method !== "GET" && UUID.test(req.params.id)) {
    res.on("finish", () => {
      if (res.statusCode < 400) diffuserCollecte(req.params.id, req.session).catch(() => {});
    });
  }
  next();
});

// Clés d'onglets valides — miroir de src/lib/collecte/tabs.ts
const TAB_KEYS = new Set([
  "souche_cheques",
  "etat_cheques_emis",
  "bordereaux_remise_cheques",
  "virements_recus",
  "virements_emis",
  "virements_salaire",
  "bordereaux_traites_recues",
  "traites_emises",
  "traites_escomptees",
  "chiffre_affaires",
  "detail_achats",
  "etat_caisse",
  "etat_clients",
  "etat_fournisseurs",
  "etat_swift",
]);
const cleanOnglets = (arr) =>
  [...new Set((Array.isArray(arr) ? arr : []).filter((k) => TAB_KEYS.has(k)))];

const STATUTS = ["brouillon", "transmis", "valide", "a_corriger", "archive"];

// Période désormais facultative — jamais un texte vide dans un message
// affiché au client ou dans le journal.
const periodeLabel = (p) => (p && p.trim()) || "période non précisée";

const createSchema = z.object({
  societeId: z.string().uuid(),
  periode: z.string().default(""),
  onglets: z.array(z.string()).default([]),
  devise: z.string().default("TND"),
  echeance: z.string().nullish(),
  relanceCadenceJours: z.number().int().min(1).max(30).default(3),
  envoiParLignes: z.boolean().default(false),
});

async function loadCollecte(id) {
  const c = (await query("select * from collectes where id = $1", [id])).rows[0];
  if (!c) return null;
  const [sections, lignes, notes, fichiers, demandesPieces] = await Promise.all([
    query("select * from collecte_sections where collecte_id = $1", [id]),
    query(
      "select * from collecte_lignes where collecte_id = $1 order by onglet, ordre",
      [id],
    ),
    query(
      "select * from collecte_notes where collecte_id = $1 order by cree_le",
      [id],
    ),
    query(
      "select * from collecte_fichiers where collecte_id = $1 order by cree_le desc",
      [id],
    ),
    query("select * from collecte_demandes_pieces where collecte_id = $1 order by cree_le", [id]),
  ]);
  // Noms des auteurs des notes (cabinet ou client) ; une note ancienne sans auteur enregistré reste « Cabinet » / « Client ».
  const noms = await nomsActeurs(notes.rows.map((n) => n.auteur_ref));
  return {
    ...collecteDto(c),
    sections: sections.rows.map(collecteSectionDto),
    lignes: lignes.rows.map(collecteLigneDto),
    notes: notes.rows.map((n) => collecteNoteDto({ ...n, auteur_nom: noms.get(String(n.auteur_ref)) })),
    fichiers: fichiers.rows.map(collecteFichierDto),
    demandesPieces: demandesPieces.rows.map(collecteDemandePieceDto),
  };
}

/** Cabinet (admin ou collaborateur du périmètre de cette société) — jamais
 * le client. L'équipe qui a accès à une collecte doit pouvoir y agir comme
 * le cabinet : ajouter des notes, valider ou renvoyer les tableaux — pas
 * seulement consulter. Le récap reste réservé à l'administrateur. */
function isCabinet(session, societeId) {
  if (session.role === "admin") return true;
  if (session.poste === "responsable_collaborateurs") return true;
  return (
    session.poste === "collaborateur" &&
    (session.societeIds || []).includes(societeId)
  );
}

/** Gestion "admin" d'une collecte (statuts, période/devise/onglets/échéance,
 * relance) : réservée à l'admin ET au responsable des collaborateurs — pas
 * à un simple collaborateur, qui garde les droits plus limités d'`isCabinet`
 * (circuit des tableaux, notes). */
function isCabinetManager(session) {
  return session.role === "admin" || session.poste === "responsable_collaborateurs";
}

/** Récap (demandes au client) : l'administrateur et le responsable des collaborateurs. */
function requireCabinetManager(req, res, next) {
  if (!isCabinetManager(req.session))
    return res.status(403).json({ error: "Réservé à l'administrateur ou au responsable des collaborateurs" });
  next();
}

/** Qui peut écrire une note : le cabinet (admin/collaborateur) ou le client
 * de la société. */
function canPostNote(session, societeId) {
  if (isCabinet(session, societeId)) return true;
  return (
    session.poste === "societe_employe" &&
    (session.societeIds || []).includes(societeId)
  );
}
// Un collaborateur reste "cabinet" pour l'affichage (regroupé avec admin,
// jamais confondu avec le client) — voir OngletNotes.tsx (auteur === "admin" -> "Cabinet").
const noteAuteur = (session) =>
  session.poste === "societe_employe" ? "client" : "admin";

/** Admin, responsable des collaborateurs, collaborateur en charge, ou employé
 * de la société : sur les sociétés du périmètre. */
function canEdit(session, societeId) {
  return canSeeSociete(session, societeId);
}

const SECTION_OUVERTES = ["brouillon", "a_corriger"];
/** Tableaux tenus par le cabinet seul (miroir de TABLEAUX_CABINET_SEUL, src/lib/collecte/tabs.ts) : le client les consulte seulement.
 * Aucun pour l'instant : l'état des chèques émis est transmis au client par le Récap, comme les autres tableaux. */
const CABINET_SEUL = [];
const LIBELLES_ONGLETS = {
  souche_cheques: "Souche de chèques",
  etat_cheques_emis: "État des chèques émis",
  bordereaux_remise_cheques: "Bordereaux remise de chèques",
  virements_recus: "Virements reçus",
  virements_emis: "Virements émis",
  virements_salaire: "Virement multiple (salaires)",
  bordereaux_traites_recues: "Bordereaux traites reçues",
  traites_emises: "État des traites émises",
  traites_escomptees: "Traites escomptées",
  chiffre_affaires: "Chiffre d'affaires",
  detail_achats: "Détail des achats",
  etat_caisse: "État de caisse",
  etat_clients: "État clients",
  etat_fournisseurs: "État fournisseurs",
  etat_swift: "État SWIFT",
};
const libelleOnglet = (o) => LIBELLES_ONGLETS[o] ?? o;

/** Statut d'un tableau : celui de sa ligne, à défaut (collecte antérieure au circuit par tableau) celui de la collecte. */
const sectionStatutDe = (collecte, row) => {
  const statut = row?.statut ?? (["transmis", "valide", "archive", "a_corriger"].includes(collecte.statut) ? collecte.statut : "brouillon");
  // Un récap en attente est une demande faite au client : le tableau est rouvert (à corriger), validé ou transmis auparavant.
  return row?.recap_statut === "envoye" && (statut === "valide" || statut === "transmis") ? "a_corriger" : statut;
};

/** Collecte verrouillée en écriture pour cette session, tous onglets confondus (pièces jointes générales) : le cabinet
 * n'est bloqué que par l'archivage ; le client, tant qu'aucun de ses tableaux n'est ouvert (à remplir ou à corriger). */
async function isLocked(session, collecte) {
  if (collecte.statut === "archive") return true;
  if (session.poste !== "societe_employe") return false;
  const rows = (
    await query("select statut, recap_statut from collecte_sections where collecte_id=$1 and onglet <> all($2::text[])", [collecte.id, CABINET_SEUL])
  ).rows;
  return !rows.some((r) => SECTION_OUVERTES.includes(sectionStatutDe(collecte, r)) || r.recap_statut === "envoye");
}

/** Un tableau précis est-il modifiable par cette session ? Chaque tableau a son propre statut : transmettre, valider ou
 * renvoyer l'un ne verrouille ni ne déverrouille les autres. Archivé : lecture seule pour tout le monde. Le client ne
 * modifie que ses tableaux « à remplir » ou « à corriger » (ou en récap demandé par le cabinet). */
async function isOngletLocked(session, collecte, onglet) {
  if (collecte.statut === "archive") return true;
  if (session.poste === "societe_employe" && CABINET_SEUL.includes(onglet)) return true;
  const row = (
    await query("select statut, recap_statut from collecte_sections where collecte_id=$1 and onglet=$2", [collecte.id, onglet])
  ).rows[0];
  const statut = sectionStatutDe(collecte, row);
  if (statut === "archive") return true;
  if (session.poste !== "societe_employe") return false;
  if (SECTION_OUVERTES.includes(statut)) return false;
  return (row?.recap_statut ?? "none") !== "envoye";
}

/** Recalcule le statut de la collecte d'après ses tableaux : tous archivés -> archivée (elle passe d'elle-même dans les archives) ;
 * tous validés/archivés -> validée ; au moins un transmis ->
 * transmise (à examiner) ; au moins un à corriger -> à corriger ; sinon brouillon. Une collecte archivée n'est pas touchée. */
async function recalculerStatut(client, collecteId) {
  const c = (await client.query("select statut from collectes where id=$1 for update", [collecteId])).rows[0];
  if (!c || c.statut === "archive") return c?.statut;
  const statuts = (
    await client.query("select statut from collecte_sections where collecte_id=$1 and onglet <> all($2::text[])", [collecteId, CABINET_SEUL])
  ).rows.map(
    (r) => r.statut ?? "brouillon",
  );
  if (statuts.length === 0) return c.statut;
  const next = statuts.every((x) => x === "archive")
    ? "archive"
    : statuts.every((x) => x === "valide" || x === "archive")
    ? "valide"
    : statuts.some((x) => x === "transmis")
      ? "transmis"
      : statuts.some((x) => x === "a_corriger")
        ? "a_corriger"
        : "brouillon";
  if (next !== c.statut) {
    await client.query(
      `update collectes set statut=$1, maj_le=now(),
         transmis_le = case when $1='transmis' and transmis_le is null then now() else transmis_le end,
         valide_le   = case when $1='valide' then now() else valide_le end
       where id=$2`,
      [next, collecteId],
    );
  }
  return next;
}

const estClient = (session) => session.poste === "societe_employe";

// ── Liste ─────────────────────────────────────────
collectesRouter.get("/", async (req, res) => {
  const params = [];
  const clauses = [];
  if (req.query.societeId) {
    params.push(req.query.societeId);
    clauses.push(`societe_id = $${params.length}`);
  }
  // Portée de la session appliquée en SQL (le filtre par ligne plus bas reste une seconde barrière).
  const portee = porteeSocietes(req.session);
  if (portee) {
    params.push(portee);
    clauses.push(`societe_id = any($${params.length}::uuid[])`);
  }
  const where = clauses.length ? `where ${clauses.join(" and ")}` : "";
  const rows = (
    await query(`select * from collectes ${where} order by cree_le desc`, params)
  ).rows.filter((r) => canSeeSociete(req.session, r.societe_id));
  // Avancement par tableau, en une seule requête : tableaux à examiner par le cabinet et tableaux déjà validés.
  const comptes = new Map(
    (
      await query(
        `select collecte_id, count(*) filter (where statut = 'transmis')::int as transmis,
                count(*) filter (where statut in ('valide','archive'))::int as valides,
                count(*) filter (where statut = 'archive')::int as archives,
                count(*) filter (where recap_statut <> 'none' or statut <> 'brouillon')::int as demandes,
                count(*) filter (where (recap_statut <> 'none' or statut <> 'brouillon') and onglet <> 'souche_cheques')::int as demandes_client
           from collecte_sections where collecte_id = any($1::uuid[]) and onglet <> all($2::text[]) group by collecte_id`,
        [rows.map((r) => r.id), CABINET_SEUL],
      )
    ).rows.map((r) => [r.collecte_id, r]),
  );
  // Un compte de société cliente ne voit une collecte que si le cabinet lui a demandé (Récap) ou renvoyé au moins un tableau : une collecte
  // créée mais pas encore envoyée, ou vide, n'existe pas pour lui.
  // Une pièce demandée par le cabinet suffit aussi à la faire exister pour lui (il doit pouvoir y répondre).
  const avecPieces = new Set(
    (await query("select distinct collecte_id from collecte_demandes_pieces where collecte_id = any($1::uuid[])", [rows.map((r) => r.id)])).rows.map((r) => r.collecte_id),
  );
  const visibles = estClient(req.session) ? rows.filter((r) => (comptes.get(r.id)?.demandes_client ?? 0) > 0 || avecPieces.has(r.id)) : rows;
  res.json(
    visibles.map((r) => ({
      ...collecteDto(r),
      tableauxTransmis: comptes.get(r.id)?.transmis ?? 0,
      tableauxValides: comptes.get(r.id)?.valides ?? 0,
      tableauxArchives: comptes.get(r.id)?.archives ?? 0,
      tableauxDemandes: comptes.get(r.id)?.demandes ?? 0,
    })),
  );
});

// ── Souche de chèques de la société ───────────────
// La souche est remplie par le client dans son propre module (hors de la collecte) ; le cabinet la consulte seulement. Chaque
// collecte (période) qui demande ce tableau a sa souche : seules ses lignes et son circuit sont renvoyés ici.
collectesRouter.get("/souche", async (req, res) => {
  const societeId = String(req.query.societeId || "");
  if (!societeId) return res.status(400).json({ error: "societeId requis" });
  if (!canSeeSociete(req.session, societeId)) return res.status(403).json({ error: "Société hors périmètre" });
  const collectes = (
    await query("select * from collectes where societe_id = $1 and onglets @> '[\"souche_cheques\"]'::jsonb order by cree_le desc", [societeId])
  ).rows;
  if (collectes.length === 0) return res.json([]);
  const ids = collectes.map((c) => c.id);
  const [sections, lignes] = await Promise.all([
    query("select * from collecte_sections where collecte_id = any($1::uuid[]) and onglet = 'souche_cheques'", [ids]),
    query("select * from collecte_lignes where collecte_id = any($1::uuid[]) and onglet = 'souche_cheques' order by ordre", [ids]),
  ]);
  res.json(
    collectes.map((c) => {
      const row = sections.rows.find((r) => r.collecte_id === c.id);
      return {
        collecteId: c.id,
        periode: c.periode,
        devise: c.devise,
        statut: sectionStatutDe(c, row),
        motifRenvoi: row?.motif_renvoi ?? "",
        lignes: lignes.rows.filter((l) => l.collecte_id === c.id).map(collecteLigneDto),
      };
    }),
  );
});

// ── Détail ────────────────────────────────────────
collectesRouter.get("/:id", async (req, res) => {
  const full = await loadCollecte(req.params.id);
  if (!full) return res.status(404).json({ error: "Collecte introuvable" });
  if (!canSeeSociete(req.session, full.societeId))
    return res.status(403).json({ error: "Collecte hors périmètre" });
  if (estClient(req.session)) {
    const demandes = (
      await query(
        `select count(*)::int as n from collecte_sections
          where collecte_id = $1 and onglet <> all($2::text[]) and onglet <> 'souche_cheques' and (recap_statut <> 'none' or statut <> 'brouillon')`,
        [req.params.id, CABINET_SEUL],
      )
    ).rows[0].n;
    const pieces = (await query("select count(*)::int as n from collecte_demandes_pieces where collecte_id = $1", [req.params.id])).rows[0].n;
    if (demandes === 0 && pieces === 0) return res.status(404).json({ error: "Collecte introuvable" });
  }
  res.json(full);
});

// ── Création (cabinet : admin, responsable des collaborateurs, collaborateur
// sur ses sociétés) — la création notifie le client, c'est l'envoi. ────────
collectesRouter.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0].message });
  const v = parsed.data;
  if (!isCabinet(req.session, v.societeId))
    return res.status(403).json({ error: "Société hors de votre périmètre" });
  const soc = (
    await query("select raison_sociale from societes where id = $1", [v.societeId])
  ).rows[0];
  if (!soc) return res.status(400).json({ error: "Société introuvable" });
  const onglets = cleanOnglets(v.onglets);

  const created = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `insert into collectes (societe_id, periode, onglets, devise, echeance, relance_cadence_jours, envoi_par_lignes)
       values ($1,$2,$3::jsonb,$4,$5,$6,$7) returning *`,
      [
        v.societeId, v.periode.trim(), JSON.stringify(onglets), v.devise || "TND",
        v.echeance || null, v.relanceCadenceJours || 3, v.envoiParLignes,
      ],
    );
    for (const o of onglets) {
      await client.query(
        "insert into collecte_sections (collecte_id, onglet) values ($1,$2) on conflict do nothing",
        [rows[0].id, o],
      );
    }
    return rows[0];
  });

  logAction(
    req.session.nom,
    "creation",
    "collecte",
    `${soc.raison_sociale} — ${periodeLabel(v.periode)}`,
    created.id,
  );
  const targets = (
    await concernedBySociete(v.societeId, {
      includeAdmin: req.session.role !== "admin",
    })
  ).filter((k) => k !== notifKey(req.session));
  // Le responsable de société n'est prévenu qu'au moment où le cabinet lui envoie un tableau (Récap) : avant, la collecte n'existe pas pour lui.
  const clients = new Set(
    (await query("select id from employes where role = 'societe_employe' and societe_id = $1", [v.societeId])).rows.map((r) => r.id),
  );
  notifyMany(
    targets.filter((k) => !clients.has(k)),
    "collecte",
    `Nouvelle collecte à remplir : ${periodeLabel(v.periode)}`,
    `Société ${soc.raison_sociale} — ${onglets.length} tableau(x) demandé(s)${
      req.session.role === "admin" ? "" : ` — par ${req.session.nom}`
    }`,
    `/collectes/${created.id}`,
  );
  res.status(201).json(await loadCollecte(created.id));
});

// ── Mise à jour ───────────────────────────────────
collectesRouter.patch("/:id", async (req, res) => {
  const c = (await query("select * from collectes where id = $1", [req.params.id]))
    .rows[0];
  if (!c) return res.status(404).json({ error: "Collecte introuvable" });
  const isAdmin = isCabinetManager(req.session);
  const b = req.body ?? {};

  const soc = (
    await query("select raison_sociale from societes where id = $1", [c.societe_id])
  ).rows[0];
  const socNom = soc?.raison_sociale ?? "";

  if (!isAdmin) {
    // client / collaborateur : peut seulement transmettre la collecte au cabinet
    if (!canEdit(req.session, c.societe_id))
      return res.status(403).json({ error: "Collecte hors périmètre" });
    if (b.statut !== "transmis" || Object.keys(b).length !== 1)
      return res
        .status(403)
        .json({ error: "Vous pouvez seulement transmettre la collecte" });
    const aTransmettre = await withTransaction(async (client) => {
      const { rowCount } = await client.query(
        `update collecte_sections set statut='transmis', transmis_le=now(),
           recap_statut = case when recap_statut = 'envoye' then 'repondu' else recap_statut end
         where collecte_id=$1 and onglet <> all($3::text[]) and ((statut = any($2::text[]) and (recap_statut = 'envoye' or statut = 'a_corriger')) or recap_statut = 'envoye')`,
        [req.params.id, SECTION_OUVERTES, CABINET_SEUL],
      );
      if (rowCount === 0) return false;
      await recalculerStatut(client, req.params.id);
      return true;
    });
    if (!aTransmettre) return res.status(400).json({ error: "Collecte déjà transmise" });
    logAction(req.session.nom, "modification", "collecte", `Transmise — ${socNom} ${periodeLabel(c.periode)}`, c.id);
    notify(
      "admin",
      "collecte",
      `Collecte transmise : ${socNom} — ${periodeLabel(c.periode)}`,
      `Par ${req.session.nom}`,
      `/collectes/${req.params.id}`,
    );
    const collabs = (
      await concernedBySociete(c.societe_id, { includeAdmin: false })
    ).filter((k) => k !== notifKey(req.session));
    notifyMany(
      collabs,
      "collecte",
      `Collecte transmise : ${socNom} — ${periodeLabel(c.periode)}`,
      "",
      `/collectes/${req.params.id}`,
    );
    return res.json(await loadCollecte(req.params.id));
  }

  // Admin ou responsable des collaborateurs
  const echeanceChanged = b.echeance !== undefined && (b.echeance || null) !== c.echeance;
  const next = {
    periode: typeof b.periode === "string" ? b.periode.trim() : c.periode,
    devise: typeof b.devise === "string" && b.devise ? b.devise : c.devise,
    echeance: b.echeance === undefined ? c.echeance : b.echeance || null,
    relanceCadenceJours:
      typeof b.relanceCadenceJours === "number" && b.relanceCadenceJours >= 1 && b.relanceCadenceJours <= 30
        ? b.relanceCadenceJours
        : c.relance_cadence_jours,
    onglets: b.onglets === undefined ? c.onglets : cleanOnglets(b.onglets),
    statut: STATUTS.includes(b.statut) ? b.statut : c.statut,
    envoiParLignes: typeof b.envoiParLignes === "boolean" ? b.envoiParLignes : Boolean(c.envoi_par_lignes),
  };

  await withTransaction(async (client) => {
    await client.query(
      `update collectes set periode=$1, devise=$2, onglets=$3::jsonb, statut=$4, echeance=$6,
         relance_cadence_jours=$7, envoi_par_lignes=$9,
         rappel_avant_envoye = case when $8 then false else rappel_avant_envoye end,
         transmis_le = case when $4='transmis' and transmis_le is null then now() else transmis_le end,
         valide_le   = case when $4='valide' then now() else valide_le end,
         maj_le = now()
       where id=$5`,
      [
        next.periode, next.devise, JSON.stringify(next.onglets), next.statut, req.params.id,
        next.echeance, next.relanceCadenceJours, echeanceChanged, next.envoiParLignes,
      ],
    );
    // Un changement de statut de la collecte s'applique à ses tableaux (le circuit se joue tableau par tableau).
    if (next.statut !== c.statut) {
      const sync = {
        valide: ["valide", c.statut === "archive" ? null : "archive", null],
        archive: ["archive", null, null],
        a_corriger: ["a_corriger", null, ["transmis", "valide"]],
        transmis: ["transmis", null, SECTION_OUVERTES],
      }[next.statut];
      if (sync) {
        const [vers, sauf, depuis] = sync;
        await client.query(
          `update collecte_sections set statut=$2,
             recap_statut = case when $2 in ('valide','archive') then 'none' else recap_statut end,
             valide_le = case when $2='valide' then now() else valide_le end,
             transmis_le = case when $2='transmis' then now() else transmis_le end
           where collecte_id=$1
             and ($3::text[] is null or statut = any($3::text[]))
             and ($4::text is null or statut <> $4)`,
          [req.params.id, vers, depuis, sauf],
        );
      }
    }
    // Synchronise les sections avec la liste d'onglets
    const current = new Set(
      (await client.query("select onglet from collecte_sections where collecte_id=$1", [req.params.id])).rows.map((r) => r.onglet),
    );
    for (const o of next.onglets) {
      if (!current.has(o))
        await client.query(
          "insert into collecte_sections (collecte_id, onglet) values ($1,$2) on conflict do nothing",
          [req.params.id, o],
        );
    }
    const wanted = new Set(next.onglets);
    for (const o of current) {
      if (!wanted.has(o)) {
        await client.query(
          "delete from collecte_sections where collecte_id=$1 and onglet=$2",
          [req.params.id, o],
        );
        await client.query(
          "delete from collecte_lignes where collecte_id=$1 and onglet=$2",
          [req.params.id, o],
        );
      }
    }
    // Un tableau ajouté ou retiré change l'état d'ensemble (ex. tout était validé, un nouveau tableau reste à remplir).
    if (b.onglets !== undefined && next.statut === c.statut) await recalculerStatut(client, req.params.id);
  });

  logAction(req.session.nom, "modification", "collecte", `${socNom} — ${periodeLabel(next.periode)}`, req.params.id);
  if (next.statut !== c.statut) {
    const targets = (
      await concernedBySociete(c.societe_id, { includeAdmin: false })
    ).filter((k) => k !== notifKey(req.session));
    const msg =
      next.statut === "valide"
        ? `Collecte validée : ${socNom} — ${periodeLabel(next.periode)}`
        : next.statut === "a_corriger"
          ? `Collecte à corriger : ${socNom} — ${periodeLabel(next.periode)}`
          : `Collecte mise à jour : ${socNom} — ${periodeLabel(next.periode)}`;
    notifyMany(targets, "collecte", msg, `Par ${req.session.nom}`, `/collectes/${req.params.id}`);
  }
  res.json(await loadCollecte(req.params.id));
});

// ── Suppression (administrateur et responsable des collaborateurs) ──
collectesRouter.delete("/:id", requireCabinetManager, async (req, res) => {
  try {
    const { rows } = await query(
      "delete from collectes where id = $1 returning periode, societe_id",
      [req.params.id],
    );
    if (!rows[0]) return res.status(404).json({ error: "Collecte introuvable" });
    logAction(req.session.nom, "suppression", "collecte", periodeLabel(rows[0].periode), req.params.id);
    res.json({ ok: true });
  } catch (err) {
    // Sans ce catch, une requête en échec (ex. contrainte imprévue) reste
    // sans réponse en Express 4 — la suppression semble juste ne rien faire
    // côté client au lieu d'afficher une erreur claire.
    console.error("[collectes] suppression échouée:", err.message);
    res.status(500).json({ error: "Suppression impossible — réessayez." });
  }
});

// ── Lignes d'un onglet (remplacement complet) ─────
const lignesSchema = z.object({
  lignes: z
    .array(
      z.object({
        /** Identifiant d'une ligne déjà enregistrée : permet de garder son état « envoyée au cabinet » et de reconnaître les lignes figées. */
        id: z.string().uuid().optional(),
        data: z.record(z.any()).default({}),
        ordre: z.number().int().optional(),
        /** Société, collecte en envoi par lignes : cette ligne, complétée, part au cabinet à l'enregistrement. */
        envoyee: z.boolean().optional(),
      }),
    )
    .default([]),
});

collectesRouter.put("/:id/lignes/:onglet", async (req, res) => {
  const c = (await query("select * from collectes where id = $1", [req.params.id]))
    .rows[0];
  if (!c) return res.status(404).json({ error: "Collecte introuvable" });
  const onglet = req.params.onglet;
  if (!(Array.isArray(c.onglets) ? c.onglets : []).includes(onglet))
    return res.status(400).json({ error: "Onglet non demandé dans cette collecte" });
  if (!canEdit(req.session, c.societe_id))
    return res.status(403).json({ error: "Modification non autorisée" });
  // La souche est remplie par la société ; le cabinet la consulte et complète « État des chèques émis ».
  if (onglet === "souche_cheques" && !estClient(req.session))
    return res.status(403).json({ error: "La souche est remplie par la société : complétez « État des chèques émis »" });
  if (await isOngletLocked(req.session, c, onglet))
    return res.status(400).json({ error: "Ce tableau est verrouillé" });

  const parsed = lignesSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0].message });
  // Le client complète et ajoute des lignes, il ne supprime pas celles déjà enregistrées (celles du cabinet comprises).
  if (req.session.poste === "societe_employe") {
    const { n } = (
      await query("select count(*)::int as n from collecte_lignes where collecte_id=$1 and onglet=$2", [req.params.id, onglet])
    ).rows[0];
    if (parsed.data.lignes.length < n)
      return res.status(400).json({ error: "Les lignes déjà enregistrées ne peuvent pas être supprimées" });
  }

  // Lignes déjà enregistrées : leurs identifiants et leur état « envoyée au cabinet » sont conservés d'un enregistrement à l'autre.
  const existantes = (
    await query("select id, data, envoyee_le from collecte_lignes where collecte_id=$1 and onglet=$2", [req.params.id, onglet])
  ).rows;
  const parId = new Map(existantes.map((r) => [r.id, r]));
  const parSociete = estClient(req.session);
  // Une ligne envoyée au cabinet est figée pour la société : elle doit revenir telle quelle (même identifiant, mêmes cases).
  // Pour la modifier, la société la « reprend » (route dédiée) ou le cabinet la renvoie.
  if (parSociete) {
    for (const f of existantes.filter((r) => r.envoyee_le)) {
      const revenue = parsed.data.lignes.find((l) => l.id === f.id);
      if (!revenue || JSON.stringify(revenue.data ?? {}) !== JSON.stringify(f.data ?? {}))
        return res.status(400).json({ error: "Une ligne déjà envoyée au cabinet ne peut plus être modifiée. Rechargez la page, ou reprenez la ligne." });
    }
  }
  const envoiPossible = parSociete && Boolean(c.envoi_par_lignes);
  // Ne renvoie que les lignes de CET onglet, pas toute la collecte : un
  // « Enregistrer » ne touche qu'un seul tableau, mais rechargeait jusque-là
  // systématiquement tous les onglets, toutes les notes et toutes les
  // pièces jointes de la collecte — coûteux et de plus en plus lent au fil
  // des tableaux remplis, repéré en usage réel (client trouvant
  // « Enregistrer » lent).
  const savedLignes = await withTransaction(async (client) => {
    await client.query(
      "delete from collecte_lignes where collecte_id=$1 and onglet=$2",
      [req.params.id, onglet],
    );
    const inserted = [];
    let i = 0;
    for (const l of parsed.data.lignes) {
      const ancienne = l.id ? parId.get(l.id) : undefined;
      const envoyeeLe = ancienne?.envoyee_le ?? null;
      const donnees = parSociete && envoyeeLe ? ancienne.data : l.data ?? {};
      const { rows } = await client.query(
        `insert into collecte_lignes (id, collecte_id, onglet, ordre, data, envoyee_le)
         values (coalesce($1::uuid, gen_random_uuid()), $2,$3,$4,$5::jsonb, case when $6::timestamptz is not null then $6::timestamptz when $7 then now() else null end) returning *`,
        [ancienne ? l.id : null, req.params.id, onglet, l.ordre ?? i, JSON.stringify(donnees), envoyeeLe, envoiPossible && l.envoyee === true],
      );
      inserted.push(rows[0]);
      i++;
    }
    await client.query("update collectes set maj_le=now() where id=$1", [
      req.params.id,
    ]);
    return inserted;
  });
  logAction(
    req.session.nom,
    "modification",
    "collecte",
    `Tableau « ${onglet} » modifié (${parsed.data.lignes.length} ligne(s)) — ${periodeLabel(c.periode)}`,
    req.params.id,
  );
  const nouvellesEnvoyees = savedLignes.filter((r) => r.envoyee_le && !parId.get(r.id)?.envoyee_le).length;
  if (nouvellesEnvoyees > 0)
    logAction(req.session.nom, "modification", "collecte", `${nouvellesEnvoyees} ligne(s) envoyée(s) au cabinet — tableau « ${onglet} » — ${periodeLabel(c.periode)}`, req.params.id);
  res.json({ onglet, lignes: savedLignes.map(collecteLigneDto) });
});

/** La société reprend une ligne qu'elle avait envoyée au cabinet (ligne complétée par erreur) : elle revient dans son tableau, modifiable. */
collectesRouter.post("/:id/lignes/:onglet/:ligneId/reprendre", async (req, res) => {
  if (!UUID.test(req.params.ligneId)) return res.status(400).json({ error: "Ligne invalide" });
  const c = (await query("select * from collectes where id = $1", [req.params.id])).rows[0];
  if (!c) return res.status(404).json({ error: "Collecte introuvable" });
  if (!estClient(req.session) || !canEdit(req.session, c.societe_id))
    return res.status(403).json({ error: "Modification non autorisée" });
  if (await isOngletLocked(req.session, c, req.params.onglet))
    return res.status(400).json({ error: "Ce tableau est verrouillé : la ligne ne peut plus être reprise" });
  const { rows } = await query(
    "update collecte_lignes set envoyee_le = null where id=$1 and collecte_id=$2 and onglet=$3 and envoyee_le is not null returning *",
    [req.params.ligneId, req.params.id, req.params.onglet],
  );
  if (!rows[0]) return res.status(404).json({ error: "Cette ligne n'a pas été envoyée au cabinet" });
  await query("update collectes set maj_le=now() where id=$1", [req.params.id]);
  logAction(req.session.nom, "modification", "collecte", `Ligne reprise par la société — tableau « ${req.params.onglet} » — ${periodeLabel(c.periode)}`, req.params.id);
  res.json({ onglet: req.params.onglet, ligne: collecteLigneDto(rows[0]) });
});

// ── Suivi de checklist d'un onglet : commentaire, reçu, date de suivi, total ──────────
// Seuls les champs présents dans le corps sont modifiés.
collectesRouter.patch("/:id/sections/:onglet", async (req, res) => {
  const c = (await query("select * from collectes where id = $1", [req.params.id]))
    .rows[0];
  if (!c) return res.status(404).json({ error: "Collecte introuvable" });
  if (!canEdit(req.session, c.societe_id))
    return res.status(403).json({ error: "Modification non autorisée" });
  if (await isOngletLocked(req.session, c, req.params.onglet))
    return res.status(400).json({ error: "Ce tableau est verrouillé" });
  const body = req.body ?? {};
  const existing = (
    await query("select * from collecte_sections where collecte_id=$1 and onglet=$2", [req.params.id, req.params.onglet])
  ).rows[0];

  const commentaire = "commentaire" in body ? String(body.commentaire ?? "").slice(0, 1000) : (existing?.commentaire ?? "");
  const recuManuel = typeof body.recuManuel === "boolean" ? body.recuManuel : Boolean(existing?.recu_manuel);
  let dateSuivi = existing?.date_suivi ?? null;
  if ("dateSuivi" in body) {
    if (body.dateSuivi === null || body.dateSuivi === "") dateSuivi = null;
    else if (/^\d{4}-\d{2}-\d{2}$/.test(String(body.dateSuivi))) dateSuivi = body.dateSuivi;
    else return res.status(400).json({ error: "Date de suivi invalide" });
  }
  let totalSaisi = existing?.total_saisi ?? null;
  if ("totalSaisi" in body) {
    if (body.totalSaisi === null || body.totalSaisi === "") totalSaisi = null;
    else if (Number.isFinite(Number(body.totalSaisi)) && Number(body.totalSaisi) >= 0) totalSaisi = Number(body.totalSaisi);
    else return res.status(400).json({ error: "Total invalide" });
  }
  const { rows } = await query(
    `insert into collecte_sections (collecte_id, onglet, commentaire, recu_manuel, date_suivi, total_saisi)
     values ($1,$2,$3,$4,$5,$6)
     on conflict (collecte_id, onglet) do update set
       commentaire = excluded.commentaire, recu_manuel = excluded.recu_manuel,
       date_suivi = excluded.date_suivi, total_saisi = excluded.total_saisi
     returning *`,
    [req.params.id, req.params.onglet, commentaire, recuManuel, dateSuivi, totalSaisi],
  );
  logAction(
    req.session.nom,
    "modification",
    "collecte",
    `Suivi « ${req.params.onglet} » modifié — ${periodeLabel(c.periode)}`,
    req.params.id,
  );
  res.json({ section: collecteSectionDto(rows[0]) });
});

// « Tout marquer comme reçu » : un seul appel pour plusieurs onglets de la collecte.
collectesRouter.post("/:id/sections-recu", async (req, res) => {
  const c = (await query("select * from collectes where id = $1", [req.params.id]))
    .rows[0];
  if (!c) return res.status(404).json({ error: "Collecte introuvable" });
  if (!canEdit(req.session, c.societe_id))
    return res.status(403).json({ error: "Modification non autorisée" });
  const recu = req.body?.recu !== false;
  const demandes = Array.isArray(req.body?.onglets) ? req.body.onglets.map(String) : [];
  const onglets = demandes.filter((o) => (c.onglets ?? []).includes(o));
  if (onglets.length === 0) return res.status(400).json({ error: "Aucun tableau à marquer" });
  for (const onglet of onglets) {
    if (await isOngletLocked(req.session, c, onglet))
      return res.status(400).json({ error: "Ce tableau est verrouillé" });
  }
  await query(
    `insert into collecte_sections (collecte_id, onglet, recu_manuel)
     select $1, o, $3 from unnest($2::text[]) as o
     on conflict (collecte_id, onglet) do update set recu_manuel = excluded.recu_manuel`,
    [req.params.id, onglets, recu],
  );
  logAction(
    req.session.nom,
    "modification",
    "collecte",
    `${onglets.length} pièce(s) ${recu ? "marquée(s) reçue(s)" : "remise(s) en attente"} — ${periodeLabel(c.periode)}`,
    req.params.id,
  );
  const sections = (await query("select * from collecte_sections where collecte_id = $1", [req.params.id])).rows;
  res.json({ sections: sections.map(collecteSectionDto) });
});

// ── Récap d'anomalies ─────────────────────────────

/** Note libre sur un onglet (ou générale si onglet vide). */
collectesRouter.post("/:id/notes", async (req, res) => {
  const c = (await query("select * from collectes where id = $1", [req.params.id]))
    .rows[0];
  if (!c) return res.status(404).json({ error: "Collecte introuvable" });
  if (!canPostNote(req.session, c.societe_id))
    return res.status(403).json({ error: "Ajout de note non autorisé" });
  const onglet = String(req.body?.onglet ?? "");
  const texte = String(req.body?.texte ?? "").trim().slice(0, 2000);
  if (!texte) return res.status(400).json({ error: "Note vide" });
  await query(
    `insert into collecte_notes (collecte_id, onglet, kind, auteur, texte, auteur_ref)
     values ($1,$2,'note',$3,$4,$5)`,
    [req.params.id, onglet, noteAuteur(req.session), texte, acteurSession(req.session)],
  );
  logAction(
    req.session.nom,
    "creation",
    "collecte",
    `Note ajoutée${onglet ? ` (« ${onglet} »)` : ""} — ${periodeLabel(c.periode)} : ${texte.slice(0, 80)}`,
    req.params.id,
  );

  // Une note n'avait aucun effet côté destinataire — ni notification, ni
  // pastille — sauf à retomber par hasard sur cette collecte plus tard.
  const soc = (
    await query("select raison_sociale from societes where id = $1", [c.societe_id])
  ).rows[0];
  const titre = `Note${onglet ? ` (« ${onglet} »)` : ""} : ${soc?.raison_sociale ?? ""} — ${periodeLabel(c.periode)}`;
  if (noteAuteur(req.session) === "admin") {
    const targets = (
      await concernedBySociete(c.societe_id, { includeAdmin: false })
    ).filter((k) => k !== notifKey(req.session));
    notifyMany(targets, "collecte", titre, texte.slice(0, 120), `/collectes/${req.params.id}`);
  } else {
    notify("admin", "collecte", titre, texte.slice(0, 120), `/collectes/${req.params.id}`);
  }

  res.status(201).json(await loadCollecte(req.params.id));
});

/**
 * L'admin ouvre la complétion d'UN tableau précis : le client pourra
 * remplir les cases importantes vides de CE tableau (détectées EN DIRECT
 * côté client, pas figées ici) — indépendant des autres tableaux, jamais
 * un envoi global pour toute la collecte.
 */
collectesRouter.post("/:id/sections/:onglet/recap/send", requireCabinetManager, async (req, res) => {
  const ctx = await chargerSection(req, res);
  if (!ctx) return;
  const { c, onglet, statut, socNom } = ctx;
  if (statut === "archive")
    return res.status(400).json({ error: "Tableau archivé : désarchivez-le d'abord" });
  if (CABINET_SEUL.includes(onglet))
    return res.status(400).json({ error: "Ce tableau est tenu par le cabinet" });
  const count = Number(req.body?.count) || 0;

  await query(
    `insert into collecte_sections (collecte_id, onglet, recap_statut)
     values ($1,$2,'envoye')
     on conflict (collecte_id, onglet) do update set recap_statut = 'envoye',
       statut = case when collecte_sections.statut in ('valide','transmis') then 'a_corriger' else collecte_sections.statut end`,
    [req.params.id, onglet],
  );
  await withTransaction((client) => recalculerStatut(client, req.params.id));

  logAction(req.session.nom, "modification", "collecte", `Récap « ${onglet} » envoyé — ${socNom} ${periodeLabel(c.periode)}`, req.params.id);
  const targets = (
    await concernedBySociete(c.societe_id, { includeAdmin: false })
  ).filter((k) => k !== notifKey(req.session));
  notifyMany(
    targets,
    "collecte",
    `Récap à compléter : ${socNom} — ${periodeLabel(c.periode)}`,
    `« ${onglet} » — ${count} case(s) à remplir`,
    `/collectes/${req.params.id}`,
  );
  res.json(await loadCollecte(req.params.id));
});

/** Le client renvoie au cabinet le récap complété — clôt d'un coup tous les
 * tableaux actuellement en attente (le client transmet tout ce qu'il a
 * rempli en une fois, même si le cabinet les avait envoyés séparément). */
collectesRouter.post("/:id/recap/submit", async (req, res) => {
  const c = (await query("select * from collectes where id = $1", [req.params.id]))
    .rows[0];
  if (!c) return res.status(404).json({ error: "Collecte introuvable" });
  if (req.session.poste !== "societe_employe" || !canEdit(req.session, c.societe_id))
    return res.status(403).json({ error: "Réservé au client de la société" });
  const { rowCount } = await query(
    "update collecte_sections set recap_statut = 'repondu' where collecte_id = $1 and recap_statut = 'envoye'",
    [req.params.id],
  );
  if (rowCount === 0) return res.status(400).json({ error: "Aucun récap en attente" });
  await query("update collectes set maj_le = now() where id = $1", [req.params.id]);
  const soc = (
    await query("select raison_sociale from societes where id = $1", [c.societe_id])
  ).rows[0];
  logAction(req.session.nom, "modification", "collecte", `Récap complété par le client — ${periodeLabel(c.periode)}`, req.params.id);
  notify(
    "admin",
    "collecte",
    `Récap complété : ${soc?.raison_sociale ?? ""} — ${periodeLabel(c.periode)}`,
    `Par ${req.session.nom}`,
    `/collectes/${req.params.id}`,
  );
  res.json(await loadCollecte(req.params.id));
});

/** L'administrateur clôt le récap d'UN tableau précis
 * (retour à l'état normal). */
collectesRouter.post("/:id/sections/:onglet/recap/close", requireCabinetManager, async (req, res) => {
  const ctx = await chargerSection(req, res);
  if (!ctx) return;
  const { c, onglet, statut } = ctx;
  if (statut === "archive")
    return res.status(400).json({ error: "Tableau archivé : désarchivez-le d'abord" });
  await query(
    "update collecte_sections set recap_statut = 'none' where collecte_id = $1 and onglet = $2",
    [req.params.id, onglet],
  );
  logAction(
    req.session.nom,
    "modification",
    "collecte",
    `Récap « ${req.params.onglet} » clôturé — ${periodeLabel(c.periode)}`,
    req.params.id,
  );
  res.json(await loadCollecte(req.params.id));
});

// ── Circuit d'un tableau : transmettre, valider, renvoyer, archiver ───────────────────────
/** Charge la collecte et le tableau visés ; répond lui-même en cas d'erreur (renvoie null). */
async function chargerSection(req, res, { accepterArchivee = false } = {}) {
  const c = (await query("select * from collectes where id = $1", [req.params.id])).rows[0];
  if (!c) {
    res.status(404).json({ error: "Collecte introuvable" });
    return null;
  }
  const onglet = req.params.onglet;
  if (!(Array.isArray(c.onglets) ? c.onglets : []).includes(onglet)) {
    res.status(400).json({ error: "Onglet non demandé dans cette collecte" });
    return null;
  }
  if (c.statut === "archive" && !accepterArchivee) {
    res.status(400).json({ error: "Collecte archivée : désarchivez-la d'abord" });
    return null;
  }
  const row = (
    await query("select * from collecte_sections where collecte_id=$1 and onglet=$2", [c.id, onglet])
  ).rows[0];
  const soc = (await query("select raison_sociale from societes where id = $1", [c.societe_id])).rows[0];
  return { c, onglet, statut: sectionStatutDe(c, row), socNom: soc?.raison_sociale ?? "" };
}

/** Passe un tableau d'un statut à un autre (sous réserve de `depuis`), recalcule la collecte, journalise et renvoie la collecte. */
async function changerSection(req, res, ctx, { depuis, vers, motif = "", journal }) {
  const { c, onglet, statut } = ctx;
  if (!depuis.includes(statut)) return res.status(400).json({ error: "Action impossible dans l'état actuel de ce tableau" });
  await withTransaction(async (client) => {
    await client.query(
      `insert into collecte_sections (collecte_id, onglet, statut) values ($1,$2,$3)
       on conflict (collecte_id, onglet) do update set statut = excluded.statut,
         transmis_le = case when excluded.statut='transmis' then now() else collecte_sections.transmis_le end,
         valide_le   = case when excluded.statut='valide' then now() else collecte_sections.valide_le end,
         recap_statut = case when excluded.statut in ('valide','archive') then 'none'
                             when excluded.statut = 'transmis' and collecte_sections.recap_statut = 'envoye' then 'repondu'
                             else collecte_sections.recap_statut end,
         motif_renvoi = case when excluded.statut='a_corriger' then $4 when excluded.statut in ('valide','transmis') then '' else collecte_sections.motif_renvoi end`,
      [c.id, onglet, vers, motif],
    );
    if (vers === "a_corriger") {
      await client.query(
        `insert into collecte_notes (collecte_id, onglet, kind, auteur, texte, auteur_ref) values ($1,$2,'note','admin',$3,$4)`,
        [c.id, onglet, `Renvoyé pour correction : ${motif}`, acteurSession(req.session)],
      );
    }
    await recalculerStatut(client, c.id);
  });
  logAction(req.session.nom, "modification", "collecte", `${journal} « ${libelleOnglet(onglet)} » — ${ctx.socNom} ${periodeLabel(c.periode)}`, c.id);
  return res.json(await loadCollecte(c.id));
}

/** Le client transmet UN tableau au cabinet, même incomplet : il est alors verrouillé côté client jusqu'à la décision du cabinet. */
collectesRouter.post("/:id/sections/:onglet/transmettre", async (req, res) => {
  const ctx = await chargerSection(req, res);
  if (!ctx) return;
  if (req.session.poste !== "societe_employe" || !canEdit(req.session, ctx.c.societe_id))
    return res.status(403).json({ error: "Réservé au client de la société" });
  if (CABINET_SEUL.includes(ctx.onglet)) return res.status(400).json({ error: "Ce tableau est tenu par le cabinet" });
  if (!SECTION_OUVERTES.includes(ctx.statut)) return res.status(400).json({ error: "Ce tableau est déjà transmis" });
  const incomplet = req.body?.incomplet === true;
  await changerSection(req, res, ctx, { depuis: SECTION_OUVERTES, vers: "transmis", journal: incomplet ? "Transmis (incomplet)" : "Transmis" });
  if (res.statusCode >= 400) return;
  const titre = `Tableau transmis : ${ctx.socNom} — ${periodeLabel(ctx.c.periode)}`;
  const detail = `« ${libelleOnglet(ctx.onglet)} »${incomplet ? " — incomplet" : ""} · par ${req.session.nom}`;
  notify("admin", "collecte", titre, detail, `/collectes/${ctx.c.id}`);
  const collabs = (await concernedBySociete(ctx.c.societe_id, { includeAdmin: false })).filter(
    (k) => k !== notifKey(req.session),
  );
  notifyMany(collabs, "collecte", titre, detail, `/collectes/${ctx.c.id}`);
});

/** Le cabinet valide un tableau transmis. */
collectesRouter.post("/:id/sections/:onglet/valider", async (req, res) => {
  const ctx = await chargerSection(req, res);
  if (!ctx) return;
  if (!isCabinet(req.session, ctx.c.societe_id)) return res.status(403).json({ error: "Réservé au cabinet" });
  await changerSection(req, res, ctx, { depuis: ["transmis"], vers: "valide", journal: "Validé" });
  if (res.statusCode >= 400) return;
  const cibles = (await concernedBySociete(ctx.c.societe_id, { includeAdmin: req.session.role !== "admin" })).filter(
    (k) => k !== notifKey(req.session),
  );
  notifyMany(cibles, "collecte", `Tableau validé : ${ctx.socNom} — ${periodeLabel(ctx.c.periode)}`, `« ${libelleOnglet(ctx.onglet)} » · par ${req.session.nom}`, `/collectes/${ctx.c.id}`);
});

/** Le cabinet renvoie un tableau (transmis ou validé) au client pour correction ou ajout de lignes, avec un motif. */
collectesRouter.post("/:id/sections/:onglet/renvoyer", async (req, res) => {
  const ctx = await chargerSection(req, res);
  if (!ctx) return;
  if (!isCabinet(req.session, ctx.c.societe_id)) return res.status(403).json({ error: "Réservé au cabinet" });
  const motif = String(req.body?.motif ?? "").trim().slice(0, 1000);
  if (!motif) return res.status(400).json({ error: "Indiquez au client ce qu'il doit corriger ou compléter" });
  await changerSection(req, res, ctx, { depuis: ["transmis", "valide"], vers: "a_corriger", motif, journal: "Renvoyé pour correction" });
  if (res.statusCode >= 400) return;
  const cibles = (await concernedBySociete(ctx.c.societe_id, { includeAdmin: req.session.role !== "admin" })).filter(
    (k) => k !== notifKey(req.session),
  );
  notifyMany(cibles, "collecte", `Tableau à corriger : ${ctx.socNom} — ${periodeLabel(ctx.c.periode)}`, `« ${libelleOnglet(ctx.onglet)} » — ${motif.slice(0, 100)}`, `/collectes/${ctx.c.id}`);
});

/** Archive un tableau validé (admin ou responsable) : lecture seule pour tout le monde jusqu'au désarchivage. */
collectesRouter.post("/:id/sections/:onglet/archiver", async (req, res) => {
  const ctx = await chargerSection(req, res);
  if (!ctx) return;
  if (!isCabinetManager(req.session)) return res.status(403).json({ error: "Réservé à l'administrateur ou au responsable des collaborateurs" });
  await changerSection(req, res, ctx, { depuis: ["valide"], vers: "archive", journal: "Archivé" });
});

collectesRouter.post("/:id/sections/:onglet/desarchiver", async (req, res) => {
  // Une collecte archivée d'elle-même (tous ses tableaux archivés) accepte qu'on en désarchive un seul : elle redevient validée.
  const ctx = await chargerSection(req, res, { accepterArchivee: true });
  if (!ctx) return;
  if (!isCabinetManager(req.session)) return res.status(403).json({ error: "Réservé à l'administrateur ou au responsable des collaborateurs" });
  if (ctx.c.statut === "archive") {
    await query("update collectes set statut = 'valide', maj_le = now() where id = $1", [ctx.c.id]);
    ctx.c.statut = "valide";
  }
  await changerSection(req, res, ctx, { depuis: ["archive"], vers: "valide", journal: "Désarchivé" });
});

// ── Historique (journal filtré sur cette collecte) ────
collectesRouter.get("/:id/journal", async (req, res) => {
  const c = (await query("select * from collectes where id = $1", [req.params.id]))
    .rows[0];
  if (!c) return res.status(404).json({ error: "Collecte introuvable" });
  if (!canSeeSociete(req.session, c.societe_id))
    return res.status(403).json({ error: "Collecte hors périmètre" });
  const { rows } = await query(
    "select * from journal where entity = 'collecte' and entity_id = $1 order by at desc",
    [req.params.id],
  );
  res.json(
    rows.map((r) => ({
      id: r.id,
      at: r.at,
      actor: r.actor,
      action: r.action,
      label: r.label,
    })),
  );
});

// ── Relance manuelle (admin, responsable des collaborateurs) ──────────────
collectesRouter.post("/:id/relance", async (req, res) => {
  if (!isCabinetManager(req.session))
    return res.status(403).json({ error: "Accès réservé à l'administrateur ou au responsable des collaborateurs" });
  const row = (
    await query(
      `select c.id, c.societe_id, c.periode, c.echeance, c.statut,
              s.raison_sociale, s.email as societe_email
       from collectes c
       join societes s on s.id = c.societe_id
       where c.id = $1`,
      [req.params.id],
    )
  ).rows[0];
  if (!row) return res.status(404).json({ error: "Collecte introuvable" });
  // Garde-fou : une relance n'a de sens que si le client n'a pas encore
  // transmis (constaté : l'endpoint acceptait n'importe quel statut, y
  // compris une collecte déjà validée ou archivée).
  if (!["brouillon", "a_corriger"].includes(row.statut))
    return res.status(400).json({ error: "Rien à relancer — la collecte n'est pas en attente du client" });
  await sendRelance(row);
  res.json({ ok: true });
});

// ── Pièces jointes ─────────────────────────────────
const fichierSchema = z.object({
  onglet: z.string().default(""),
  nom: z.string().min(1),
  format: z.string().default(""),
  taille: z.string().default(""),
  dataUrl: z.string().min(10),
});

collectesRouter.post("/:id/fichiers", async (req, res) => {
  const c = (await query("select * from collectes where id = $1", [req.params.id]))
    .rows[0];
  if (!c) return res.status(404).json({ error: "Collecte introuvable" });
  if (!canEdit(req.session, c.societe_id))
    return res.status(403).json({ error: "Dépôt non autorisé" });
  const parsed = fichierSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0].message });
  const v = parsed.data;
  const verrouille = v.onglet && (c.onglets ?? []).includes(v.onglet)
    ? await isOngletLocked(req.session, c, v.onglet)
    : await isLocked(req.session, c);
  if (verrouille) return res.status(400).json({ error: v.onglet ? "Ce tableau est verrouillé" : "Collecte verrouillée" });
  await query(
    `insert into collecte_fichiers (collecte_id, onglet, nom, format, taille, data_url, depose_par)
     values ($1,$2,$3,$4,$5,$6,$7)`,
    [req.params.id, v.onglet, v.nom, v.format, v.taille, v.dataUrl, req.session.nom],
  );
  logAction(req.session.nom, "creation", "collecte", `Pièce jointe « ${v.nom} » — ${periodeLabel(c.periode)}`, req.params.id);
  res.status(201).json(await loadCollecte(req.params.id));
});

// ── Pièces demandées au client ─────────────────────
// Le cabinet demande une pièce par une simple note (sans pièce jointe) ; le client est prévenu, lit la note et répond en
// ajoutant le document (même si ses tableaux sont déjà transmis : c'est une demande explicite du cabinet).
collectesRouter.post("/:id/demandes-pieces", async (req, res) => {
  const c = (await query("select * from collectes where id = $1", [req.params.id])).rows[0];
  if (!c) return res.status(404).json({ error: "Collecte introuvable" });
  if (!isCabinet(req.session, c.societe_id)) return res.status(403).json({ error: "Demande non autorisée" });
  if (c.statut === "archive") return res.status(400).json({ error: "Collecte archivée" });
  const texte = String(req.body?.texte ?? "").trim().slice(0, 2000);
  if (!texte) return res.status(400).json({ error: "Précisez la pièce demandée" });
  const categorie = req.body?.categorie === "fournisseur" ? "fournisseur" : "client";
  const tiers = String(req.body?.tiers ?? "").trim().slice(0, 200);
  await query("insert into collecte_demandes_pieces (collecte_id, texte, demande_par, categorie, tiers) values ($1,$2,$3,$4,$5)", [req.params.id, texte, req.session.nom, categorie, tiers]);
  logAction(req.session.nom, "creation", "collecte", `Pièce ${categorie} demandée — ${periodeLabel(c.periode)} : ${texte.slice(0, 80)}`, req.params.id);
  const clients = (
    await query("select id from employes where role = 'societe_employe' and societe_id = $1 and statut = 'actif'", [c.societe_id])
  ).rows.map((r) => r.id);
  notifyMany(clients, "collecte", `Pièce ${categorie} demandée par le cabinet : ${periodeLabel(c.periode)}`, `${tiers ? `${tiers} — ` : ""}${texte}`.slice(0, 120), `/collectes/${req.params.id}?tab=documents`);
  res.status(201).json(await loadCollecte(req.params.id));
});

collectesRouter.delete("/:id/demandes-pieces/:demandeId", async (req, res) => {
  const c = (await query("select * from collectes where id = $1", [req.params.id])).rows[0];
  if (!c) return res.status(404).json({ error: "Collecte introuvable" });
  if (!isCabinet(req.session, c.societe_id)) return res.status(403).json({ error: "Suppression non autorisée" });
  const { rowCount } = await query("delete from collecte_demandes_pieces where id = $1 and collecte_id = $2", [req.params.demandeId, req.params.id]);
  if (!rowCount) return res.status(404).json({ error: "Demande introuvable" });
  res.json(await loadCollecte(req.params.id));
});

/** Le client (ou le cabinet) répond à une demande en ajoutant le document. */
collectesRouter.post("/:id/demandes-pieces/:demandeId/fichiers", async (req, res) => {
  const c = (await query("select * from collectes where id = $1", [req.params.id])).rows[0];
  if (!c) return res.status(404).json({ error: "Collecte introuvable" });
  if (!canEdit(req.session, c.societe_id)) return res.status(403).json({ error: "Dépôt non autorisé" });
  if (c.statut === "archive") return res.status(400).json({ error: "Collecte archivée" });
  const demande = (await query("select * from collecte_demandes_pieces where id = $1 and collecte_id = $2", [req.params.demandeId, req.params.id])).rows[0];
  if (!demande) return res.status(404).json({ error: "Demande introuvable" });
  const parsed = fichierSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const v = parsed.data;
  await query(
    `insert into collecte_fichiers (collecte_id, onglet, nom, format, taille, data_url, depose_par, demande_id)
     values ($1,'',$2,$3,$4,$5,$6,$7)`,
    [req.params.id, v.nom, v.format, v.taille, v.dataUrl, req.session.nom, demande.id],
  );
  if (demande.statut !== "fournie") {
    await query("update collecte_demandes_pieces set statut = 'fournie', fournie_par = $2, fournie_le = now() where id = $1", [demande.id, req.session.nom]);
    logAction(req.session.nom, "creation", "collecte", `Pièce fournie « ${v.nom} » — ${periodeLabel(c.periode)}`, req.params.id);
    const soc = (await query("select raison_sociale from societes where id = $1", [c.societe_id])).rows[0];
    const clientsIds = new Set(
      (await query("select id from employes where role = 'societe_employe' and societe_id = $1", [c.societe_id])).rows.map((r) => r.id),
    );
    const cabinet = (await concernedBySociete(c.societe_id, { includeAdmin: true })).filter((k) => k !== notifKey(req.session) && !clientsIds.has(k));
    notifyMany(cabinet, "collecte", `Pièce fournie : ${soc?.raison_sociale ?? ""} — ${periodeLabel(c.periode)}`, `« ${demande.texte.slice(0, 80)} » · par ${req.session.nom}`, `/collectes/${req.params.id}?tab=documents`);
  }
  res.status(201).json(await loadCollecte(req.params.id));
});

collectesRouter.delete("/:id/fichiers/:fichierId", async (req, res) => {
  const c = (await query("select * from collectes where id = $1", [req.params.id]))
    .rows[0];
  if (!c) return res.status(404).json({ error: "Collecte introuvable" });
  if (!canEdit(req.session, c.societe_id))
    return res.status(403).json({ error: "Suppression non autorisée" });
  const cible = (
    await query("select onglet from collecte_fichiers where id = $1 and collecte_id = $2", [req.params.fichierId, req.params.id])
  ).rows[0];
  const verrouille = cible?.onglet && (c.onglets ?? []).includes(cible.onglet)
    ? await isOngletLocked(req.session, c, cible.onglet)
    : await isLocked(req.session, c);
  if (verrouille) return res.status(400).json({ error: "Collecte verrouillée" });
  const { rows } = await query(
    "delete from collecte_fichiers where id = $1 and collecte_id = $2 returning nom",
    [req.params.fichierId, req.params.id],
  );
  if (!rows[0]) return res.status(404).json({ error: "Fichier introuvable" });
  logAction(req.session.nom, "suppression", "collecte", `Pièce jointe « ${rows[0].nom} » — ${periodeLabel(c.periode)}`, req.params.id);
  res.json(await loadCollecte(req.params.id));
});
