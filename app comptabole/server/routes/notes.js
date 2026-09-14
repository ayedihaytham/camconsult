import { Router } from "express";
import { z } from "zod";
import { query } from "../db.js";
import { requireAuth } from "../auth.js";
import { logAction } from "../journal.js";
import { notesModeleDto, ficheSocieteDto, notesExerciceDto } from "../mappers.js";

export const notesRouter = Router();
notesRouter.use(requireAuth);

/** Notes aux états financiers = données comptables internes, même règle
 * d'accès que le reste du module (voir server/routes/balances.js). */
function canAccess(session, societeId) {
  if (session.role === "admin") return true;
  if (session.poste === "societe_employe") return false;
  return (session.societeIds || []).includes(societeId);
}

/** Le modèle de texte est un référentiel cabinet, pas lié à une société —
 * accessible à tout collaborateur (jamais un employé de société cliente). */
function canAccessCabinet(session) {
  return session.role === "admin" || session.poste !== "societe_employe";
}

// ── Modèle de texte (cabinet, singleton "default") ────
notesRouter.get("/modele", async (req, res) => {
  if (!canAccessCabinet(req.session)) return res.status(403).json({ error: "Accès non autorisé" });
  const { rows } = await query("select * from notes_modele where id = 'default'");
  res.json(notesModeleDto(rows[0] ?? { texte: "" }));
});

const modeleSchema = z.object({ texte: z.string().default("") });

notesRouter.put("/modele", async (req, res) => {
  if (!canAccessCabinet(req.session)) return res.status(403).json({ error: "Accès non autorisé" });
  const parsed = modeleSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0].message });
  const { rows } = await query(
    `insert into notes_modele (id, texte) values ('default', $1)
     on conflict (id) do update set texte = excluded.texte, maj_le = now()
     returning *`,
    [parsed.data.texte],
  );
  logAction(req.session.nom, "modification", "balance", "Modèle de notes modifié");
  res.json(notesModeleDto(rows[0]));
});

// ── Fiche société ──────────────────────────────────
notesRouter.get("/fiche-societe/:societeId", async (req, res) => {
  const { societeId } = req.params;
  if (!canAccess(req.session, societeId))
    return res.status(403).json({ error: "Accès non autorisé" });
  const { rows } = await query("select * from fiche_societe where societe_id = $1", [societeId]);
  res.json(ficheSocieteDto(rows[0] ?? { societe_id: societeId }));
});

const objetSocialItem = z.object({ titre: z.string().default(""), texte: z.string().default("") });
const associeItem = z.object({
  nom: z.string().default(""),
  valeurParts: z.coerce.number().default(0),
  parts: z.coerce.number().default(0),
});

const ficheSchema = z.object({
  formeJuridique: z.string().default(""),
  statutFiscal: z.string().default(""),
  dateCreation: z.string().nullable().default(null),
  capitalInitial: z.coerce.number().default(0),
  partsInitiales: z.coerce.number().default(0),
  valeurNominale: z.coerce.number().default(0),
  objetSocial: z.array(objetSocialItem).default([]),
  associes: z.array(associeItem).default([]),
});

notesRouter.put("/fiche-societe/:societeId", async (req, res) => {
  const { societeId } = req.params;
  if (!canAccess(req.session, societeId))
    return res.status(403).json({ error: "Accès non autorisé" });
  const soc = (await query("select id from societes where id = $1", [societeId])).rows[0];
  if (!soc) return res.status(404).json({ error: "Société introuvable" });

  const parsed = ficheSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0].message });
  const v = parsed.data;

  const { rows } = await query(
    `insert into fiche_societe
       (societe_id, forme_juridique, statut_fiscal, date_creation, capital_initial, parts_initiales, valeur_nominale, objet_social, associes)
     values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb)
     on conflict (societe_id) do update set
       forme_juridique = excluded.forme_juridique,
       statut_fiscal = excluded.statut_fiscal,
       date_creation = excluded.date_creation,
       capital_initial = excluded.capital_initial,
       parts_initiales = excluded.parts_initiales,
       valeur_nominale = excluded.valeur_nominale,
       objet_social = excluded.objet_social,
       associes = excluded.associes,
       maj_le = now()
     returning *`,
    [
      societeId,
      v.formeJuridique,
      v.statutFiscal,
      v.dateCreation,
      v.capitalInitial,
      v.partsInitiales,
      v.valeurNominale,
      JSON.stringify(v.objetSocial),
      JSON.stringify(v.associes),
    ],
  );
  logAction(req.session.nom, "modification", "balance", "Fiche société (notes) modifiée");
  res.json(ficheSocieteDto(rows[0]));
});

