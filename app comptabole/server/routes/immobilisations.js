import { Router } from "express";
import { z } from "zod";
import { query, withTransaction } from "../db.js";
import { requireAuth } from "../auth.js";
import { logAction } from "../journal.js";
import { immoCategorieDto, immoBienDto } from "../mappers.js";

export const immobilisationsRouter = Router();
immobilisationsRouter.use(requireAuth);

/** Registre d'immobilisations = données comptables internes, même règle
 * d'accès que le reste du module États financiers. */
function canAccess(session, societeId) {
  if (session.role === "admin") return true;
  if (session.poste === "societe_employe") return false;
  return (session.societeIds || []).includes(societeId);
}

function canAccessCabinet(session) {
  return session.role === "admin" || session.poste !== "societe_employe";
}

// ── Catégories (référentiel cabinet) ──────────────
immobilisationsRouter.get("/categories", async (req, res) => {
  if (!canAccessCabinet(req.session)) return res.status(403).json({ error: "Accès non autorisé" });
  const { rows } = await query("select * from immo_categories order by masse, nom");
  res.json(rows.map(immoCategorieDto));
});

const categorieSchema = z.object({
  nom: z.string().min(1, "Nom requis"),
  taux: z.coerce.number().default(0),
  masse: z.enum(["incorporelle", "corporelle"]),
});

immobilisationsRouter.post("/categories", async (req, res) => {
  if (!canAccessCabinet(req.session)) return res.status(403).json({ error: "Accès non autorisé" });
  const parsed = categorieSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0].message });
  const v = parsed.data;
  const { rows } = await query(
    "insert into immo_categories (nom, taux, masse) values ($1, $2, $3) returning *",
    [v.nom, v.taux, v.masse],
  );
  logAction(req.session.nom, "creation", "balance", `Catégorie d'immobilisation « ${v.nom} »`);
  res.status(201).json(immoCategorieDto(rows[0]));
});

immobilisationsRouter.patch("/categories/:id", async (req, res) => {
  if (!canAccessCabinet(req.session)) return res.status(403).json({ error: "Accès non autorisé" });
  const parsed = categorieSchema.partial().safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0].message });
  const v = parsed.data;
  const { rows } = await query(
    `update immo_categories set
       nom = coalesce($2, nom),
       taux = coalesce($3, taux),
       masse = coalesce($4, masse),
       maj_le = now()
     where id = $1 returning *`,
    [req.params.id, v.nom ?? null, v.taux ?? null, v.masse ?? null],
  );
  if (!rows[0]) return res.status(404).json({ error: "Catégorie introuvable" });
  logAction(req.session.nom, "modification", "balance", "Catégorie d'immobilisation modifiée");
  res.json(immoCategorieDto(rows[0]));
});

immobilisationsRouter.delete("/categories/:id", async (req, res) => {
  if (!canAccessCabinet(req.session)) return res.status(403).json({ error: "Accès non autorisé" });
  try {
    await query("delete from immo_categories where id = $1", [req.params.id]);
    logAction(req.session.nom, "suppression", "balance", "Catégorie d'immobilisation supprimée");
    res.json({ ok: true });
  } catch (err) {
    if (err.code === "23503")
      return res.status(409).json({ error: "Des biens sont rattachés à cette catégorie — impossible de la supprimer." });
    throw err;
  }
});

// ── Biens (registre par société) ──────────────────
immobilisationsRouter.get("/biens", async (req, res) => {
  const societeId = req.query.societeId;
  if (!societeId) return res.status(400).json({ error: "societeId requis" });
  if (!canAccess(req.session, societeId))
    return res.status(403).json({ error: "Accès non autorisé" });
  const { rows } = await query(
    "select * from immo_biens where societe_id = $1 order by date_acquisition",
    [societeId],
  );
  res.json(rows.map(immoBienDto));
});

const bienSchema = z.object({
  societeId: z.string().uuid(),
  categorieId: z.string().uuid(),
  libelle: z.string().default(""),
  dateAcquisition: z.string().min(1, "Date d'acquisition requise"),
  coutAcquisition: z.coerce.number().default(0),
  taux: z.coerce.number().default(0),
  dateCession: z.string().nullable().default(null),
  valeurCession: z.coerce.number().default(0),
});

/** Import groupé — accepte un nom de catégorie en texte libre (comme
 * l'AFFECTAT des balances) : si elle existe déjà (recherche insensible à la
 * casse), on la réutilise ; sinon on la crée avec le taux/masse de la
 * première ligne qui la mentionne. N'écrase jamais les biens déjà
 * enregistrés — ajoute toujours de nouvelles lignes. */
