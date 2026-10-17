import { Router } from "express";
import { z } from "zod";
import { query } from "../db.js";
import { requireAuth, canSeeSociete, porteeSocietes } from "../auth.js";
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
  statut: z.enum(["actif", "inactif", "en_attente"]).default("actif"),
  telephone: z.string().default(""),
  email: z.string().default(""),
  adresse: z.string().default(""),
  // Adresse structurée (facture électronique)
  adresseRue: z.string().max(100).default(""),
  ville: z.string().max(100).default(""),
  codePostal: z.string().max(20).default(""),
  pays: z.string().max(6).default("TN"),
});

const COLS = `raison_sociale, rne, tva, theme, code, statut, telephone, email, adresse, adresse_rue, ville, code_postal, pays`;

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
  const { rows } = await query("select * from societes where ($1::uuid[] is null or id = any($1::uuid[])) order by raison_sociale", [porteeSocietes(req.session)]);
  const visible = rows.filter((r) => canSeeSociete(req.session, r.id));
  res.json(visible.map(societeDto));
});

societesRouter.post("/", requireEdit, async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0].message });
  const v = parsed.data;
  const { rows } = await query(
    `insert into societes (${COLS}) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) returning *`,
    [v.raisonSociale, v.rne, v.tva, v.theme, v.code, v.statut, v.telephone, v.email, v.adresse, v.adresseRue, v.ville, v.codePostal, v.pays || "TN"],
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
       statut=$6, telephone=$7, email=$8, adresse=$9, adresse_rue=$10, ville=$11, code_postal=$12, pays=$13
     where id=$14 returning *`,
    [v.raisonSociale, v.rne, v.tva, v.theme, v.code, v.statut, v.telephone, v.email, v.adresse, v.adresseRue, v.ville, v.codePostal, v.pays || "TN", req.params.id],
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
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) returning *`,
    [`${src.raison_sociale} (copie)`, src.rne, src.tva, src.theme, nextCode, src.statut, src.telephone, src.email, src.adresse, src.adresse_rue, src.ville, src.code_postal, src.pays],
  );
  logAction(req.session.nom, "duplication", "societe", src.raison_sociale);
  res.status(201).json(societeDto(rows[0]));
});

const PROTEGEES_SQL = `
  select s.id, s.raison_sociale,
    concat_ws(', ',
      case when f.n > 0 then f.n || ' facture(s)' end,
      case when h.n > 0 then h.n || ' ligne(s) d''honoraires' end,
      case when r.n > 0 then r.n || ' règlement(s) fournisseur' end,
      case when b.n > 0 then b.n || ' compte(s) bancaire(s)' end,
      case when w.n > 0 then w.n || ' virement(s) SWIFT' end,
      case when m.n > 0 then m.n || ' mouvement(s) de stock' end,
      case when l.n > 0 then l.n || ' balance(s)' end,
      case when c.n > 0 then c.n || ' souche(s) de chèques' end,
      case when d.n > 0 then d.n || ' suivi(s) en devise' end) as elements
  from societes s
  cross join lateral (select count(*) n from factures where societe_id = s.id) f
  cross join lateral (select count(*) n from honoraires_lignes where societe_id = s.id) h
  cross join lateral (select count(*) n from fournisseur_reglements where societe_id = s.id) r
  cross join lateral (select count(*) n from comptes_bancaires where societe_id = s.id) b
  cross join lateral (select count(*) n from swift_virements where societe_id = s.id) w
  cross join lateral (select count(*) n from stock_mouvements where societe_id = s.id) m
  cross join lateral (select count(*) n from balances where societe_id = s.id) l
  cross join lateral (select count(*) n from souche_cheques where societe_id = s.id) c
  cross join lateral (select count(*) n from suivi_devise where societe_id = s.id) d
  where s.id = any($1::uuid[])
    and (f.n + h.n + r.n + b.n + w.n + m.n + l.n + c.n + d.n) > 0`;

societesRouter.post("/bulk-delete", requireDelete, async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
  if (ids.length === 0) return res.json({ deleted: 0 });
  // La suppression efface en cascade tout le dossier. Une société qui porte des factures, honoraires, règlements, opérations
  // bancaires, virements SWIFT, stock, balances, souches ou suivis en devise est à archiver (statut inactif) ; sa suppression
  // définitive exige une confirmation explicite.
  if (req.body?.confirmationDefinitive !== "SUPPRIMER DEFINITIVEMENT") {
    const { rows: protegees } = await query(PROTEGEES_SQL, [ids]);
    if (protegees.length > 0) {
      const detail = protegees.map((p) => `« ${p.raison_sociale} » (${p.elements})`).join(", ");
      return res.status(409).json({
        error: `Suppression refusée : ${detail}. Archivez la société (statut Inactif) ou confirmez la suppression définitive.`,
        protegees: protegees.map((p) => p.id),
      });
    }
  }
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
  let rows;
  try {
    ({ rows } = await query(
      "delete from societes where id = any($1::uuid[]) returning raison_sociale",
      [ids],
    ));
  } catch (err) {
    // Clé étrangère protectrice (ex. factures émises) : même confirmée, la suppression est impossible et rien n'est supprimé.
    if (err.code === "23503")
      return res.status(409).json({ error: "Suppression impossible : la société porte des écritures qui doivent être conservées (factures). Archivez-la (statut Inactif)." });
    throw err;
  }
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
