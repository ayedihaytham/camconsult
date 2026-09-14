import { Router } from "express";
import { z } from "zod";
import { query, withTransaction } from "../db.js";
import { requireAuth, requireAdmin } from "../auth.js";
import { logAction } from "../journal.js";
import { bordereauDto, bordereauLigneDto } from "../mappers.js";

export const bordereauxRouter = Router();
bordereauxRouter.use(requireAuth, requireAdmin);

const TYPES = ["virement", "remise_traite", "remise_cheque"];
const VOLETS = ["client", "fournisseur"];

const ligneSchema = z.object({
  cheque: z.string().default(""),
  tiers: z.string().default(""),
  montant: z.coerce.number().default(0),
  facture: z.string().default(""),
  remarque: z.string().default(""),
});

const schema = z.object({
  type: z.enum(TYPES).default("remise_cheque"),
  volet: z.enum(VOLETS).default("client"),
  numero: z.string().default(""),
  dateOperation: z.string().nullish(),
  pointe: z.boolean().default(false),
  note: z.string().default(""),
  lignes: z.array(ligneSchema).default([]),
});

async function loadOne(id) {
  const b = (await query("select * from bordereaux where id = $1", [id])).rows[0];
  if (!b) return null;
  const lignes = (
    await query(
      "select * from bordereau_lignes where bordereau_id = $1 order by ordre",
      [id],
    )
  ).rows.map(bordereauLigneDto);
  return { ...bordereauDto(b), lignes };
}

bordereauxRouter.get("/", async (req, res) => {
  const clauses = [];
  const params = [];
  if (req.query.type && TYPES.includes(req.query.type)) {
    params.push(req.query.type);
    clauses.push(`type = $${params.length}`);
  }
  if (req.query.volet && VOLETS.includes(req.query.volet)) {
    params.push(req.query.volet);
    clauses.push(`volet = $${params.length}`);
  }
  if (req.query.annee) {
    params.push(Number(req.query.annee));
    clauses.push(`extract(year from date_operation) = $${params.length}`);
  }
  const where = clauses.length ? `where ${clauses.join(" and ")}` : "";
  const rows = (
    await query(
      `select * from bordereaux ${where} order by date_operation desc nulls last, cree_le desc`,
      params,
    )
  ).rows;
  const allLignes = (
    await query(
      "select * from bordereau_lignes where bordereau_id = any($1::uuid[]) order by ordre",
      [rows.map((r) => r.id)],
    )
  ).rows;
  const byBord = new Map();
  for (const l of allLignes) {
    byBord.set(l.bordereau_id, [
      ...(byBord.get(l.bordereau_id) ?? []),
      bordereauLigneDto(l),
    ]);
  }
  res.json(
    rows.map((r) => ({ ...bordereauDto(r), lignes: byBord.get(r.id) ?? [] })),
  );
});

bordereauxRouter.get("/:id", async (req, res) => {
  const b = await loadOne(req.params.id);
  if (!b) return res.status(404).json({ error: "Bordereau introuvable" });
  res.json(b);
});

async function writeLignes(client, bordereauId, lignes) {
  await client.query("delete from bordereau_lignes where bordereau_id = $1", [
    bordereauId,
  ]);
  let i = 0;
  for (const l of lignes) {
    await client.query(
      `insert into bordereau_lignes (bordereau_id, ordre, cheque, tiers, montant, facture, remarque)
       values ($1,$2,$3,$4,$5,$6,$7)`,
      [bordereauId, i, l.cheque, l.tiers, l.montant, l.facture, l.remarque],
    );
    i++;
  }
}

bordereauxRouter.post("/", async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0].message });
  const v = parsed.data;
  const id = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `insert into bordereaux (type, volet, numero, date_operation, pointe, note)
       values ($1,$2,$3,$4::date,$5,$6) returning id`,
      [v.type, v.volet, v.numero, v.dateOperation || null, v.pointe, v.note],
    );
    await writeLignes(client, rows[0].id, v.lignes);
    return rows[0].id;
  });
  logAction(
    req.session.nom,
    "creation",
    "bordereau",
    `${v.type} ${v.numero || ""}`.trim(),
  );
  res.status(201).json(await loadOne(id));
});

bordereauxRouter.patch("/:id", async (req, res) => {
  const existing = (
    await query("select * from bordereaux where id = $1", [req.params.id])
  ).rows[0];
  if (!existing) return res.status(404).json({ error: "Bordereau introuvable" });
  const parsed = schema.partial().safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0].message });
  const v = parsed.data;
  await withTransaction(async (client) => {
    await client.query(
      `update bordereaux set
         type = coalesce($1, type),
         volet = coalesce($2, volet),
         numero = coalesce($3, numero),
         date_operation = case when $4::text is null then date_operation else $4::date end,
         pointe = coalesce($5, pointe),
         note = coalesce($6, note),
         maj_le = now()
       where id = $7`,
      [
        v.type ?? null,
        v.volet ?? null,
        v.numero ?? null,
        v.dateOperation === undefined ? null : (v.dateOperation || null),
        v.pointe === undefined ? null : v.pointe,
        v.note ?? null,
        req.params.id,
      ],
    );
    if (v.lignes !== undefined)
      await writeLignes(client, req.params.id, v.lignes);
  });
  logAction(
    req.session.nom,
    "modification",
    "bordereau",
    `${existing.type} ${existing.numero || ""}`.trim(),
  );
  res.json(await loadOne(req.params.id));
});

bordereauxRouter.delete("/:id", async (req, res) => {
  const { rows } = await query(
    "delete from bordereaux where id = $1 returning type, numero",
    [req.params.id],
  );
  if (!rows[0]) return res.status(404).json({ error: "Bordereau introuvable" });
  logAction(
    req.session.nom,
    "suppression",
    "bordereau",
    `${rows[0].type} ${rows[0].numero || ""}`.trim(),
  );
  res.json({ ok: true });
});