const bulkBienSchema = z.object({
  societeId: z.string().uuid(),
  biens: z
    .array(
      z.object({
        categorieNom: z.string().min(1, "Catégorie requise"),
        masse: z.enum(["incorporelle", "corporelle"]).default("corporelle"),
        libelle: z.string().default(""),
        dateAcquisition: z.string().min(1, "Date d'acquisition requise"),
        coutAcquisition: z.coerce.number().default(0),
        taux: z.coerce.number().default(0),
      }),
    )
    .min(1),
});

immobilisationsRouter.post("/biens/bulk", async (req, res) => {
  const parsed = bulkBienSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0].message });
  const v = parsed.data;
  if (!canAccess(req.session, v.societeId))
    return res.status(403).json({ error: "Accès non autorisé" });

  const soc = (await query("select id from societes where id = $1", [v.societeId])).rows[0];
  if (!soc) return res.status(400).json({ error: "Société introuvable" });

  const created = await withTransaction(async (client) => {
    const out = [];
    for (const b of v.biens) {
      let cat = (
        await client.query("select * from immo_categories where lower(nom) = lower($1)", [b.categorieNom])
      ).rows[0];
      if (!cat) {
        cat = (
          await client.query(
            "insert into immo_categories (nom, taux, masse) values ($1, $2, $3) returning *",
            [b.categorieNom, b.taux, b.masse],
          )
        ).rows[0];
      }
      const row = (
        await client.query(
          `insert into immo_biens (societe_id, categorie_id, libelle, date_acquisition, cout_acquisition, taux)
           values ($1, $2, $3, $4, $5, $6) returning *`,
          [v.societeId, cat.id, b.libelle, b.dateAcquisition, b.coutAcquisition, b.taux || cat.taux],
        )
      ).rows[0];
      out.push(row);
    }
    return out;
  });
  logAction(req.session.nom, "import", "balance", `${created.length} bien(s) importé(s) dans le registre`);
  res.status(201).json(created.map(immoBienDto));
});

immobilisationsRouter.post("/biens", async (req, res) => {
  const parsed = bienSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0].message });
  const v = parsed.data;
  if (!canAccess(req.session, v.societeId))
    return res.status(403).json({ error: "Accès non autorisé" });

  const soc = (await query("select id from societes where id = $1", [v.societeId])).rows[0];
  if (!soc) return res.status(400).json({ error: "Société introuvable" });

  const { rows } = await query(
    `insert into immo_biens
       (societe_id, categorie_id, libelle, date_acquisition, cout_acquisition, taux, date_cession, valeur_cession)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     returning *`,
    [v.societeId, v.categorieId, v.libelle, v.dateAcquisition, v.coutAcquisition, v.taux, v.dateCession, v.valeurCession],
  );
  logAction(req.session.nom, "creation", "balance", `Immobilisation « ${v.libelle || "sans nom"} » ajoutée`);
  res.status(201).json(immoBienDto(rows[0]));
});

async function loadBienOrFail(id, session, res) {
  const bien = (await query("select * from immo_biens where id = $1", [id])).rows[0];
  if (!bien) {
    res.status(404).json({ error: "Bien introuvable" });
    return null;
  }
  if (!canAccess(session, bien.societe_id)) {
    res.status(403).json({ error: "Accès non autorisé" });
    return null;
  }
  return bien;
}

immobilisationsRouter.patch("/biens/:id", async (req, res) => {
  const existing = await loadBienOrFail(req.params.id, req.session, res);
  if (!existing) return;
  const parsed = bienSchema
    .omit({ societeId: true })
    .partial()
    .safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0].message });
  const v = parsed.data;

  const { rows } = await query(
    `update immo_biens set
       categorie_id = coalesce($2, categorie_id),
       libelle = coalesce($3, libelle),
       date_acquisition = coalesce($4, date_acquisition),
       cout_acquisition = coalesce($5, cout_acquisition),
       taux = coalesce($6, taux),
       date_cession = $7,
       valeur_cession = coalesce($8, valeur_cession),
       maj_le = now()
     where id = $1 returning *`,
    [
      req.params.id,
      v.categorieId ?? null,
      v.libelle ?? null,
      v.dateAcquisition ?? null,
      v.coutAcquisition ?? null,
      v.taux ?? null,
      v.dateCession !== undefined ? v.dateCession : existing.date_cession,
      v.valeurCession ?? null,
    ],
  );
  logAction(req.session.nom, "modification", "balance", `Immobilisation « ${rows[0].libelle || "sans nom"} » modifiée`);
  res.json(immoBienDto(rows[0]));
});

immobilisationsRouter.delete("/biens/:id", async (req, res) => {
  const existing = await loadBienOrFail(req.params.id, req.session, res);
  if (!existing) return;
  await query("delete from immo_biens where id = $1", [req.params.id]);
  logAction(req.session.nom, "suppression", "balance", `Immobilisation « ${existing.libelle || "sans nom"} » supprimée`);
  res.json({ ok: true });
});
