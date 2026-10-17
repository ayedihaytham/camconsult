import { z } from "zod";
import { query } from "../db.js";
import { withApurementTransaction as withTransaction } from "./notifications.js";
import { company, get, dto, relation } from "./repository.js";
import { parse, uuid, text, day, fail, checkVersion } from "./domain.js";
import { audit, hash } from "./audit.js";
import { manager } from "./permissions.js";
import { notifyInternal } from "./notifications.js";

const parentTables = {
  autorisation: "apurement_autorisations",
  bc: "apurement_bons_commande",
  facture: "apurement_factures",
  declaration: "apurement_declarations",
  depot: "apurement_depots",
};
export async function parent(c, session, type, id, societeId) {
  if (!parentTables[type])
    fail(400, "PARENT_INVALIDE", "Type de dossier inconnu.");
  const row = await get(c, session, parentTables[type], id);
  if (row.societe_id !== societeId)
    fail(404, "PIECE_INTROUVABLE", "Dossier introuvable dans cette société.");
  return row;
}
export function decodeEvidence(dataUrl) {
  if (typeof dataUrl !== "string" || dataUrl.length > 11200000)
    fail(422, "PIECE_TROP_GRANDE", "Pièce limitée à 8 Mo.");
  const match =
    /^data:(application\/pdf|image\/png|image\/jpeg);base64,([A-Za-z0-9+/]+={0,2})$/.exec(
      dataUrl,
    );
  if (!match)
    fail(422, "FORMAT_PIECE", "PDF, PNG ou JPEG encodé en base64 requis.");
  const content = Buffer.from(match[2], "base64");
  if (
    !content.length ||
    content.length > 8388608 ||
    content.toString("base64") !== match[2]
  )
    fail(422, "FORMAT_PIECE", "Pièce invalide ou trop grande.");
  const signature =
    match[1] === "application/pdf"
      ? content.subarray(0, 5).toString() === "%PDF-"
      : match[1] === "image/png"
        ? content
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : content[0] === 255 && content[1] === 216 && content[2] === 255;
  if (!signature)
    fail(
      422,
      "SIGNATURE_PIECE",
      "Le contenu ne correspond pas au format annoncé.",
    );
  return { content, mime: match[1], hash: hash(content) };
}
export async function attach(c, session, v) {
  await company(c, session, v.societeId, true);
  await parent(c, session, v.parentType, v.parentId, v.societeId);
  let source;
  if (v.source === "collecte_fichier")
    source = (
      await c.query(
        `select f.nom,f.data_url from collecte_fichiers f join collectes c on c.id=f.collecte_id where f.id=$1 and c.societe_id=$2`,
        [v.sourceId, v.societeId],
      )
    ).rows[0];
  else if (v.source === "noeud")
    source = (
      await c.query(
        "select libelle as nom,data_url from noeuds where id=$1 and societe_id=$2 and type='fichier'",
        [v.sourceId, v.societeId],
      )
    ).rows[0];
  else if (v.source === "stock")
    source = (
      await c.query(
        "select achat_num_facture as nom,achat_doc_data_url as data_url from stock_mouvements where id=$1 and societe_id=$2",
        [v.sourceId, v.societeId],
      )
    ).rows[0];
  else if (v.source === "apurement_upload")
    source = { nom: v.nom, data_url: v.dataUrl };
  if (!source?.data_url)
    fail(
      404,
      "PIECE_INTROUVABLE",
      "Pièce source introuvable dans cette société.",
    );
  const evidence = decodeEvidence(source.data_url);
  await c.query(
    "insert into apurement_preuves(hash,contenu,mime,taille) values($1,$2,$3,$4) on conflict do nothing",
    [evidence.hash, evidence.content, evidence.mime, evidence.content.length],
  );
  const row = (
    await c.query(
      `insert into apurement_pieces_liens(societe_id,parent_type,parent_id,source,source_id,nom,preuve_hash) values($1,$2,$3,$4,$5,$6,$7) returning *`,
      [
        v.societeId,
        v.parentType,
        v.parentId,
        v.source,
        v.sourceId || null,
        String(source.nom || v.nom || "Justificatif").slice(0, 240),
        evidence.hash,
      ],
    )
  ).rows[0];
  await audit(c, session, v.societeId, "piece.associer", row.id, null, row);
  return dto(row);
}
const attachment = z.object({
  societeId: uuid,
  parentType: z.enum(["autorisation", "bc", "facture", "declaration", "depot"]),
  parentId: uuid,
  source: z.enum(["collecte_fichier", "noeud", "stock", "apurement_upload"]),
  sourceId: uuid.optional(),
  nom: z.string().max(240).optional(),
  dataUrl: z.string().max(11200000).optional(),
});
export function registerDocuments(router) {
  router.get("/pieces/sources", async (req, res) => {
    const societeId = parse(uuid, req.query.societeId);
    await company({ query }, req.session, societeId);
    const rows = (
      await query(
        `select f.id,'collecte_fichier' as source,f.nom from collecte_fichiers f join collectes c on c.id=f.collecte_id where c.societe_id=$1
      union all select id,'noeud',libelle from noeuds where societe_id=$1 and type='fichier' and data_url is not null
      union all select id,'stock',achat_num_facture from stock_mouvements where societe_id=$1 and achat_doc_data_url is not null
      order by nom,id limit 500`,
        [societeId],
      )
    ).rows;
    res.json(rows);
  });
  router.get("/pieces", async (req, res) => {
    const v = parse(
      attachment.pick({ societeId: true, parentType: true, parentId: true }),
      req.query,
    );
    await company({ query }, req.session, v.societeId);
    await parent({ query }, req.session, v.parentType, v.parentId, v.societeId);
    res.json(
      (
        await query(
          `select p.*,e.mime,e.taille,case p.source when 'apurement_upload' then true
            when 'collecte_fichier' then exists(select 1 from collecte_fichiers f join collectes c on c.id=f.collecte_id where f.id=p.source_id and c.societe_id=p.societe_id)
            when 'noeud' then exists(select 1 from noeuds n where n.id=p.source_id and n.societe_id=p.societe_id)
            when 'stock' then exists(select 1 from stock_mouvements m where m.id=p.source_id and m.societe_id=p.societe_id) else false end as source_disponible
            from apurement_pieces_liens p join apurement_preuves e on e.hash=p.preuve_hash where p.societe_id=$1 and p.parent_type=$2 and p.parent_id=$3 order by p.created_at,p.id`,
          [v.societeId, v.parentType, v.parentId],
        )
      ).rows.map(dto),
    );
  });
  router.post("/pieces", async (req, res) =>
    res
      .status(201)
      .json(
        await withTransaction((c) =>
          attach(c, req.session, parse(attachment, req.body)),
        ),
      ),
  );
  router.get("/pieces/:id/telecharger", async (req, res) => {
    const link = await get(
      { query },
      req.session,
      "apurement_pieces_liens",
      req.params.id,
    );
    const evidence = (
      await query("select contenu,mime from apurement_preuves where hash=$1", [
        link.preuve_hash,
      ])
    ).rows[0];
    res
      .set({
        "Content-Type": evidence.mime,
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(link.nom)}`,
        "Cache-Control": "private, no-store",
      })
      .send(evidence.contenu);
  });
  router.get("/pieces-manquantes", async (req, res) => {
    const societeId = parse(uuid, req.query.societeId);
    await company({ query }, req.session, societeId);
    res.json(
      (
        await query(
          "select * from apurement_pieces_manquantes where societe_id=$1 and ($2::uuid is null or parent_id=$2) order by echeance nulls last,id limit 500",
          [
            societeId,
            req.query.parentId ? parse(uuid, req.query.parentId) : null,
          ],
        )
      ).rows.map(dto),
    );
  });
  router.post("/pieces-manquantes", async (req, res) => {
    const v = parse(
      attachment
        .pick({ societeId: true, parentType: true, parentId: true })
        .extend({ libelle: text, echeance: day.nullable().default(null) }),
      req.body,
    );
    res.status(201).json(
      await withTransaction(async (c) => {
        await company(c, req.session, v.societeId, true);
        await parent(c, req.session, v.parentType, v.parentId, v.societeId);
        const row = (
          await c.query(
            `insert into apurement_pieces_manquantes(societe_id,parent_type,parent_id,libelle,echeance) values($1,$2,$3,$4,$5) returning *`,
            [v.societeId, v.parentType, v.parentId, v.libelle, v.echeance],
          )
        ).rows[0];
        await audit(
          c,
          req.session,
          v.societeId,
          "piece.manquante",
          row.id,
          null,
          row,
        );
        await notifyInternal(
          c,
          v.societeId,
          "Justificatif manquant",
          v.libelle,
        );
        return dto(row);
      }),
    );
  });
  router.patch("/pieces-manquantes/:id", async (req, res) => {
    const v = parse(
      z.object({
        expectedVersion: z.number().int(),
        statut: z.enum(["manquante", "demandee", "fournie", "validee"]),
      }),
      req.body,
    );
    if (v.statut === "validee") manager(req.session);
    res.json(
      await withTransaction(async (c) => {
        const before = await get(
          c,
          req.session,
          "apurement_pieces_manquantes",
          req.params.id,
          true,
        );
        checkVersion(before, v.expectedVersion);
        const row = (
          await c.query(
            "update apurement_pieces_manquantes set statut=$2,version=version+1 where id=$1 returning *",
            [before.id, v.statut],
          )
        ).rows[0];
        await audit(
          c,
          req.session,
          row.societe_id,
          "piece.statut",
          row.id,
          before,
          row,
        );
        return dto(row);
      }),
    );
  });
  router.post("/pieces-manquantes/:id/demander-collecte", async (req, res) => {
    const v = parse(
      z.object({ collecteId: uuid, confirmer: z.literal(true) }),
      req.body,
    );
    res.json(
      await withTransaction(async (c) => {
        const missing = await get(
          c,
          req.session,
          "apurement_pieces_manquantes",
          req.params.id,
          true,
        );
        if (missing.collecte_demande_id)
          return { demandeId: missing.collecte_demande_id };
        const collecte = await relation(
          c,
          "collectes",
          v.collecteId,
          missing.societe_id,
        );
        if (collecte.statut === "archive")
          fail(422, "COLLECTE_ARCHIVEE", "Choisir une collecte active.");
        const request = (
          await c.query(
            `insert into collecte_demandes_pieces(collecte_id,texte,demande_par,categorie) values($1,$2,$3,'fournisseur') returning id`,
            [
              collecte.id,
              "Merci de fournir le justificatif d’achat demandé par le cabinet.",
              req.session.nom,
            ],
          )
        ).rows[0];
        await c.query(
          "update apurement_pieces_manquantes set collecte_demande_id=$2,statut='demandee',version=version+1 where id=$1",
          [missing.id, request.id],
        );
        const clients = (
          await c.query(
            "select id from employes where role='societe_employe' and statut='actif' and societe_id=$1",
            [missing.societe_id],
          )
        ).rows;
        for (const client of clients) {
          await c.query(
            `insert into notifications(user_key,type,titre,corps,lien) values($1,'collecte','Pièce demandée par le cabinet','Un justificatif est demandé dans votre collecte.',$2)`,
            [client.id, `/collectes/${collecte.id}`],
          );
          c.apurementNotifications?.add(client.id);
        }
        await audit(
          c,
          req.session,
          missing.societe_id,
          "piece.demander_collecte",
          missing.id,
          missing,
          { demandeId: request.id, collecteId: collecte.id },
        );
        return { demandeId: request.id };
      }),
    );
  });
}
