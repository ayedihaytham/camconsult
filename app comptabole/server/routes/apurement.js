import { Router } from "express";
import { z } from "zod";
import { safeRouter } from "../asyncRoutes.js";
import { requireAuth, porteeSocietes } from "../auth.js";
import { query } from "../db.js";
import { withApurementTransaction as withTransaction } from "../apurement/notifications.js";
import { requireCabinet, manager } from "../apurement/permissions.js";
import {
  entities,
  createEntity,
  updateEntity,
  listEntities,
  get,
  dto,
  company,
} from "../apurement/repository.js";
import {
  parse,
  uuid,
  text,
  periodSchema,
  checkVersion,
  fail,
} from "../apurement/domain.js";
import { audit } from "../apurement/audit.js";
import { periodData } from "../apurement/controls.js";
import {
  syncToStock,
  linkStock,
  sourceState,
  stockState,
  frozenUsage,
} from "../apurement/stockLinkService.js";
import { registerDocuments } from "../apurement/documents.js";
import { registerReminders } from "../apurement/reminders.js";
import { registerImports } from "../apurement/imports.js";
import { registerDeclarations } from "../apurement/declarations.js";

export const apurementRouter = safeRouter(Router());
apurementRouter.use(requireAuth, requireCabinet);
registerDocuments(apurementRouter);
registerReminders(apurementRouter);
registerImports(apurementRouter);
registerDeclarations(apurementRouter);
for (const [kind, def] of Object.entries(entities)) {
  apurementRouter.get(`/${kind}`, async (req, res) =>
    res.json(await listEntities(req.session, kind, req.query)),
  );
  apurementRouter.get(`/${kind}/:id`, async (req, res) =>
    res.json(dto(await get({ query }, req.session, def.table, req.params.id))),
  );
  apurementRouter.post(`/${kind}`, async (req, res) =>
    res.status(201).json(dto(await createEntity(req.session, kind, req.body))),
  );
  apurementRouter.patch(`/${kind}/:id`, async (req, res) =>
    res.json(
      dto(
        await updateEntity(
          req.session,
          kind,
          req.params.id,
          kind === "factures"
            ? Object.fromEntries(
                Object.entries(req.body).filter(
                  ([k]) => k !== "confirmerMontantStock",
                ),
              )
            : req.body,
          kind === "factures"
            ? (c, s, b, a) =>
                syncToStock(c, s, b, a, {
                  confirmAmount: req.body.confirmerMontantStock === true,
                })
            : undefined,
        ),
      ),
    ),
  );
}
apurementRouter.get("/synthese", async (req, res) => {
  const period = parse(periodSchema, req.query),
    scope = porteeSocietes(req.session);
  const rows = (
    await query(
      `select s.id,s.raison_sociale,count(f.id)::int as factures,
    count(distinct f.bc_id)::int as bcs,coalesce(sum(f.montant_ht_millimes),0)::text as ht,
    coalesce(sum(f.tva_suspendue_millimes),0)::text as tva
    from societes s left join apurement_factures f on f.societe_id=s.id and f.annee=$1 and f.trimestre=$2 and not f.archived
    where ($3::uuid[] is null or s.id=any($3)) group by s.id order by s.raison_sociale,s.id`,
      [period.annee, period.trimestre, scope],
    )
  ).rows;
  res.json(rows.map(dto));
});
apurementRouter.get("/audit", async (req, res) => {
  const v = parse(
    z.object({
      societeId: uuid,
      entityId: uuid,
      page: z.coerce.number().int().min(1).default(1),
    }),
    req.query,
  );
  await company({ query }, req.session, v.societeId);
  res.json(
    (
      await query(
        `select a.id,a.acteur,a.action,a.avant,a.apres,a.created_at,case when a.acteur='admin' then 'Administrateur' else concat(e.prenom,' ',e.nom) end as nom_acteur
    from apurement_audit a left join employes e on e.id::text=a.acteur where a.societe_id=$1 and a.entity_id=$2 order by a.created_at desc,a.id limit 25 offset $3`,
        [v.societeId, v.entityId, (v.page - 1) * 25],
      )
    ).rows.map(dto),
  );
});
apurementRouter.get("/bcs/:id/rapprochement", async (req, res) => {
  const bc = await get(
    { query },
    req.session,
    "apurement_bons_commande",
    req.params.id,
  );
  const periods = (
    await query(
      `select annee,trimestre,count(*)::int as factures,sum(montant_ht_millimes)::text ht,sum(tva_suspendue_millimes)::text tva from apurement_factures where societe_id=$1 and bc_id=$2 and not archived group by annee,trimestre order by annee,trimestre`,
      [bc.societe_id, bc.id],
    )
  ).rows;
  const declarations = (
    await query(
      `select d.id,d.annee,d.trimestre,d.version,d.statut,
    (select statut from apurement_depots p where p.declaration_id=d.id order by created_at desc,id desc limit 1) as depot
    from apurement_declarations d where d.societe_id=$1 and d.statut='valide' and d.snapshot->'lignes' @> $2::jsonb order by d.annee,d.trimestre,d.version`,
      [bc.societe_id, JSON.stringify([{ bc_id: bc.id }])],
    )
  ).rows;
  res.json({
    bc: dto(bc),
    periodes: periods,
    declarations: declarations.map(dto),
  });
});
apurementRouter.get("/societes/:societeId/profil", async (req, res) => {
  const soc = await company({ query }, req.session, req.params.societeId);
  const row = (
    await query("select * from apurement_profils_fiscaux where societe_id=$1", [
      soc.id,
    ])
  ).rows[0];
  res.json(
    row
      ? {
          ...dto(row),
          differenceSociete:
            row.donnees.raisonSociale !== soc.raison_sociale ||
            row.donnees.matriculeFiscal !== soc.tva,
        }
      : {
          societeId: soc.id,
          version: 0,
          donnees: {
            raisonSociale: soc.raison_sociale,
            matriculeFiscal: soc.tva,
            adresse: soc.adresse,
          },
        },
  );
});
const profile = z.object({
  raisonSociale: text,
  matriculeFiscal: text,
  activite: z.string().max(240),
  ville: z.string().max(120),
  rue: z.string().max(240),
  numero: z.string().max(40),
  codePostal: z.string().max(20),
  adresse: z.string().max(500).optional(),
  reference: text,
});
apurementRouter.put("/societes/:societeId/profil", async (req, res) => {
  const v = parse(
    z.object({
      donnees: profile,
      expectedVersion: z.number().int().min(0),
      verifier: z.boolean().default(false),
    }),
    req.body,
  );
  if (v.verifier) manager(req.session);
  res.json(
    await withTransaction(async (c) => {
      await company(c, req.session, req.params.societeId, true);
      const before = (
        await c.query(
          "select * from apurement_profils_fiscaux where societe_id=$1 for update",
          [req.params.societeId],
        )
      ).rows[0];
      checkVersion(before || { version: 0 }, v.expectedVersion);
      const row = (
        await c.query(
          `insert into apurement_profils_fiscaux(societe_id,donnees,verified_by,verified_at)
      values($1,$2,$3,case when $3::text is null then null else now() end)
      on conflict(societe_id) do update set donnees=excluded.donnees,verified_by=excluded.verified_by,
      verified_at=excluded.verified_at,version=apurement_profils_fiscaux.version+1,updated_at=now() returning *`,
          [
            req.params.societeId,
            JSON.stringify(v.donnees),
            v.verifier ? req.session.employeId || "admin" : null,
          ],
        )
      ).rows[0];
      await audit(
        c,
        req.session,
        row.societe_id,
        "profil.modifier",
        row.id,
        before,
        row,
      );
      return dto(row);
    }),
  );
});
apurementRouter.get("/controles", async (req, res) => {
  const { societeId, ...period } = parse(
    periodSchema.extend({ societeId: uuid }),
    req.query,
  );
  await company({ query }, req.session, societeId);
  res.json(
    await withTransaction(async (c) => {
      await company(c, req.session, societeId, true);
      const data = await periodData(
        c,
        societeId,
        period.annee,
        period.trimestre,
      );
      const pagination = parse(
        z.object({
          page: z.coerce.number().int().min(1).default(1),
          size: z.coerce.number().int().min(1).max(100).default(100),
        }),
        req.query,
      );
      data.controls.sort(
        (a, b) =>
          (a.severity === "blocage" ? 0 : 1) -
            (b.severity === "blocage" ? 0 : 1) ||
          a.factureId.localeCompare(b.factureId) ||
          a.code.localeCompare(b.code),
      );
      return {
        controls: data.controls.slice(
          (pagination.page - 1) * pagination.size,
          pagination.page * pagination.size,
        ),
        total: data.controls.length,
        page: pagination.page,
        hasMore: pagination.page * pagination.size < data.controls.length,
        totals: data.totals,
        provisoire: true,
      };
    }),
  );
});
apurementRouter.post("/controles/:id/ack", async (req, res) => {
  const v = parse(
    z.object({ code: text, fingerprint: z.string().length(64), motif: text }),
    req.body,
  );
  manager(req.session);
  res.json(
    await withTransaction(async (c) => {
      const row = await get(
        c,
        req.session,
        "apurement_factures",
        req.params.id,
        true,
      );
      const data = await periodData(
        c,
        row.societe_id,
        row.annee,
        row.trimestre,
      );
      const control = data.controls.find(
        (x) =>
          x.factureId === row.id &&
          x.code === v.code &&
          x.fingerprint === v.fingerprint,
      );
      if (!control || control.severity !== "avertissement")
        fail(
          422,
          "CONTROLE_NON_ACQUITTABLE",
          "Contrôle bloquant ou données modifiées.",
        );
      await c.query(
        `insert into apurement_controles_ack(societe_id,facture_id,code,fingerprint,motif,acteur) values($1,$2,$3,$4,$5,$6) on conflict do nothing`,
        [
          row.societe_id,
          row.id,
          v.code,
          v.fingerprint,
          v.motif,
          req.session.employeId || "admin",
        ],
      );
      await audit(
        c,
        req.session,
        row.societe_id,
        "controle.revoir",
        row.id,
        null,
        v,
      );
      return { ok: true };
    }),
  );
});
apurementRouter.post("/stock/suggestions", async (req, res) => {
  const v = parse(
    z.object({
      societeId: uuid,
      page: z.number().int().min(1).default(1),
      size: z.number().int().min(1).max(100).default(25),
      q: z.string().max(120).default(""),
    }),
    req.body,
  );
  await company({ query }, req.session, v.societeId);
  const rows = (
    await query(
      `select m.id,m.societe_id,m.achat_num_facture as numero,m.fournisseur,to_char(m.achat_date,'YYYY-MM-DD') as date,
    (select count(*)::int from stock_lignes l where l.mouvement_id=m.id and l.categorie='achat') as lignes,
    coalesce((select sum(l.montant_tnd) from stock_lignes l where l.mouvement_id=m.id and l.categorie='achat'),m.achat_montant_tnd)::text ht,
    count(*) over()::int total from stock_mouvements m where m.societe_id=$1
    and (m.achat_num_facture<>'' or exists(select 1 from stock_lignes l where l.mouvement_id=m.id and l.categorie='achat'))
    and not exists(select 1 from apurement_factures f where f.stock_mouvement_id=m.id)
    and (m.achat_num_facture ilike $2 or m.fournisseur ilike $2)
    order by m.achat_date desc nulls last,m.id limit $3 offset $4`,
      [v.societeId, `%${v.q}%`, v.size, (v.page - 1) * v.size],
    )
  ).rows;
  const items = [];
  for (const row of rows) {
    try {
      items.push({
        ...dto(row),
        ...stockState(row),
        confidence: "a_confirmer",
      });
    } catch {
      items.push({
        ...dto(row),
        erreur: "Montant source à contrôler avant liaison.",
      });
    }
  }
  res.json({
    items,
    page: v.page,
    size: v.size,
    total: rows[0]?.total || 0,
    hasMore: v.page * v.size < (rows[0]?.total || 0),
  });
});
apurementRouter.get("/stock/:id", async (req, res) => {
  const m = await get(
    { query },
    req.session,
    "stock_mouvements",
    req.params.id,
  );
  const source = await sourceState({ query }, m.id, m.societe_id);
  if (!source.numero && !source.lignes)
    fail(
      422,
      "ACHAT_REQUIS",
      "Ce mouvement ne contient pas de facture d’achat.",
    );
  res.json(source);
});
const stockLink = z.object({
  bcId: uuid.optional(),
  expectedVersion: z.number().int().min(1),
  stockId: uuid,
  stockHash: z.string().length(64),
  resolution: z.enum(["stock", "apurement", "conflit"]),
  confirmer: z.literal(true),
});
for (const action of ["lier-stock", "synchroniser"])
  apurementRouter.post(`/factures/:id/${action}`, async (req, res) => {
    const v = parse(stockLink, req.body);
    res.json(
      dto(
        await withTransaction((c) =>
          linkStock(c, req.session, req.params.id, v),
        ),
      ),
    );
  });