// ── Notes par exercice (surcharge du modèle + blocs libres) ──
notesRouter.get("/exercice", async (req, res) => {
  const societeId = req.query.societeId;
  const exercice = req.query.exercice;
  if (!societeId || !exercice)
    return res.status(400).json({ error: "societeId et exercice requis" });
  if (!canAccess(req.session, societeId))
    return res.status(403).json({ error: "Accès non autorisé" });
  const { rows } = await query(
    "select * from notes_exercice where societe_id = $1 and exercice = $2",
    [societeId, exercice],
  );
  res.json(notesExerciceDto(rows[0] ?? { societe_id: societeId, exercice }));
});

const blocLibreItem = z.object({ titre: z.string().default(""), texte: z.string().default("") });

const notesExerciceSchema = z.object({
  societeId: z.string().uuid(),
  exercice: z.string().min(1),
  texteOverride: z.string().default(""),
  blocsLibres: z.array(blocLibreItem).default([]),
});

notesRouter.put("/exercice", async (req, res) => {
  const parsed = notesExerciceSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0].message });
  const v = parsed.data;
  if (!canAccess(req.session, v.societeId))
    return res.status(403).json({ error: "Accès non autorisé" });

  const { rows } = await query(
    `insert into notes_exercice (societe_id, exercice, texte_override, blocs_libres)
     values ($1, $2, $3, $4::jsonb)
     on conflict (societe_id, exercice) do update set
       texte_override = excluded.texte_override,
       blocs_libres = excluded.blocs_libres,
       maj_le = now()
     returning *`,
    [v.societeId, v.exercice, v.texteOverride, JSON.stringify(v.blocsLibres)],
  );
  logAction(req.session.nom, "modification", "balance", `Notes ${v.exercice} modifiées`);
  res.json(notesExerciceDto(rows[0]));
});

// ── Détail par compte, tous postes confondus (5.4/5.5/5.6/6.2/6.3/6.4/7.1
// du modèle de notes) — le frontend filtre par poste. Regroupe les lignes
// de balance par compte, pour tous les exercices de la société en un seul
// appel. ──
notesRouter.get("/detail-comptes", async (req, res) => {
  const societeId = req.query.societeId;
  if (!societeId) return res.status(400).json({ error: "societeId requis" });
  if (!canAccess(req.session, societeId))
    return res.status(403).json({ error: "Accès non autorisé" });

  const { rows } = await query(
    `select b.exercice,
            coalesce(g.poste, '') as poste,
            bl.compte,
            coalesce(nullif(bl.libelle, ''), gc.libelle_compte, '') as libelle,
            sum(bl.debit - bl.credit) as solde
     from balances b
     join balance_lignes bl on bl.balance_id = b.id
     left join grille_affectat_codes g on g.code = bl.affectat
     left join grille_comptes gc on gc.compte = bl.compte
     where b.societe_id = $1 and bl.compte <> ''
     group by b.exercice, coalesce(g.poste, ''), bl.compte, coalesce(nullif(bl.libelle, ''), gc.libelle_compte, '')
     order by b.exercice desc, bl.compte`,
    [societeId],
  );

  res.json(
    rows.map((r) => ({
      exercice: r.exercice,
      poste: r.poste,
      compte: r.compte,
      libelle: r.libelle,
      solde: Math.round(Number(r.solde) * 1000) / 1000,
    })),
  );
});
