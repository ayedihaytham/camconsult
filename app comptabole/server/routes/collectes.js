import { Router } from "express";
import { z } from "zod";
import { query, withTransaction } from "../db.js";
import { requireAuth, requireAdmin, canSeeSociete } from "../auth.js";
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
} from "../mappers.js";
import { sendRelance } from "../relances.js";

export const collectesRouter = Router();
collectesRouter.use(requireAuth);

// Clés d'onglets valides — miroir de src/lib/collecte/tabs.ts
const TAB_KEYS = new Set([
  "souche_cheques",
  "bordereaux_remise_cheques",
  "virements_recus",
  "virements_emis",
  "virements_salaire",
  "chiffre_affaires",
  "detail_achats",
  "etat_caisse",
  "etat_clients",
  "etat_fournisseurs",
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
});

async function loadCollecte(id) {
  const c = (await query("select * from collectes where id = $1", [id])).rows[0];
  if (!c) return null;
  const [sections, lignes, notes, fichiers] = await Promise.all([
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
  ]);
  return {
    ...collecteDto(c),
    sections: sections.rows.map(collecteSectionDto),
    lignes: lignes.rows.map(collecteLigneDto),
    notes: notes.rows.map(collecteNoteDto),
    fichiers: fichiers.rows.map(collecteFichierDto),
  };
}

/** Qui peut écrire une note : admin ou client de société (pas le collaborateur). */
function canPostNote(session, societeId) {
  if (session.role === "admin") return true;
  return (
    session.poste === "societe_employe" &&
    (session.societeIds || []).includes(societeId)
  );
}
const noteAuteur = (session) =>
  session.role === "admin" ? "admin" : "client";

/** Admin, collaborateur en charge, ou employé de la société : sur les sociétés du périmètre. */
function canEdit(session, societeId) {
  if (session.role === "admin") return true;
  return (session.societeIds || []).includes(societeId);
}

/** Collecte verrouillée en écriture pour cette session, tous onglets
 * confondus — utilisé pour les actions non liées à un onglet précis (pièces
 * jointes générales). `sections` : lignes collecte_sections déjà chargées. */
function isLocked(session, collecte, sections) {
  const statut = collecte.statut;
  // archivée : lecture seule pour tout le monde, admin compris.
  if (statut === "archive") return true;
  if (session.role === "admin") return false;
  // validée : lecture seule pour le client / le collaborateur (côté cabinet ok).
  if (statut === "valide") return session.poste === "societe_employe" ? true : false;
  if (session.poste !== "societe_employe") return false;
  // le client : bloqué après transmission, SAUF si au moins un tableau est
  // en cours de complétion (récap envoyé sur ce tableau).
  if (statut === "transmis") return !sections.some((s) => s.recap_statut === "envoye");
  return false;
}

/** Un onglet précis est-il modifiable par cette session ? Indépendant des
 * autres onglets de la même collecte — envoyer le récap d'un tableau ne
 * déverrouille QUE ce tableau côté client. Ne requête collecte_sections que
 * si c'est réellement nécessaire (jamais pour un admin/collaborateur, ni
 * hors du cas "transmis") — ce contrôle tourne à chaque sauvegarde de
 * tableau (le bouton « Enregistrer »), donc sur le chemin le plus chaud de
 * tout le module ; l'admin (le cas le plus fréquent) sortait toujours au
 * premier test sans jamais utiliser `sections`, mais l'appelant la
 * chargeait quand même avant d'appeler cette fonction. */
async function isOngletLocked(session, collecte, onglet) {
  const statut = collecte.statut;
  if (statut === "archive") return true;
  if (session.role === "admin") return false;
  if (statut === "valide") return session.poste === "societe_employe" ? true : false;
  if (session.poste !== "societe_employe") return false;
  if (statut !== "transmis") return false;
  const row = (
    await query(
      "select recap_statut from collecte_sections where collecte_id=$1 and onglet=$2",
      [collecte.id, onglet],
    )
  ).rows[0];
  return (row?.recap_statut ?? "none") !== "envoye";
}

// ── Liste ─────────────────────────────────────────
collectesRouter.get("/", async (req, res) => {
  const params = [];
  const clauses = [];
  if (req.query.societeId) {
    params.push(req.query.societeId);
    clauses.push(`societe_id = $${params.length}`);
  }
  const where = clauses.length ? `where ${clauses.join(" and ")}` : "";
  const rows = (
    await query(`select * from collectes ${where} order by cree_le desc`, params)
  ).rows.filter((r) => canSeeSociete(req.session, r.societe_id));
  res.json(rows.map(collecteDto));
});

// ── Détail ────────────────────────────────────────
collectesRouter.get("/:id", async (req, res) => {
  const full = await loadCollecte(req.params.id);
  if (!full) return res.status(404).json({ error: "Collecte introuvable" });
  if (!canSeeSociete(req.session, full.societeId))
    return res.status(403).json({ error: "Collecte hors périmètre" });
  res.json(full);
});

