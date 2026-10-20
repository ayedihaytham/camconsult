import { z } from "zod";
import { query } from "../db.js";
import { withApurementTransaction as withTransaction } from "./notifications.js";
import { porteeSocietes } from "../auth.js";
import { notifyInternal } from "./notifications.js";
import { audit, lockCompany } from "./audit.js";
import { scope } from "./permissions.js";
import {
  amount,
  day,
  text,
  uuid,
  parse,
  fail,
  checkVersion,
  invoiceSchema,
  invoiceValues,
} from "./domain.js";
import { acteurSession } from "../acteurs.js";

export const entities = {
  autorisations: {
    table: "apurement_autorisations",
    schema: z
      .object({
        societeId: uuid,
        numero: text,
        dateDebut: day.nullable().default(null),
        dateFin: day.nullable().default(null),
        plafondHtMillimes: amount.nullable().default(null),
        plafondTvaMillimes: amount.nullable().default(null),
        statutInterne: z
          .enum(["brouillon", "active", "fermee", "annulee"])
          .default("brouillon"),
      })
      .strict(),
  },
  fournisseurs: {
    table: "apurement_fournisseurs",
    schema: z
      .object({
        societeId: uuid,
        raisonSociale: text,
        matriculeFiscalRaw: z.string().max(80).default(""),
        matriculeFiscalNormalise: z
          .string()
          .trim()
          .min(1)
          .max(80)
          .nullable()
          .default(null),
        aliases: z.array(z.string().max(240)).max(30).default([]),
      })
      .strict(),
  },
  bcs: {
    table: "apurement_bons_commande",
    schema: z
      .object({
        societeId: uuid,
        autorisationId: uuid,
        fournisseurId: uuid,
        numero: text,
        dateBc: day.nullable().default(null),
        description: z.string().max(2000).default(""),
        plafondHtMillimes: amount.nullable().default(null),
      })
      .strict(),
  },
  factures: { table: "apurement_factures", schema: invoiceSchema },
};
const snake = (s) => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
export const camel = (s) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
export function dto(row) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      camel(key),
      value instanceof Date
        ? key.startsWith("date_")
          ? `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`
          : value.toISOString()
        : value,
    ]),
  );
}
export async function company(client, session, id, lock = false) {
  scope(session, parse(uuid, id));
  if (lock) await lockCompany(client, id);
  const row = (await client.query("select * from societes where id=$1", [id]))
    .rows[0];
  if (!row) fail(404, "INTROUVABLE", "Société introuvable.");
  return row;
}
export async function get(client, session, table, id, lock = false) {
  parse(uuid, id);
  // Scope SQL before serialization, including guessed identifiers.
  const row = (
    await client.query(
      `select * from ${table} where id=$1 and ($2::uuid[] is null or societe_id=any($2))`,
      [id, porteeSocietes(session)],
    )
  ).rows[0];
  if (!row) fail(404, "INTROUVABLE", "Enregistrement introuvable.");
  scope(session, row.societe_id);
  if (lock) {
    await lockCompany(client, row.societe_id);
    return (
      await client.query(
        `select * from ${table} where id=$1 and societe_id=$2 for update`,
        [id, row.societe_id],
      )
    ).rows[0];
  }
  return row;
}
export async function relation(client, table, id, societeId) {
  if (!id) return null;
  const row = (
    await client.query(`select * from ${table} where id=$1 and societe_id=$2`, [
      id,
      societeId,
    ])
  ).rows[0];
  if (!row)
    fail(
      422,
      "REFERENCE_INVALIDE",
      "Référence absente ou d’une autre société.",
    );
  return row;
}
export async function validateRelations(client, kind, v) {
  if (v.fournisseurId)
    await relation(
      client,
      entities.fournisseurs.table,
      v.fournisseurId,
      v.societeId,
    );
  if (v.autorisationId)
    await relation(
      client,
      entities.autorisations.table,
      v.autorisationId,
      v.societeId,
    );
  if (kind === "factures" && v.bcId) {
    const bc = await relation(client, entities.bcs.table, v.bcId, v.societeId);
    if (bc.fournisseur_id !== v.fournisseurId)
      fail(422, "FOURNISSEUR_BC", "Le fournisseur doit être celui du BC.");
  }
}
export async function saveEntity(
  client,
  session,
  kind,
  input,
  existing = null,
) {
  const def = entities[kind];
  let v = parse(def.schema, input);
  await company(client, session, v.societeId, true);
  await validateRelations(client, kind, v);
  if (kind === "factures") v = invoiceValues(v);
  if (
    kind === "autorisations" &&
    v.dateDebut &&
    v.dateFin &&
    v.dateDebut > v.dateFin
  )
    fail(422, "VALIDITE", "Fin de validité antérieure au début.");
  const entries = Object.entries(v);
  const columns = entries.map(([k]) => snake(k));
  const values = entries.map(([k, value]) =>
    k === "aliases" ? JSON.stringify(value) : value,
  );
  let row;
  if (existing) {
    if (existing.societe_id !== v.societeId)
      fail(422, "SOCIETE_IMMUABLE", "La société ne peut pas être réaffectée.");
    row = (
      await client.query(
        `update ${def.table} set ${columns.map((c, i) => `${c}=$${i + 2}`).join(",")},version=version+1,updated_at=now() where id=$1 returning *`,
        [existing.id, ...values],
      )
    ).rows[0];
  } else {
    if (kind === "factures") {
      columns.push("created_by");
      values.push(acteurSession(session));
    }
    row = (
      await client.query(
        `insert into ${def.table} (${columns.join(",")}) values (${values.map((_, i) => `$${i + 1}`).join(",")}) returning *`,
        values,
      )
    ).rows[0];
  }
  await audit(
    client,
    session,
    v.societeId,
    `${kind}.${existing ? "modifier" : "creer"}`,
    row.id,
    existing,
    row,
  );
  if (existing) {
    const field = {
      factures: "id",
      bcs: "bc_id",
      fournisseurs: "fournisseur_id",
      autorisations: "autorisation_id",
    }[kind];
    const frozen = (
      await client.query(
        `select id from apurement_declarations where societe_id=$1 and statut='valide' and snapshot->'lignes' @> $2::jsonb limit 1`,
        [row.societe_id, JSON.stringify([{ [field]: row.id }])],
      )
    ).rows[0];
    if (frozen)
      await notifyInternal(
        client,
        row.societe_id,
        "Modification après validation",
        "Les données courantes divergent d’une version figée. Vérifier la nécessité d’une rectificative.",
      );
  }
  return row;
}
export async function createEntity(session, kind, input) {
  return withTransaction((c) => saveEntity(c, session, kind, input));
}
export async function updateEntity(session, kind, id, input, beforeSave) {
  return withTransaction(async (c) => {
    const existing = await get(c, session, entities[kind].table, id, true);
    checkVersion(existing, input.expectedVersion);
    const { expectedVersion: _version, ...patch } = input;
    const current = dto(existing);
    const schemaKeys =
      kind === "factures"
        ? invoiceSchema._def.schema.shape
        : entities[kind].schema.shape;
    const allowed = Object.fromEntries(
      Object.keys(schemaKeys).map((k) => [k, current[k]]),
    );
    const row = await saveEntity(
      c,
      session,
      kind,
      { ...allowed, ...patch },
      existing,
    );
    if (beforeSave) await beforeSave(c, session, existing, row);
    return row;
  });
}
export async function listEntities(session, kind, input) {
  const societeId = parse(uuid, input.societeId);
  scope(session, societeId);
  const page = parse(
    z.coerce.number().int().min(1).max(100000).default(1),
    input.page,
  );
  const size = parse(
    z.coerce.number().int().min(1).max(100).default(25),
    input.size,
  );
  const values = [societeId];
  const filters = ["societe_id=$1"];
  const add = (sql, value) => {
    values.push(value);
    filters.push(sql.replace("?", `$${values.length}`));
  };
  if (input.q)
    add(
      `${kind === "fournisseurs" ? "raison_sociale" : kind === "factures" ? "numero_facture" : "numero"} ilike ?`,
      `%${String(input.q).slice(0, 120)}%`,
    );
  if (kind === "bcs" && input.autorisationId)
    add("autorisation_id=?", parse(uuid, input.autorisationId));
  if (kind === "factures") {
    filters.push("not archived");
    if (input.source)
      add(
        "source=?",
        parse(z.enum(["manuel", "stock", "import"]), input.source),
      );
    if (input.bcId) add("bc_id=?", parse(uuid, input.bcId));
    if (input.annee)
      add("annee=?", parse(z.coerce.number().int(), input.annee));
    if (input.trimestre)
      add(
        "trimestre=?",
        parse(z.enum(["T1", "T2", "T3", "T4"]), input.trimestre),
      );
  }
  const where = filters.join(" and ");
  const total = (
    await query(
      `select count(*)::int n from ${entities[kind].table} where ${where}`,
      values,
    )
  ).rows[0].n;
  const items = (
    await query(
      `select * from ${entities[kind].table} where ${where} order by updated_at desc,id limit $${values.length + 1} offset $${values.length + 2}`,
      [...values, size, (page - 1) * size],
    )
  ).rows.map(dto);
  return { items, page, size, total, hasMore: page * size < total };
}
