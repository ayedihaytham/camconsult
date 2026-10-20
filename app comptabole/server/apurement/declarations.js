import { z } from "zod";
import { query } from "../db.js";
import { withApurementTransaction as withTransaction } from "./notifications.js";
import { company, get, dto, relation } from "./repository.js";
import {
  parse,
  uuid,
  periodSchema,
  text,
  day,
  fail,
  checkVersion,
} from "./domain.js";
import { manager } from "./permissions.js";
import { periodData } from "./controls.js";
import { audit, hash } from "./audit.js";
import { notifyInternal } from "./notifications.js";
import { exportExcel, exportPdf } from "./reports.js";
import { exportBcdTest, officialBcd } from "./bcd.js";
import { acteurSession } from "../acteurs.js";

async function newDraft(c, session, societeId, period, parentId = null) {
  await company(c, session, societeId, true);
  const draft = (
    await c.query(
      "select * from apurement_declarations where societe_id=$1 and annee=$2 and trimestre=$3 and statut<>'valide'",
      [societeId, period.annee, period.trimestre],
    )
  ).rows[0];
  if (draft) return draft;
  if (!parentId)
    parentId =
      (
        await c.query(
          "select id from apurement_declarations where societe_id=$1 and annee=$2 and trimestre=$3 and statut='valide' order by version desc limit 1",
          [societeId, period.annee, period.trimestre],
        )
      ).rows[0]?.id || null;
  const row = (
    await c.query(
      `insert into apurement_declarations(societe_id,annee,trimestre,version,supersede_declaration_id)
    select $1,$2,$3,coalesce(max(version),0)+1,$4 from apurement_declarations where societe_id=$1 and annee=$2 and trimestre=$3 returning *`,
      [societeId, period.annee, period.trimestre, parentId],
    )
  ).rows[0];
  await audit(c, session, societeId, "declaration.preparer", row.id, null, row);
  return row;
}
async function snapshot(c, session, declaration) {
  const data = await periodData(
    c,
    declaration.societe_id,
    declaration.annee,
    declaration.trimestre,
  );
  const profile = (
    await c.query(
      "select p.*,s.raison_sociale as societe_nom,s.tva as societe_mf from societes s left join apurement_profils_fiscaux p on p.societe_id=s.id where s.id=$1",
      [declaration.societe_id],
    )
  ).rows[0];
  const policy = (
    await c.query(
      "select * from apurement_politiques_calcul where societe_id=$1",
      [declaration.societe_id],
    )
  ).rows[0];
  const ids = [
    declaration.id,
    ...data.rows
      .flatMap((r) => [r.id, r.bc_id, r.autorisation_id])
      .filter(Boolean),
  ];
  const pieces = (
    await c.query(
      "select * from apurement_pieces_liens where societe_id=$1 and parent_id=any($2::uuid[]) order by id",
      [declaration.societe_id, ids],
    )
  ).rows;
  const missing = (
    await c.query(
      "select id,libelle from apurement_pieces_manquantes where societe_id=$1 and parent_id=any($2::uuid[]) and statut<>'validee'",
      [declaration.societe_id, ids],
    )
  ).rows;
  return {
    annee: declaration.annee,
    trimestre: declaration.trimestre,
    version: declaration.version,
    profil: profile?.donnees || {
      raisonSociale: profile?.societe_nom || "Profil fiscal à compléter",
      matriculeFiscal: profile?.societe_mf || "",
    },
    profilVerified: !!profile?.verified_at,
    politique: policy || null,
    lignes: data.rows,
    controls: data.controls,
    totals: data.totals,
    pieces,
    missing,
    generatedAt: new Date().toISOString(),
    generatedBy: acteurSession(session),
    provisoire: !policy,
  };
}
function ready(s) {
  if (!s.lignes.length)
    fail(422, "DECLARATION_VIDE", "Aucune facture pour ce trimestre.");
  const blockers = s.controls.filter((c) => c.severity === "blocage" || !c.ack);
  if (blockers.length || s.missing.length || !s.profilVerified)
    fail(
      422,
      "CONTROLES_NON_RESOLUS",
      "Compléter le profil fiscal, les justificatifs et les contrôles avant validation.",
      {
        controls: blockers,
        missing: s.missing,
        profilVerified: s.profilVerified,
      },
    );
}
function controlHash(s) {
  return hash({ ...s, generatedAt: undefined, generatedBy: undefined });
}
async function declarationProof(c, id, societeId, declarationId) {
  const p = await relation(c, "apurement_pieces_liens", id, societeId);
  if (p.parent_type !== "declaration" || p.parent_id !== declarationId)
    fail(
      422,
      "PREUVE_DEPOT",
      "Associer la preuve à cette déclaration avant enregistrement du dépôt.",
    );
  return p;
}
export function registerDeclarations(router) {
  router.get("/politique-calcul", async (req, res) => {
    const id = parse(uuid, req.query.societeId);
    await company({ query }, req.session, id);
    res.json(
      (
        await query(
          "select * from apurement_politiques_calcul where societe_id=$1",
          [id],
        )
      ).rows.map(dto),
    );
  });
  router.put("/politique-calcul", async (req, res) => {
    manager(req.session);
    const v = parse(
      z.object({
        societeId: uuid,
        mode: z.literal("demi_superieur_facture"),
        reference: text,
        preuveId: uuid,
        confirmer: z.literal(true),
      }),
      req.body,
    );
    res.json(
      await withTransaction(async (c) => {
        await company(c, req.session, v.societeId, true);
        await relation(c, "apurement_pieces_liens", v.preuveId, v.societeId);
        const before = (
          await c.query(
            "select * from apurement_politiques_calcul where societe_id=$1",
            [v.societeId],
          )
        ).rows[0];
        const row = (
          await c.query(
            `insert into apurement_politiques_calcul(societe_id,mode,reference,preuve_id,approved_by) values($1,$2,$3,$4,$5)
        on conflict(societe_id) do update set mode=excluded.mode,reference=excluded.reference,preuve_id=excluded.preuve_id,approved_by=excluded.approved_by,approved_at=now() returning *`,
            [
              v.societeId,
              v.mode,
              v.reference,
              v.preuveId,
              acteurSession(req.session),
            ],
          )
        ).rows[0];
        await audit(
          c,
          req.session,
          v.societeId,
          "calcul.approuver_regle_interne",
          row.id,
          before,
          row,
        );
        return dto(row);
      }),
    );
  });
  router.get("/declarations", async (req, res) => {
    const v = parse(periodSchema.extend({ societeId: uuid }), req.query);
    await company({ query }, req.session, v.societeId);
    const rows = (
      await query(
        `select d.id,d.societe_id,d.annee,d.trimestre,d.version,d.statut,d.snapshot_hash,d.approved_at,d.supersede_declaration_id,
      (select statut from apurement_depots p where p.declaration_id=d.id order by created_at desc,id desc limit 1) as depot
      from apurement_declarations d where societe_id=$1 and annee=$2 and trimestre=$3 order by version desc`,
        [v.societeId, v.annee, v.trimestre],
      )
    ).rows;
    res.json(rows.map(dto));
  });
  router.post("/declarations", async (req, res) => {
    const v = parse(periodSchema.extend({ societeId: uuid }), req.body);
    res
      .status(201)
      .json(
        dto(
          await withTransaction((c) =>
            newDraft(c, req.session, v.societeId, v),
          ),
        ),
      );
  });
  router.get("/declarations/:id", async (req, res) => {
    const d = await get(
      { query },
      req.session,
      "apurement_declarations",
      req.params.id,
    );
    const [exports, depots] = await Promise.all([
      query(
        "select id,type,hash,nom,source_hash,created_at from apurement_exports where declaration_id=$1 and societe_id=$2 order by created_at",
        [d.id, d.societe_id],
      ),
      query(
        "select * from apurement_depots where declaration_id=$1 and societe_id=$2 order by created_at,id",
        [d.id, d.societe_id],
      ),
    ]);
    const apercu =
      d.statut === "valide"
        ? null
        : await withTransaction(async (c) => {
            const current = await get(
              c,
              req.session,
              "apurement_declarations",
              d.id,
              true,
            );
            return snapshot(c, req.session, current);
          });
    res.json({
      ...dto(d),
      apercu,
      controlHash: apercu ? controlHash(apercu) : d.snapshot_hash,
      exports: exports.rows.map(dto),
      depots: depots.rows.map(dto),
    });
  });
  router.post("/declarations/:id/soumettre-validation", async (req, res) => {
    res.json(
      dto(
        await withTransaction(async (c) => {
          const d = await get(
            c,
            req.session,
            "apurement_declarations",
            req.params.id,
            true,
          );
          if (d.statut !== "brouillon")
            fail(
              409,
              "DECLARATION_ETAT",
              "Seul un brouillon peut être soumis.",
            );
          ready(await snapshot(c, req.session, d));
          const row = (
            await c.query(
              "update apurement_declarations set statut='pret_a_valider' where id=$1 returning *",
              [d.id],
            )
          ).rows[0];
          await audit(
            c,
            req.session,
            d.societe_id,
            "declaration.soumettre",
            d.id,
            d,
            row,
          );
          await notifyInternal(
            c,
            d.societe_id,
            "Déclaration à valider",
            `${d.annee} ${d.trimestre}`,
          );
          return row;
        }),
      ),
    );
  });
  router.post("/declarations/:id/valider", async (req, res) => {
    manager(req.session);
    const v = parse(
      z.object({
        motifEcart: z.string().max(2000).default(""),
        expectedControlHash: z.string().length(64).optional(),
      }),
      req.body,
    );
    res.json(
      dto(
        await withTransaction(async (c) => {
          const d = await get(
            c,
            req.session,
            "apurement_declarations",
            req.params.id,
            true,
          );
          if (d.statut !== "pret_a_valider")
            fail(
              409,
              "DECLARATION_ETAT",
              "Soumettre la déclaration avant validation.",
            );
          const s = await snapshot(c, req.session, d);
          ready(s);
          if (!s.politique)
            fail(
              423,
              "ARRONDI_NON_VALIDE",
              "B2 : une politique d’arrondi interne approuvée et documentée est requise. Aucun mode légal n’est présumé.",
            );
          if (v.expectedControlHash !== controlHash(s))
            fail(
              409,
              "CONTROLES_MODIFIES",
              "Les données diffèrent de l’aperçu affiché. Rechargez et vérifiez les montants avant validation.",
            );
          if (s.totals.ecart !== "0" && !v.motifEcart.trim())
            fail(
              422,
              "ECART_A_REVOIR",
              "Justifier l’écart entre somme détaillée et calcul global.",
            );
          s.motifEcart = v.motifEcart;
          s.approvedBy = acteurSession(req.session);
          s.approvedAt = new Date().toISOString();
          s.provisoire = false;
          const content = JSON.stringify(s),
            digest = hash(JSON.parse(content));
          const row = (
            await c.query(
              "update apurement_declarations set statut='valide',snapshot=$2,snapshot_hash=$3,approved_by=$4,approved_at=$5 where id=$1 returning *",
              [d.id, content, digest, s.approvedBy, s.approvedAt],
            )
          ).rows[0];
          await audit(
            c,
            req.session,
            d.societe_id,
            "declaration.valider",
            d.id,
            d,
            { hash: digest, approvedBy: s.approvedBy },
          );
          return row;
        }),
      ),
    );
  });
  router.post("/declarations/:id/rectifier", async (req, res) => {
    manager(req.session);
    res.status(201).json(
      dto(
        await withTransaction(async (c) => {
          const d = await get(
            c,
            req.session,
            "apurement_declarations",
            req.params.id,
            true,
          );
          if (d.statut !== "valide")
            fail(422, "SOURCE_NON_VALIDEE", "La source doit être validée.");
          return newDraft(c, req.session, d.societe_id, d, d.id);
        }),
      ),
    );
  });
  router.post("/declarations/:id/exports", async (req, res) => {
    const v = parse(
      z.object({ type: z.enum(["excel", "pdf", "bcd-test", "bcd-officiel"]) }),
      req.body,
    );
    if (v.type === "bcd-officiel") officialBcd();
    res.json(
      await withTransaction(async (c) => {
        const d = await get(
          c,
          req.session,
          "apurement_declarations",
          req.params.id,
          true,
        );
        const s =
          d.statut === "valide"
            ? d.snapshot
            : await snapshot(c, req.session, d);
        // Stable hash excludes transient generation time for repeat draft tests.
        const sourceHash =
          d.snapshot_hash || hash({ ...s, generatedAt: undefined });
        const prior = (
          await c.query(
            "select id,hash,nom,type from apurement_exports where declaration_id=$1 and type=$2 and source_hash=$3",
            [d.id, v.type, sourceHash],
          )
        ).rows[0];
        if (prior) return dto(prior);
        const content =
          v.type === "excel"
            ? await exportExcel(s)
            : v.type === "pdf"
              ? exportPdf(s)
              : exportBcdTest(s);
        const mime =
          v.type === "excel"
            ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            : v.type === "pdf"
              ? "application/pdf"
              : "text/plain";
        const ext =
          v.type === "excel" ? "xlsx" : v.type === "pdf" ? "pdf" : "bcd";
        const name = `${v.type === "bcd-test" ? "TEST_NON_OFFICIEL_" : d.statut === "valide" ? "INTERNE_" : "BROUILLON_NON_VALIDE_"}apurement_${d.annee}_${d.trimestre}_v${d.version}.${ext}`;
        const row = (
          await c.query(
            "insert into apurement_exports(societe_id,declaration_id,type,contenu,hash,nom,mime,source_hash) values($1,$2,$3,$4,$5,$6,$7,$8) returning id,hash,nom,type",
            [
              d.societe_id,
              d.id,
              v.type,
              content,
              hash(content),
              name,
              mime,
              sourceHash,
            ],
          )
        ).rows[0];
        await audit(
          c,
          req.session,
          d.societe_id,
          "export.generer",
          row.id,
          null,
          { type: v.type, sourceHash, hash: row.hash },
        );
        return dto(row);
      }),
    );
  });
  router.get("/exports/:id/telecharger", async (req, res) => {
    const e = await get(
      { query },
      req.session,
      "apurement_exports",
      req.params.id,
    );
    res
      .set({
        "Content-Type": e.mime,
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(e.nom)}`,
        "Cache-Control": "private, no-store",
        "X-Content-SHA256": e.hash,
      })
      .send(e.contenu);
  });
  router.post("/declarations/:id/depots", async (req, res) => {
    manager(req.session);
    const v = parse(
      z.object({ dateDepot: day, reference: text, preuveId: uuid }),
      req.body,
    );
    res.status(201).json(
      dto(
        await withTransaction(async (c) => {
          const d = await get(
            c,
            req.session,
            "apurement_declarations",
            req.params.id,
            true,
          );
          if (d.statut !== "valide")
            fail(
              422,
              "DECLARATION_NON_VALIDEE",
              "Déclaration validée requise.",
            );
          await declarationProof(c, v.preuveId, d.societe_id, d.id);
          const row = (
            await c.query(
              "insert into apurement_depots(societe_id,declaration_id,date_depot,reference,preuve_id,statut,acteur) values($1,$2,$3,$4,$5,'depose',$6) returning *",
              [
                d.societe_id,
                d.id,
                v.dateDepot,
                v.reference,
                v.preuveId,
                acteurSession(req.session),
              ],
            )
          ).rows[0];
          await audit(
            c,
            req.session,
            d.societe_id,
            "depot.enregistrer",
            row.id,
            null,
            row,
          );
          return row;
        }),
      ),
    );
  });
  router.patch("/depots/:id", async (req, res) => {
    manager(req.session);
    const v = parse(
      z.object({
        expectedVersion: z.number().int(),
        statut: z.enum(["accepte", "rejete"]),
        preuveId: uuid,
        motif: text,
      }),
      req.body,
    );
    res.json(
      dto(
        await withTransaction(async (c) => {
          const d = await get(
            c,
            req.session,
            "apurement_depots",
            req.params.id,
            true,
          );
          checkVersion(d, v.expectedVersion);
          if (d.statut !== "depose")
            fail(
              409,
              "DEPOT_FIGE",
              "Issue du dépôt déjà enregistrée : preuve conservée.",
            );
          await declarationProof(c, v.preuveId, d.societe_id, d.declaration_id);
          const row = (
            await c.query(
              "update apurement_depots set statut=$2,preuve_id=$3,motif=$4,version=version+1 where id=$1 returning *",
              [d.id, v.statut, v.preuveId, v.motif],
            )
          ).rows[0];
          await audit(
            c,
            req.session,
            d.societe_id,
            "depot.issue",
            d.id,
            d,
            row,
          );
          if (v.statut === "rejete") {
            const declaration = await relation(
              c,
              "apurement_declarations",
              d.declaration_id,
              d.societe_id,
            );
            await newDraft(
              c,
              req.session,
              d.societe_id,
              declaration,
              declaration.id,
            );
            await notifyInternal(
              c,
              d.societe_id,
              "Dépôt rejeté",
              "Une version rectificative a été préparée.",
            );
          }
          return row;
        }),
      ),
    );
  });
}
