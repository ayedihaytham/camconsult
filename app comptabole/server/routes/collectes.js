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

const createSchema = z.object({
  societeId: z.string().uuid(),
  periode: z.string().min(1),
  onglets: z.array(z.string()).default([]),
  devise: z.string().default("EUR"),
  echeance: z.string().nullish(),
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

/** Collecte verrouillée en écriture pour cette session ? */
function isLocked(session, collecte) {
  const statut = collecte.statut;
  // archivée : lecture seule pour tout le monde, admin compris.
  if (statut === "archive") return true;
  if (session.role === "admin") return false;
  // validée : lecture seule pour le client / le collaborateur (côté cabinet ok).
  if (statut === "valide") return session.poste === "societe_employe" ? true : false;
  if (session.poste !== "societe_employe") return false;
  // le client : bloqué après transmission, SAUF si le cabinet lui a renvoyé
  // un récap à compléter (recap_statut = 'envoye').
  if (statut === "transmis" && collecte.recap_statut !== "envoye") return true;
  return false;
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
      `insert into collectes (societe_id, periode, onglets, devise, echeance)
       values ($1,$2,$3::jsonb,$4,$5) returning *`,
      [v.societeId, v.periode.trim(), JSON.stringify(onglets), v.devise || "EUR", v.echeance || null],
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
    `${soc.raison_sociale} — ${v.periode}`,
    created.id,
  );
  const targets = await concernedBySociete(v.societeId, { includeAdmin: false });
  notifyMany(
    targets,
    "collecte",
    `Nouvelle collecte à remplir : ${v.periode}`,
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
    logAction(req.session.nom, "modification", "collecte", `Transmise — ${socNom} ${c.periode}`, c.id);
    notify(
      "admin",
      "collecte",
      `Collecte transmise : ${socNom} — ${c.periode}`,
      `Par ${req.session.nom}`,
      `/collectes/${req.params.id}`,
    );
    const collabs = (
      await concernedBySociete(c.societe_id, { includeAdmin: false })
    ).filter((k) => k !== notifKey(req.session));
    notifyMany(
      collabs,
      "collecte",
      `Collecte transmise : ${socNom} — ${c.periode}`,
      "",
      `/collectes/${req.params.id}`,
    );
    return res.json(await loadCollecte(req.params.id));
  }

  // Admin
  const next = {
    periode: typeof b.periode === "string" && b.periode.trim() ? b.periode.trim() : c.periode,
    devise: typeof b.devise === "string" && b.devise ? b.devise : c.devise,
    echeance: b.echeance === undefined ? c.echeance : b.echeance || null,
    onglets: b.onglets === undefined ? c.onglets : cleanOnglets(b.onglets),
    statut: STATUTS.includes(b.statut) ? b.statut : c.statut,
  };

  await withTransaction(async (client) => {
    await client.query(
      `update collectes set periode=$1, devise=$2, onglets=$3::jsonb, statut=$4, echeance=$6,
         transmis_le = case when $4='transmis' and transmis_le is null then now() else transmis_le end,
         valide_le   = case when $4='valide' then now() else valide_le end,
         maj_le = now()
       where id=$5`,
      [next.periode, next.devise, JSON.stringify(next.onglets), next.statut, req.params.id, next.echeance],
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

  logAction(req.session.nom, "modification", "collecte", `${socNom} — ${next.periode}`, req.params.id);
  if (next.statut !== c.statut) {
    const targets = (
      await concernedBySociete(c.societe_id, { includeAdmin: false })
    ).filter((k) => k !== notifKey(req.session));
    const msg =
      next.statut === "valide"
        ? `Collecte validée : ${socNom} — ${next.periode}`
        : next.statut === "a_corriger"
          ? `Collecte à corriger : ${socNom} — ${next.periode}`
          : `Collecte mise à jour : ${socNom} — ${next.periode}`;
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
  logAction(req.session.nom, "suppression", "collecte", rows[0].periode, req.params.id);
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
  if (isLocked(req.session, c))
    return res.status(400).json({ error: "Collecte verrouillée" });

  const parsed = lignesSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0].message });

  await withTransaction(async (client) => {
    await client.query(
      "delete from collecte_lignes where collecte_id=$1 and onglet=$2",
      [req.params.id, onglet],
    );
    let i = 0;
    for (const l of parsed.data.lignes) {
      await client.query(
        `insert into collecte_lignes (collecte_id, onglet, ordre, data)
         values ($1,$2,$3,$4::jsonb)`,
        [req.params.id, onglet, l.ordre ?? i, JSON.stringify(l.data ?? {})],
      );
      i++;
    }
    await client.query("update collectes set maj_le=now() where id=$1", [
      req.params.id,
    ]);
  });
  res.json(await loadCollecte(req.params.id));
});

// ── Commentaire de checklist d'un onglet ──────────
collectesRouter.patch("/:id/sections/:onglet", async (req, res) => {
  const c = (await query("select * from collectes where id = $1", [req.params.id]))
    .rows[0];
  if (!c) return res.status(404).json({ error: "Collecte introuvable" });
  if (!canEdit(req.session, c.societe_id))
    return res.status(403).json({ error: "Modification non autorisée" });
  if (isLocked(req.session, c))
    return res.status(400).json({ error: "Collecte verrouillée" });
  const commentaire = String(req.body?.commentaire ?? "").slice(0, 1000);
  await query(
    `insert into collecte_sections (collecte_id, onglet, commentaire)
     values ($1,$2,$3)
     on conflict (collecte_id, onglet) do update set commentaire = excluded.commentaire`,
    [req.params.id, req.params.onglet, commentaire],
  );
  res.json(await loadCollecte(req.params.id));
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
  res.status(201).json(await loadCollecte(req.params.id));
});

/**
 * L'admin ouvre la complétion : le client pourra remplir les cases importantes
 * vides (détectées EN DIRECT côté client, pas figées ici).
 */
collectesRouter.post("/:id/recap/send", requireAdmin, async (req, res) => {
  const c = (await query("select * from collectes where id = $1", [req.params.id]))
    .rows[0];
  if (!c) return res.status(404).json({ error: "Collecte introuvable" });
  const count = Number(req.body?.count) || 0;
  const soc = (
    await query("select raison_sociale from societes where id = $1", [c.societe_id])
  ).rows[0];

  await query(
    "update collectes set recap_statut = 'envoye', maj_le = now() where id = $1",
    [req.params.id],
  );

  logAction(req.session.nom, "modification", "collecte", `Récap envoyé — ${soc?.raison_sociale ?? ""} ${c.periode}`, req.params.id);
  const targets = (
    await concernedBySociete(c.societe_id, { includeAdmin: false })
  ).filter((k) => k !== notifKey(req.session));
  notifyMany(
    targets,
    "collecte",
    `Récap à compléter : ${soc?.raison_sociale ?? ""} — ${c.periode}`,
    `${count} case(s) à remplir`,
    `/collectes/${req.params.id}`,
  );
  res.json(await loadCollecte(req.params.id));
});

/** Le client renvoie au cabinet le récap complété (cases remplies dans les onglets). */
collectesRouter.post("/:id/recap/submit", async (req, res) => {
  const c = (await query("select * from collectes where id = $1", [req.params.id]))
    .rows[0];
  if (!c) return res.status(404).json({ error: "Collecte introuvable" });
  if (req.session.poste !== "societe_employe" || !canEdit(req.session, c.societe_id))
    return res.status(403).json({ error: "Réservé au client de la société" });
  if (c.recap_statut !== "envoye")
    return res.status(400).json({ error: "Aucun récap en attente" });
  await query(
    "update collectes set recap_statut = 'repondu', maj_le = now() where id = $1",
    [req.params.id],
  );
  const soc = (
    await query("select raison_sociale from societes where id = $1", [c.societe_id])
  ).rows[0];
  logAction(req.session.nom, "modification", "collecte", `Récap complété par le client — ${c.periode}`, req.params.id);
  notify(
    "admin",
    "collecte",
    `Récap complété : ${soc?.raison_sociale ?? ""} — ${c.periode}`,
    `Par ${req.session.nom}`,
    `/collectes/${req.params.id}`,
  );
  res.json(await loadCollecte(req.params.id));
});

/** L'admin clôt le récap (retour à l'état normal). */
collectesRouter.post("/:id/recap/close", requireAdmin, async (req, res) => {
  await query(
    "update collectes set recap_statut = 'none', maj_le = now() where id = $1",
    [req.params.id],
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
      `select c.id, c.societe_id, c.periode, c.echeance,
              s.raison_sociale, s.email as societe_email
       from collectes c
       join societes s on s.id = c.societe_id
       where c.id = $1`,
      [req.params.id],
    )
  ).rows[0];
  if (!row) return res.status(404).json({ error: "Collecte introuvable" });
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
  if (isLocked(req.session, c))
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
  logAction(req.session.nom, "creation", "collecte", `Pièce jointe « ${v.nom} » — ${c.periode}`, req.params.id);
  res.status(201).json(await loadCollecte(req.params.id));
});

collectesRouter.delete("/:id/fichiers/:fichierId", async (req, res) => {
  const c = (await query("select * from collectes where id = $1", [req.params.id]))
    .rows[0];
  if (!c) return res.status(404).json({ error: "Collecte introuvable" });
  if (!canEdit(req.session, c.societe_id))
    return res.status(403).json({ error: "Suppression non autorisée" });
  if (isLocked(req.session, c))
    return res.status(400).json({ error: "Collecte verrouillée" });
  const { rows } = await query(
    "delete from collecte_fichiers where id = $1 and collecte_id = $2 returning nom",
    [req.params.fichierId, req.params.id],
  );
  if (!rows[0]) return res.status(404).json({ error: "Fichier introuvable" });
  logAction(req.session.nom, "suppression", "collecte", `Pièce jointe « ${rows[0].nom} » — ${c.periode}`, req.params.id);
  res.json(await loadCollecte(req.params.id));
});