// ── Création (admin) ──────────────────────────────
collectesRouter.post("/", requireAdmin, async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0].message });
  const v = parsed.data;
  const soc = (
    await query("select raison_sociale from societes where id = $1", [v.societeId])
  ).rows[0];
  if (!soc) return res.status(400).json({ error: "Société introuvable" });
  const onglets = cleanOnglets(v.onglets);

  const created = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `insert into collectes (societe_id, periode, onglets, devise, echeance, relance_cadence_jours)
       values ($1,$2,$3::jsonb,$4,$5,$6) returning *`,
      [
        v.societeId, v.periode.trim(), JSON.stringify(onglets), v.devise || "TND",
        v.echeance || null, v.relanceCadenceJours || 3,
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
  const targets = await concernedBySociete(v.societeId, { includeAdmin: false });
  notifyMany(
    targets,
    "collecte",
    `Nouvelle collecte à remplir : ${periodeLabel(v.periode)}`,
    `Société ${soc.raison_sociale} — ${onglets.length} tableau(x) demandé(s)`,
    `/collectes/${created.id}`,
  );
  res.status(201).json(await loadCollecte(created.id));
});

// ── Mise à jour ───────────────────────────────────
collectesRouter.patch("/:id", async (req, res) => {
  const c = (await query("select * from collectes where id = $1", [req.params.id]))
    .rows[0];
  if (!c) return res.status(404).json({ error: "Collecte introuvable" });
  const isAdmin = req.session.role === "admin";
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
    if (!["brouillon", "a_corriger"].includes(c.statut))
      return res.status(400).json({ error: "Collecte déjà transmise" });
    const { rows } = await query(
      "update collectes set statut='transmis', transmis_le=now(), maj_le=now() where id=$1 returning *",
      [req.params.id],
    );
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

  // Admin
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
  };

  await withTransaction(async (client) => {
    await client.query(
      `update collectes set periode=$1, devise=$2, onglets=$3::jsonb, statut=$4, echeance=$6,
         relance_cadence_jours=$7,
         rappel_avant_envoye = case when $8 then false else rappel_avant_envoye end,
         transmis_le = case when $4='transmis' and transmis_le is null then now() else transmis_le end,
         valide_le   = case when $4='valide' then now() else valide_le end,
         maj_le = now()
       where id=$5`,
      [
        next.periode, next.devise, JSON.stringify(next.onglets), next.statut, req.params.id,
        next.echeance, next.relanceCadenceJours, echeanceChanged,
      ],
    );
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

// ── Suppression (admin) ───────────────────────────
collectesRouter.delete("/:id", requireAdmin, async (req, res) => {
  const { rows } = await query(
    "delete from collectes where id = $1 returning periode, societe_id",
    [req.params.id],
  );
  if (!rows[0]) return res.status(404).json({ error: "Collecte introuvable" });
  logAction(req.session.nom, "suppression", "collecte", periodeLabel(rows[0].periode), req.params.id);
  res.json({ ok: true });
});

// ── Lignes d'un onglet (remplacement complet) ─────
const lignesSchema = z.object({
  lignes: z
    .array(
      z.object({
        data: z.record(z.any()).default({}),
        ordre: z.number().int().optional(),
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
  if (await isOngletLocked(req.session, c, onglet))
    return res.status(400).json({ error: "Ce tableau est verrouillé" });

  const parsed = lignesSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0].message });

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
      const { rows } = await client.query(
        `insert into collecte_lignes (collecte_id, onglet, ordre, data)
         values ($1,$2,$3,$4::jsonb) returning *`,
        [req.params.id, onglet, l.ordre ?? i, JSON.stringify(l.data ?? {})],
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
  res.json({ onglet, lignes: savedLignes.map(collecteLigneDto) });
});

// ── Commentaire de checklist d'un onglet ──────────
collectesRouter.patch("/:id/sections/:onglet", async (req, res) => {
  const c = (await query("select * from collectes where id = $1", [req.params.id]))
    .rows[0];
  if (!c) return res.status(404).json({ error: "Collecte introuvable" });
  if (!canEdit(req.session, c.societe_id))
    return res.status(403).json({ error: "Modification non autorisée" });
  if (await isOngletLocked(req.session, c, req.params.onglet))
    return res.status(400).json({ error: "Ce tableau est verrouillé" });
  const commentaire = String(req.body?.commentaire ?? "").slice(0, 1000);
  const { rows } = await query(
    `insert into collecte_sections (collecte_id, onglet, commentaire)
     values ($1,$2,$3)
     on conflict (collecte_id, onglet) do update set commentaire = excluded.commentaire
     returning *`,
    [req.params.id, req.params.onglet, commentaire],
  );
  logAction(
    req.session.nom,
    "modification",
    "collecte",
    `Commentaire « ${req.params.onglet} » modifié — ${periodeLabel(c.periode)}`,
    req.params.id,
  );
  res.json({ section: collecteSectionDto(rows[0]) });
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
    `insert into collecte_notes (collecte_id, onglet, kind, auteur, texte)
     values ($1,$2,'note',$3,$4)`,
    [req.params.id, onglet, noteAuteur(req.session), texte],
  );
  logAction(
    req.session.nom,
    "creation",
    "collecte",
    `Note ajoutée${onglet ? ` (« ${onglet} »)` : ""} — ${periodeLabel(c.periode)} : ${texte.slice(0, 80)}`,
    req.params.id,
  );
  res.status(201).json(await loadCollecte(req.params.id));
});

/**
 * L'admin ouvre la complétion d'UN tableau précis : le client pourra
 * remplir les cases importantes vides de CE tableau (détectées EN DIRECT
 * côté client, pas figées ici) — indépendant des autres tableaux, jamais
 * un envoi global pour toute la collecte.
 */
collectesRouter.post("/:id/sections/:onglet/recap/send", requireAdmin, async (req, res) => {
  const c = (await query("select * from collectes where id = $1", [req.params.id]))
    .rows[0];
  if (!c) return res.status(404).json({ error: "Collecte introuvable" });
  const onglet = req.params.onglet;
  if (!(Array.isArray(c.onglets) ? c.onglets : []).includes(onglet))
    return res.status(400).json({ error: "Onglet non demandé dans cette collecte" });
  const count = Number(req.body?.count) || 0;
  const soc = (
    await query("select raison_sociale from societes where id = $1", [c.societe_id])
  ).rows[0];

  await query(
    `insert into collecte_sections (collecte_id, onglet, recap_statut)
     values ($1,$2,'envoye')
     on conflict (collecte_id, onglet) do update set recap_statut = 'envoye'`,
    [req.params.id, onglet],
  );

  logAction(req.session.nom, "modification", "collecte", `Récap « ${onglet} » envoyé — ${soc?.raison_sociale ?? ""} ${periodeLabel(c.periode)}`, req.params.id);
  const targets = (
    await concernedBySociete(c.societe_id, { includeAdmin: false })
  ).filter((k) => k !== notifKey(req.session));
  notifyMany(
    targets,
    "collecte",
    `Récap à compléter : ${soc?.raison_sociale ?? ""} — ${periodeLabel(c.periode)}`,
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

/** L'admin clôt le récap d'UN tableau précis (retour à l'état normal). */
collectesRouter.post("/:id/sections/:onglet/recap/close", requireAdmin, async (req, res) => {
  await query(
    "update collecte_sections set recap_statut = 'none' where collecte_id = $1 and onglet = $2",
    [req.params.id, req.params.onglet],
  );
  res.json(await loadCollecte(req.params.id));
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

// ── Relance manuelle (admin) ──────────────────────
collectesRouter.post("/:id/relance", requireAdmin, async (req, res) => {
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
  const fSections = (
    await query("select onglet, recap_statut from collecte_sections where collecte_id=$1", [req.params.id])
  ).rows;
  if (isLocked(req.session, c, fSections))
    return res.status(400).json({ error: "Collecte verrouillée" });
  const parsed = fichierSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0].message });
  const v = parsed.data;
  await query(
    `insert into collecte_fichiers (collecte_id, onglet, nom, format, taille, data_url, depose_par)
     values ($1,$2,$3,$4,$5,$6,$7)`,
    [req.params.id, v.onglet, v.nom, v.format, v.taille, v.dataUrl, req.session.nom],
  );
  logAction(req.session.nom, "creation", "collecte", `Pièce jointe « ${v.nom} » — ${periodeLabel(c.periode)}`, req.params.id);
  res.status(201).json(await loadCollecte(req.params.id));
});

collectesRouter.delete("/:id/fichiers/:fichierId", async (req, res) => {
  const c = (await query("select * from collectes where id = $1", [req.params.id]))
    .rows[0];
  if (!c) return res.status(404).json({ error: "Collecte introuvable" });
  if (!canEdit(req.session, c.societe_id))
    return res.status(403).json({ error: "Suppression non autorisée" });
  const dSections = (
    await query("select onglet, recap_statut from collecte_sections where collecte_id=$1", [req.params.id])
  ).rows;
  if (isLocked(req.session, c, dSections))
    return res.status(400).json({ error: "Collecte verrouillée" });
  const { rows } = await query(
    "delete from collecte_fichiers where id = $1 and collecte_id = $2 returning nom",
    [req.params.fichierId, req.params.id],
  );
  if (!rows[0]) return res.status(404).json({ error: "Fichier introuvable" });
  logAction(req.session.nom, "suppression", "collecte", `Pièce jointe « ${rows[0].nom} » — ${periodeLabel(c.periode)}`, req.params.id);
  res.json(await loadCollecte(req.params.id));
});