apurementRouter.get("/factures/:id/stock", async (req, res) => {
  const f = await get(
    { query },
    req.session,
    "apurement_factures",
    req.params.id,
  );
  res.json(
    f.stock_mouvement_id
      ? await sourceState({ query }, f.stock_mouvement_id, f.societe_id)
      : null,
  );
});
apurementRouter.post("/factures/:id/delier-stock", async (req, res) => {
  const v = parse(
    z.object({ expectedVersion: z.number().int(), motif: text }),
    req.body,
  );
  res.json(
    dto(
      await withTransaction(async (c) => {
        const f = await get(
          c,
          req.session,
          "apurement_factures",
          req.params.id,
          true,
        );
        checkVersion(f, v.expectedVersion);
        if (await frozenUsage(c, f.id))
          fail(
            409,
            "SOURCE_FIGEE",
            "Facture utilisée dans une déclaration validée : déliaison interdite.",
          );
        const row = (
          await c.query(
            "update apurement_factures set stock_mouvement_id=null,stock_hash=null,conflit=null,version=version+1,updated_at=now() where id=$1 returning *",
            [f.id],
          )
        ).rows[0];
        await audit(c, req.session, f.societe_id, "stock.delier", f.id, f, {
          ...row,
          motif: v.motif,
        });
        return row;
      }),
    ),
  );
});
// Domain errors keep the existing API client's string error envelope.
export function apurementErrors(err, _req, res, _next) {
  const status =
    err.status ||
    (err.code === "23505"
      ? 409
      : ["23503", "23514", "22P02", "22003"].includes(err.code)
        ? 422
        : 500);
  if (status === 500) console.error("[apurement]", err);
  res.status(status).json({
    error:
      status === 500
        ? "Erreur Apurement. Aucune modification partielle enregistrée."
        : err.status
          ? err.message
          : "Contrainte de données ou référence invalide.",
    code: err.status ? err.code : "CONTRAINTE_DONNEES",
    fields: err.fields,
  });
}
apurementRouter.use(apurementErrors);
