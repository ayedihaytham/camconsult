import { Router } from "express";
import { z } from "zod";
import { query, withTransaction } from "../db.js";
import { requireAuth, requireEquipeManager } from "../auth.js";
import { logAction } from "../journal.js";

export const coursChangeRouter = Router();
coursChangeRouter.use(requireAuth);

/** Lecture : l'équipe du cabinet (admin, responsable, collaborateurs) qui saisit les factures en devise — jamais le client d'une société. */
function equipeSeulement(req, res, next) {
  if (req.session.poste === "societe_employe") return res.status(403).json({ error: "Accès réservé à l'équipe du cabinet" });
  next();
}

const deviseDto = (r) => ({ code: r.code, libelle: r.libelle, unite: r.unite, ordre: r.ordre });
const coursDto = (r) => ({ devise: r.devise, annee: r.annee, mois: r.mois, cours: Number(r.cours) });

async function tout() {
  const [devises, cours] = await Promise.all([
    query("select * from devises_change order by ordre, code"),
    query("select * from cours_change order by annee, mois, devise"),
  ]);
  return { devises: devises.rows.map(deviseDto), cours: cours.rows.map(coursDto) };
}

// ── Lecture : devises et cours de toutes les années ───────────────────────────────────
coursChangeRouter.get("/", equipeSeulement, async (_req, res) => {
  res.json(await tout());
});

// ── Devises (ajout, modification, suppression) : admin ou responsable ─────────────────
const deviseSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Code devise sur 3 lettres (ex. CHF)"),
  libelle: z.string().trim().max(80).default(""),
  unite: z.coerce.number().int().min(1).max(1000000).default(1),
});

coursChangeRouter.post("/devises", requireEquipeManager, async (req, res) => {
  const parsed = deviseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const v = parsed.data;
  if (v.code === "TND") return res.status(400).json({ error: "Le dinar est la monnaie de référence" });
  const existe = (await query("select 1 from devises_change where code = $1", [v.code])).rowCount > 0;
  if (existe) return res.status(409).json({ error: `La devise ${v.code} existe déjà` });
  await query(
    "insert into devises_change (code, libelle, unite, ordre) values ($1,$2,$3,(select coalesce(max(ordre),0)+1 from devises_change))",
    [v.code, v.libelle, v.unite],
  );
  logAction(req.session.nom, "creation", "cours_change", `Devise ${v.code} ajoutée`, v.code);
  res.status(201).json(await tout());
});

coursChangeRouter.patch("/devises/:code", requireEquipeManager, async (req, res) => {
  const parsed = deviseSchema.partial({ code: true }).safeParse({ ...req.body, code: req.params.code });
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const v = parsed.data;
  const { rowCount } = await query("update devises_change set libelle = $2, unite = $3 where code = $1", [req.params.code.toUpperCase(), v.libelle, v.unite]);
  if (!rowCount) return res.status(404).json({ error: "Devise introuvable" });
  logAction(req.session.nom, "modification", "cours_change", `Devise ${req.params.code.toUpperCase()} modifiée`, req.params.code.toUpperCase());
  res.json(await tout());
});

coursChangeRouter.delete("/devises/:code", requireEquipeManager, async (req, res) => {
  const code = req.params.code.toUpperCase();
  const { rowCount } = await query("delete from devises_change where code = $1", [code]);
  if (!rowCount) return res.status(404).json({ error: "Devise introuvable" });
  logAction(req.session.nom, "suppression", "cours_change", `Devise ${code} supprimée avec ses cours`, code);
  res.json(await tout());
});

// ── Cours d'une année : remplacement des valeurs envoyées (null = effacer le cours du mois) ───
const anneeSchema = z.object({
  cours: z
    .array(
      z.object({
        devise: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
        mois: z.coerce.number().int().min(1).max(12),
        cours: z.coerce.number().positive().max(1000000).nullable(),
      }),
    )
    .max(2000),
});

coursChangeRouter.put("/:annee", requireEquipeManager, async (req, res) => {
  const annee = Number(req.params.annee);
  if (!Number.isInteger(annee) || annee < 1990 || annee > 2100) return res.status(400).json({ error: "Année invalide" });
  const parsed = anneeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Cours invalides : un cours est un nombre positif" });
  const connues = new Set((await query("select code from devises_change")).rows.map((r) => r.code));
  const inconnue = parsed.data.cours.find((c) => !connues.has(c.devise));
  if (inconnue) return res.status(400).json({ error: `Devise inconnue : ${inconnue.devise}` });

  await withTransaction(async (client) => {
    for (const c of parsed.data.cours) {
      if (c.cours === null) {
        await client.query("delete from cours_change where devise=$1 and annee=$2 and mois=$3", [c.devise, annee, c.mois]);
      } else {
        await client.query(
          `insert into cours_change (devise, annee, mois, cours) values ($1,$2,$3,$4)
           on conflict (devise, annee, mois) do update set cours = excluded.cours, maj_le = now()`,
          [c.devise, annee, c.mois, c.cours],
        );
      }
    }
  });
  logAction(req.session.nom, "modification", "cours_change", `Cours de change ${annee} : ${parsed.data.cours.length} valeur(s)`, String(annee));
  res.json(await tout());
});
