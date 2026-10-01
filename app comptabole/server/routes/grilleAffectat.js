import { Router } from "express";
import { z } from "zod";
import { query, withTransaction } from "../db.js";
import { requireAuth, requireAdmin } from "../auth.js";
import { canAccessFinanceSociete, canViewGlobalAffectat } from "../financeAccess.js";
import { logAction } from "../journal.js";
import { grilleAffectatCodeDto, grilleCompteDto, grilleCompteSocieteDto } from "../mappers.js";
import { renameAffectatCode } from "../affectatCodeRename.js";

export const grilleAffectatRouter = Router();
grilleAffectatRouter.use(requireAuth);

grilleAffectatRouter.get("/", async (req, res) => {
  if (!canViewGlobalAffectat(req.session))
    return res.status(403).json({ error: "Accès non autorisé" });
  const societeId = req.query.societeId;
  if (societeId !== undefined && (typeof societeId !== "string" || !societeId))
    return res.status(400).json({ error: "societeId invalide" });
  if (societeId && !canAccessFinanceSociete(req.session, societeId))
    return res.status(403).json({ error: "Accès non autorisé" });

  const codes = (await query("select * from grille_affectat_codes order by code")).rows;
  const comptes = (await query("select * from grille_comptes order by compte")).rows;
  const result = {
    codes: codes.map(grilleAffectatCodeDto),
    comptes: comptes.map(grilleCompteDto),
  };
  // Override par société (voir grille_comptes_societe) : consultés en
  // priorité côté frontend pour préremplir l'import d'une balance, sans
  // jamais changer le mapping cabinet-wide ci-dessus.
  if (societeId) {
    const comptesSociete = (
      await query(
        "select * from grille_comptes_societe where societe_id = $1 order by compte",
        [societeId],
      )
    ).rows;
    result.comptesSociete = comptesSociete.map(grilleCompteSocieteDto);
  }
  res.json(result);
});

const codeUpdateSchema = z.object({
  libelle: z.string().optional(),
  poste: z.string().optional(),
});

grilleAffectatRouter.patch("/codes/:code", requireAdmin, async (req, res) => {
  const parsed = codeUpdateSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0].message });
  const { libelle, poste } = parsed.data;
  const { rows } = await query(
    `insert into grille_affectat_codes (code, libelle, poste)
     values ($1, coalesce($2, ''), coalesce($3, ''))
     on conflict (code) do update set
       libelle = coalesce($2, grille_affectat_codes.libelle),
       poste   = coalesce($3, grille_affectat_codes.poste),
       maj_le  = now()
     returning *`,
    [req.params.code, libelle ?? null, poste ?? null],
  );
  logAction(req.session.nom, "modification", "balance", `Code ${req.params.code} mis à jour`);
  res.json(grilleAffectatCodeDto(rows[0]));
});

const renameSchema = z.object({ newCode: z.string().min(1, "Nouveau code requis") });

/** Renomme un code AFFECTAT partout (grille + comptes globaux et société + lignes de balance
 * déjà saisies). Si `newCode` existe déjà, ça fusionne les deux codes. */
grilleAffectatRouter.post("/codes/:code/rename", requireAdmin, async (req, res) => {
  const parsed = renameSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0].message });
  const oldCode = req.params.code;
  const newCode = parsed.data.newCode.trim();
  if (!newCode || newCode === oldCode)
    return res.status(400).json({ error: "Code invalide" });

  await withTransaction((client) => renameAffectatCode(client, oldCode, newCode));
  logAction(req.session.nom, "modification", "balance", `Code ${oldCode} → ${newCode}`);
  res.json({ ok: true });
});

grilleAffectatRouter.delete("/codes/:code", requireAdmin, async (req, res) => {
  await query("delete from grille_affectat_codes where code = $1", [req.params.code]);
  logAction(req.session.nom, "suppression", "balance", `Code ${req.params.code} retiré du référentiel`);
  res.json({ ok: true });
});
