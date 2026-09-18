import { Router } from "express";
import { z } from "zod";
import { query } from "../db.js";
import { requireAuth, canSeeSociete } from "../auth.js";
import { can } from "../permissions.js";
import { logAction } from "../journal.js";
import {
  notifyMany,
  notifKey,
  concernedBySociete,
} from "../notifications.js";
import { societeDto } from "../mappers.js";
import { sendSocieteWelcomeEmail } from "../mailer.js";

export const societesRouter = Router();
societesRouter.use(requireAuth);

const schema = z.object({
  raisonSociale: z.string().min(2),
  rne: z.string().default(""),
  tva: z.string().default(""),
  theme: z.string().default("PME"),
  code: z.string().min(1),
  identifiant: z.string().default(""),
  motDePasse: z.string().default(""),
  statut: z.enum(["actif", "inactif", "en_attente"]).default("actif"),
  telephone: z.string().default(""),
  email: z.string().default(""),
  adresse: z.string().default(""),
});

const COLS = `raison_sociale, rne, tva, theme, code, identifiant, mot_de_passe,
  statut, telephone, email, adresse`;

function requireEdit(req, res, next) {
  if (req.session.role === "admin" || can(req.session, "modifierSocietes"))
    return next();
  res.status(403).json({ error: "Droit « modifier les sociétés » requis" });
}
function requireDelete(req, res, next) {
  if (req.session.role === "admin" || can(req.session, "supprimer"))
    return next();
  res.status(403).json({ error: "Droit « supprimer » requis" });
}

societesRouter.get("/", async (req, res) => {
  const { rows } = await query("select * from societes order by raison_sociale");
  const visible = rows.filter((r) => canSeeSociete(req.session, r.id));
  res.json(visible.map(societeDto));
});

societesRouter.post("/", requireEdit, async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0].message });
  const v = parsed.data;
  const { rows } = await query(
    `insert into societes (${COLS}) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning *`,
    [
      v.raisonSociale, v.rne, v.tva, v.theme, v.code, v.identifiant,
      v.motDePasse, v.statut, v.telephone, v.email, v.adresse,
    ],
  );
  logAction(req.session.nom, "creation", "societe", v.raisonSociale);
  const dto = societeDto(rows[0]);
  // Jamais bloquant : la création de la société réussit même si l'email
  // échoue (SMTP mal configuré, boîte pleine…) — juste consigné en log.
  sendSocieteWelcomeEmail(dto).catch((err) =>
    console.error("[mailer] envoi de bienvenue échoué", err.message),
  );
  res.status(201).json(dto);
});

societesRouter.patch("/:id", requireEdit, async (req, res) => {
  const existing = (await query("select * from societes where id = $1", [req.params.id])).rows[0];
  if (!existing) return res.status(404).json({ error: "Société introuvable" });
  if (!canSeeSociete(req.session, existing.id))
    return res.status(403).json({ error: "Société hors périmètre" });
  const merged = schema.partial().safeParse(req.body);
  if (!merged.success)
    return res.status(400).json({ error: merged.error.issues[0].message });
  const v = { ...societeDto(existing), ...merged.data };
  const { rows } = await query(
    `update societes set raison_sociale=$1, rne=$2, tva=$3, theme=$4, code=$5,
       identifiant=$6, mot_de_passe=$7, statut=$8, telephone=$9, email=$10, adresse=$11
     where id=$12 returning *`,
    [
      v.raisonSociale, v.rne, v.tva, v.theme, v.code, v.identifiant,
      v.motDePasse, v.statut, v.telephone, v.email, v.adresse, req.params.id,
    ],
  );
  logAction(req.session.nom, "modification", "societe", v.raisonSociale);
  const targets = (
    await concernedBySociete(req.params.id, {
      includeAdmin: req.session.role !== "admin",
    })
  ).filter((k) => k !== notifKey(req.session));
  notifyMany(
    targets,
    "societe",
    `Société mise à jour : ${v.raisonSociale}`,
    `Par ${req.session.nom}`,
    "/societes",
  );
  res.json(societeDto(rows[0]));
});

societesRouter.post("/:id/duplicate", requireEdit, async (req, res) => {
  const src = (await query("select * from societes where id = $1", [req.params.id])).rows[0];
  if (!src) return res.status(404).json({ error: "Société introuvable" });
  const nextCode = String(req.body?.nextCode || `${src.code}-copie`);
  const { rows } = await query(
    `insert into societes (${COLS})
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning *`,
    [
      `${src.raison_sociale} (copie)`, src.rne, src.tva, src.theme, nextCode,
      src.identifiant, src.mot_de_passe, src.statut, src.telephone, src.email, src.adresse,
    ],
  );
  logAction(req.session.nom, "duplication", "societe", src.raison_sociale);
  res.status(201).json(societeDto(rows[0]));
});

societesRouter.post("/bulk-delete", requireDelete, async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
  if (ids.length === 0) return res.json({ deleted: 0 });
  // Récupère les personnes concernées AVANT la suppression (cascade).
  const before = (
    await query(
      "select id, raison_sociale from societes where id = any($1::uuid[])",
      [ids],
    )
  ).rows;
  const concerned = new Map();
  for (const s of before) {
    concerned.set(
      s.id,
      await concernedBySociete(s.id, { includeAdmin: req.session.role !== "admin" }),
    );
  }
  const { rows } = await query(
    "delete from societes where id = any($1::uuid[]) returning raison_sociale",
    [ids],
  );
  for (const s of before) {
    notifyMany(
      (concerned.get(s.id) ?? []).filter((k) => k !== notifKey(req.session)),
      "societe",
      `Société supprimée : ${s.raison_sociale}`,
      `Par ${req.session.nom}`,
      "/societes",
    );
  }
  logAction(
    req.session.nom,
    "suppression",
    "societe",
    rows.length > 1
      ? `${rows.length} sociétés : ${rows.map((r) => r.raison_sociale).join(", ")}`
      : (rows[0]?.raison_sociale ?? "société"),
  );
  res.json({ deleted: rows.length });
});
