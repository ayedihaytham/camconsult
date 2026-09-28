import { Router } from "express";
import { z } from "zod";
import { query, withTransaction } from "../db.js";
import { requireAuth, requireAdmin } from "../auth.js";
import { logAction } from "../journal.js";
import { soucheChequeDto } from "../mappers.js";

/** État de souche de chèques — réservé à l'admin. */
export const soucheChequesRouter = Router();
soucheChequesRouter.use(requireAuth, requireAdmin);

const DEVISES = ["TND", "EUR", "USD"];

const ligneSchema = z.object({
  banque: z.string().trim().default(""),
  numCheque: z.string().trim().default(""),
  dateEmission: z.string().nullish(),
  beneficiaire: z.string().trim().default(""),
  motif: z.string().trim().default(""),
  montant: z.coerce.number().default(0),
  devise: z.enum(DEVISES).default("TND"),
  debite: z.boolean().default(false),
  dateDebit: z.string().nullish(),
});
const createSchema = ligneSchema.extend({ societeId: z.string().uuid() });

/** Un chèque non débité n'a pas de date de débit. */
const normaliser = (v) => ({
  ...v,
  dateEmission: v.dateEmission || null,
  dateDebit: v.debite ? v.dateDebit || null : null,
});

async function lignesFor(societeId) {
  const { rows } = await query(
    "select * from souche_cheques where societe_id = $1 order by ordre, cree_le",
    [societeId],
  );
  return rows.map(soucheChequeDto);
}

/** Même n° de chèque déjà saisi pour cette banque et cette société ? */
async function doublon(client, societeId, banque, numCheque, excludeId = null) {
  if (!numCheque) return false;
  const { rows } = await client.query(
    `select 1 from souche_cheques
      where societe_id = $1 and lower(banque) = lower($2) and n_cheque = $3
        and ($4::uuid is null or id <> $4::uuid) limit 1`,
    [societeId, banque, numCheque, excludeId],
  );
  return rows.length > 0;
}

const messageDoublon = (numCheque) =>
  `Le chèque n° ${numCheque} existe déjà pour cette banque.`;

soucheChequesRouter.get("/", async (req, res) => {
  const societeId = req.query.societeId;
  if (!societeId) return res.status(400).json({ error: "societeId requis" });
  res.json(await lignesFor(societeId));
});

soucheChequesRouter.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0].message });
  const v = normaliser(parsed.data);
  const soc = (
    await query("select raison_sociale from societes where id = $1", [v.societeId])
  ).rows[0];
  if (!soc) return res.status(400).json({ error: "Société introuvable" });
  if (await doublon({ query }, v.societeId, v.banque, v.numCheque))
    return res.status(409).json({ error: messageDoublon(v.numCheque) });

  const { rows: ordreRows } = await query(
    "select coalesce(max(ordre), 0) + 1 as n from souche_cheques where societe_id = $1",
    [v.societeId],
  );
  await query(
    `insert into souche_cheques
       (societe_id, ordre, banque, n_cheque, date_emission, beneficiaire, motif,
        montant, devise, debite, date_debit)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      v.societeId, ordreRows[0].n, v.banque, v.numCheque, v.dateEmission, v.beneficiaire,
      v.motif, v.montant, v.devise, v.debite, v.dateDebit,
    ],
  );
  logAction(
    req.session.nom, "creation", "souche_cheque",
    `Chèque ${v.numCheque || "—"} ${v.beneficiaire} — ${soc.raison_sociale}`,
  );
  res.status(201).json(await lignesFor(v.societeId));
});

// Import en masse depuis un fichier Excel (voir SoucheChequeImportDialog.tsx) :
// s'ajoute aux chèques existants ; un n° déjà présent pour la même banque
// (en base ou plus haut dans le fichier) est ignoré, jamais dupliqué.
soucheChequesRouter.post("/import", async (req, res) => {
  const parsed = z
    .object({ societeId: z.string().uuid(), lignes: z.array(ligneSchema).min(1) })
    .safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0].message });
  const { societeId, lignes } = parsed.data;
  const soc = (
    await query("select raison_sociale from societes where id = $1", [societeId])
  ).rows[0];
  if (!soc) return res.status(400).json({ error: "Société introuvable" });

  let importes = 0;
  let ignores = 0;
  await withTransaction(async (client) => {
    const { rows } = await client.query(
      "select coalesce(max(ordre), 0) as n from souche_cheques where societe_id = $1",
      [societeId],
    );
    let ordre = rows[0].n;
    for (const brut of lignes) {
      const v = normaliser(brut);
      if (await doublon(client, societeId, v.banque, v.numCheque)) {
        ignores += 1;
        continue;
      }
      ordre += 1;
      await client.query(
        `insert into souche_cheques
           (societe_id, ordre, banque, n_cheque, date_emission, beneficiaire, motif,
            montant, devise, debite, date_debit)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          societeId, ordre, v.banque, v.numCheque, v.dateEmission, v.beneficiaire,
          v.motif, v.montant, v.devise, v.debite, v.dateDebit,
        ],
      );
      importes += 1;
    }
  });
  logAction(
    req.session.nom, "creation", "souche_cheque",
    `Import ${importes} chèque(s) — ${soc.raison_sociale}`,
  );
  res.status(201).json({ lignes: await lignesFor(societeId), importes, ignores });
});

soucheChequesRouter.patch("/:id", async (req, res) => {
  const existing = (
    await query("select * from souche_cheques where id = $1", [req.params.id])
  ).rows[0];
  if (!existing) return res.status(404).json({ error: "Chèque introuvable" });
  const parsed = ligneSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0].message });
  const v = normaliser(parsed.data);
  if (await doublon({ query }, existing.societe_id, v.banque, v.numCheque, existing.id))
    return res.status(409).json({ error: messageDoublon(v.numCheque) });

  await query(
    `update souche_cheques set banque=$1, n_cheque=$2, date_emission=$3, beneficiaire=$4,
       motif=$5, montant=$6, devise=$7, debite=$8, date_debit=$9, maj_le=now()
     where id=$10`,
    [
      v.banque, v.numCheque, v.dateEmission, v.beneficiaire, v.motif, v.montant,
      v.devise, v.debite, v.dateDebit, req.params.id,
    ],
  );
  logAction(
    req.session.nom, "modification", "souche_cheque",
    `Chèque ${v.numCheque || "—"}${v.debite && !existing.debite ? " débité" : ""}`,
  );
  res.json(await lignesFor(existing.societe_id));
});

soucheChequesRouter.delete("/:id", async (req, res) => {
  const { rows } = await query(
    "delete from souche_cheques where id = $1 returning societe_id, n_cheque",
    [req.params.id],
  );
  if (!rows[0]) return res.status(404).json({ error: "Chèque introuvable" });
  logAction(req.session.nom, "suppression", "souche_cheque", `Chèque ${rows[0].n_cheque || "—"}`);
  res.json(await lignesFor(rows[0].societe_id));
});
