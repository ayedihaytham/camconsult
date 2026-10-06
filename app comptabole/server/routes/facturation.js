import { Router } from "express";
import { z } from "zod";
import { query, withTransaction } from "../db.js";
import { requireAuth, requireAdmin } from "../auth.js";
import { logAction } from "../journal.js";
import { factureDto, factureLigneDto } from "../mappers.js";

export const facturationRouter = Router();
facturationRouter.use(requireAuth, requireAdmin);

const STATUTS = ["emise", "payee", "annulee"];

const ligneSchema = z.object({
  description: z.string().trim().min(1, "Chaque ligne doit avoir une description"),
  quantite: z.coerce.number().positive("La quantité doit être positive").default(1),
  montantHt: z.coerce.number().min(0, "Le montant HT ne peut pas être négatif"),
});

const createSchema = z.object({
  societeId: z.string().uuid("Choisissez le client"),
  dateEmission: z.string().nullish(),
  echeance: z.string().nullish(),
  tvaTaux: z.coerce.number().min(0).max(100).default(19),
  timbre: z.coerce.number().min(0).default(1),
  note: z.string().default(""),
  lignes: z.array(ligneSchema).min(1, "Ajoutez au moins une ligne"),
});

const patchSchema = z.object({
  statut: z.enum(STATUTS).optional(),
  signee: z.boolean().optional(),
});

const SELECT = `select f.*, s.raison_sociale as societe_nom
                  from factures f join societes s on s.id = f.societe_id`;

async function charger(where, params) {
  const rows = (await query(`${SELECT} ${where} order by f.date_emission desc, f.numero desc`, params)).rows;
  if (rows.length === 0) return [];
  const lignes = (
    await query("select * from facture_lignes where facture_id = any($1::uuid[]) order by ordre", [
      rows.map((r) => r.id),
    ])
  ).rows;
  const parFacture = new Map();
  for (const l of lignes) parFacture.set(l.facture_id, [...(parFacture.get(l.facture_id) ?? []), factureLigneDto(l)]);
  return rows.map((r) => factureDto(r, parFacture.get(r.id) ?? []));
}

facturationRouter.get("/", async (_req, res) => {
  res.json(await charger("", []));
});

facturationRouter.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const v = parsed.data;
  const societe = (await query("select raison_sociale from societes where id = $1", [v.societeId])).rows[0];
  if (!societe) return res.status(404).json({ error: "Société introuvable" });

  const id = await withTransaction(async (client) => {
    // Numérotation séquentielle par année d'émission (AAAA-0001…), sans trou
    // ni doublon même avec deux créations simultanées.
    await client.query("select pg_advisory_xact_lock(hashtext('factures-numero'))");
    const emission = v.dateEmission || new Date().toISOString().slice(0, 10);
    const annee = emission.slice(0, 4);
    const { rows: suivant } = await client.query(
      `select coalesce(max(substring(numero from '[0-9]+$')::int), 0) + 1 as n
         from factures where numero like $1`,
      [`${annee}-%`],
    );
    const numero = `${annee}-${String(suivant[0].n).padStart(4, "0")}`;
    const { rows } = await client.query(
      `insert into factures (societe_id, numero, date_emission, echeance, tva_taux, timbre, note)
       values ($1,$2,$3::date,$4::date,$5,$6,$7) returning id`,
      [v.societeId, numero, emission, v.echeance || null, v.tvaTaux, v.timbre, v.note],
    );
    let i = 0;
    for (const l of v.lignes) {
      await client.query(
        "insert into facture_lignes (facture_id, ordre, description, quantite, montant_ht) values ($1,$2,$3,$4,$5)",
        [rows[0].id, i++, l.description, l.quantite, l.montantHt],
      );
    }
    return rows[0].id;
  });
  const [facture] = await charger("where f.id = $1", [id]);
  logAction(req.session.nom, "creation", "facture", `${facture.numero} — ${societe.raison_sociale}`, id);
  res.status(201).json(facture);
});

facturationRouter.patch("/:id", async (req, res) => {
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const v = parsed.data;
  const existante = (await query("select numero, statut from factures where id = $1", [req.params.id])).rows[0];
  if (!existante) return res.status(404).json({ error: "Facture introuvable" });
  if (existante.statut === "annulee") return res.status(409).json({ error: "Cette facture est annulée" });

  await query(
    `update factures set
       statut = coalesce($1, statut),
       paye_le = case when $1 = 'payee' then current_date when $1 = 'emise' then null else paye_le end,
       signee_le = case when $2::boolean is null then signee_le when $2 then coalesce(signee_le, now()) else null end,
       maj_le = now()
     where id = $3`,
    [v.statut ?? null, v.signee ?? null, req.params.id],
  );
  const [facture] = await charger("where f.id = $1", [req.params.id]);
  logAction(
    req.session.nom,
    "modification",
    "facture",
    `${existante.numero} — ${v.statut ?? (v.signee ? "signée" : "signature retirée")}`,
    req.params.id,
  );
  res.json(facture);
});
