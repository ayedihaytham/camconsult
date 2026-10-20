import { Worker } from "node:worker_threads";
import { z } from "zod";
import { query } from "../db.js";
import { withApurementTransaction as withTransaction } from "./notifications.js";
import { company, get, saveEntity, relation, dto } from "./repository.js";
import { parse, uuid, periodSchema, fail, checkVersion } from "./domain.js";
import { syncToStock } from "./stockLinkService.js";
import { hash, audit } from "./audit.js";
import { parseBcd } from "./bcd.js";
import { calculateVat } from "./amounts.js";
import { acteurSession } from "../acteurs.js";
const cleanMf = (value) =>
  String(value || "")
    .replace(/\s+/g, "")
    .toUpperCase();

export function validateWorkbook(bytes, extension) {
  if (bytes.length < 8 || bytes.length > 10485760)
    fail(422, "IMPORT_TAILLE", "Fichier vide ou supérieur à 10 Mo.");
  if (extension === "xls") {
    if (
      !bytes
        .subarray(0, 8)
        .equals(Buffer.from([208, 207, 17, 224, 161, 177, 26, 225]))
    )
      fail(422, "IMPORT_SIGNATURE", "Signature XLS/OLE invalide.");
    return;
  }
  if (extension !== "xlsx" || bytes.readUInt32LE(0) !== 0x04034b50)
    fail(422, "IMPORT_SIGNATURE", "Signature XLSX invalide.");
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--)
    if (bytes.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  if (eocd < 0) fail(422, "IMPORT_ZIP", "Archive ZIP tronquée.");
  const count = bytes.readUInt16LE(eocd + 10);
  let pos = bytes.readUInt32LE(eocd + 16),
    total = 0;
  if (count > 2000 || count === 65535)
    fail(
      422,
      "IMPORT_ZIP",
      "Archive trop complexe ou ZIP64 non pris en charge.",
    );
  for (let i = 0; i < count; i++) {
    if (pos + 46 > eocd || bytes.readUInt32LE(pos) !== 0x02014b50)
      fail(422, "IMPORT_ZIP", "Annuaire ZIP invalide.");
    const compressed = bytes.readUInt32LE(pos + 20),
      size = bytes.readUInt32LE(pos + 24);
    total += size;
    if (
      size > 8388608 ||
      total > 33554432 ||
      size > Math.max(1024, compressed * 200)
    )
      fail(422, "IMPORT_ZIP", "Archive décompressée trop grande.");
    pos +=
      46 +
      bytes.readUInt16LE(pos + 28) +
      bytes.readUInt16LE(pos + 30) +
      bytes.readUInt16LE(pos + 32);
  }
}
let activeWorkers = 0;
export async function parseWorkbook(bytes, extension) {
  validateWorkbook(bytes, extension);
  if (activeWorkers >= 2)
    fail(
      429,
      "IMPORT_OCCUPE",
      "Deux lectures Excel sont déjà en cours. Réessayez après leur fin.",
    );
  activeWorkers++;
  return new Promise((resolve, reject) => {
    let worker;
    try {
      worker = new Worker(new URL("./importWorker.js", import.meta.url), {
        workerData: bytes,
        execArgv: [],
        resourceLimits: {
          maxOldGenerationSizeMb: 128,
          maxYoungGenerationSizeMb: 32,
        },
      });
    } catch (error) {
      activeWorkers--;
      reject(error);
      return;
    }
    let settled = false;
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      error ? reject(error) : resolve(result);
    };
    const timer = setTimeout(() => {
      finish(
        Object.assign(
          new Error("Lecture Excel interrompue après 10 secondes."),
          { status: 422, code: "IMPORT_DELAI" },
        ),
      );
      void worker.terminate();
    }, 10000);
    worker.once("message", (result) => {
      finish(
        result.error
          ? Object.assign(new Error(result.error), {
              status: 422,
              code: "IMPORT_EXCEL",
            })
          : null,
        result,
      );
      void worker.terminate();
    });
    worker.once("error", (error) =>
      finish(Object.assign(error, { status: 422, code: "IMPORT_EXCEL" })),
    );
    worker.once("exit", () => {
      activeWorkers--;
      if (!settled)
        finish(
          Object.assign(new Error("Lecture Excel arrêtée."), {
            status: 422,
            code: "IMPORT_EXCEL",
          }),
        );
    });
  });
}
const previewInput = periodSchema.extend({
  societeId: uuid,
  nom: z.string().max(240),
  contenuBase64: z.string().max(13981016),
  tauxTvaBps: z.number().int().min(0).max(10000),
});
export function registerImports(router) {
  router.post("/imports/preview", async (req, res) => {
    const v = parse(previewInput, req.body);
    const targetSociete = await company({ query }, req.session, v.societeId);
    const bytes = Buffer.from(v.contenuBase64, "base64");
    if (bytes.toString("base64") !== v.contenuBase64)
      fail(422, "IMPORT_BASE64", "Encodage invalide.");
    const checksum = hash(bytes);
    const prior = (
      await query(
        "select id,preview,committed_at,rapport from apurement_imports where societe_id=$1 and hash=$2",
        [v.societeId, checksum],
      )
    ).rows[0];
    if (prior?.committed_at)
      return res.json({
        batchId: prior.id,
        previewHash: hash(prior.preview),
        ...prior.preview,
        alreadyCommitted: !!prior.committed_at,
        rapport: prior.rapport,
      });
    const ext = v.nom.split(".").at(-1).toLowerCase();
    const data = ["xls", "xlsx"].includes(ext)
      ? await parseWorkbook(bytes, ext)
      : parseBcd(bytes);
    const fiscal = (
      await query(
        "select donnees from apurement_profils_fiscaux where societe_id=$1",
        [v.societeId],
      )
    ).rows[0];
    const targetMf = fiscal?.donnees?.matriculeFiscal || targetSociete.tva;
    if (
      data.profil?.matriculeFiscal &&
      targetMf &&
      cleanMf(data.profil.matriculeFiscal) !== cleanMf(targetMf)
    )
      data.warnings.push({
        code: "IDENTITE_DECLARANT_DIFFERENTE",
        message:
          "Le matricule du déclarant source diffère de celui du dossier choisi. Vérifier la société et justifier la décision ; le profil n’est pas écrasé.",
      });
    if (
      data.annee &&
      (data.annee !== v.annee || data.trimestre !== v.trimestre)
    )
      fail(
        422,
        "IMPORT_PERIODE",
        "La période du BCD diffère de la période choisie.",
      );
    const suppliers = (
      await query(
        "select id,raison_sociale,matricule_fiscal_raw,matricule_fiscal_normalise from apurement_fournisseurs where societe_id=$1",
        [v.societeId],
      )
    ).rows;
    const invoices = (
      await query(
        "select id,version,bc_id,fournisseur_id,annee,trimestre,montant_ht_millimes as ht,tva_suspendue_millimes as tva,numero_facture,to_char(date_facture,'YYYY-MM-DD') as date from apurement_factures where societe_id=$1 and lower(trim(numero_facture))=any($2::text[]) and not archived",
        [
          v.societeId,
          [
            ...new Set(
              data.rows.map((r) => r.numeroFacture.trim().toLowerCase()),
            ),
          ],
        ],
      )
    ).rows;
    const supplierKey = (mf, name) =>
      JSON.stringify([String(mf).trim(), String(name).trim().toLowerCase()]);
    const incomingKey = (r) =>
      JSON.stringify([
        supplierKey(r.fournisseurMf, r.fournisseur),
        r.numeroFacture.trim().toLowerCase(),
        r.dateFacture || null,
      ]);
    const supplierMap = new Map();
    for (const supplier of suppliers) {
      const key = supplierKey(
        supplier.matricule_fiscal_raw,
        supplier.raison_sociale,
      );
      supplierMap.set(key, [...(supplierMap.get(key) || []), supplier]);
    }
    const supplierIdsByMf = new Map();
    for (const s of suppliers)
      for (const value of [
        s.matricule_fiscal_raw,
        s.matricule_fiscal_normalise,
      ]) {
        const mf = cleanMf(value);
        if (mf) {
          if (!supplierIdsByMf.has(mf)) supplierIdsByMf.set(mf, new Set());
          supplierIdsByMf.get(mf).add(s.id);
        }
      }
    const invoicesByNumber = new Map();
    for (const f of invoices) {
      const key = f.numero_facture.trim().toLowerCase();
      invoicesByNumber.set(key, [...(invoicesByNumber.get(key) || []), f]);
    }
    const incomingCounts = new Map();
    for (const r of data.rows) {
      const key = incomingKey(r);
      incomingCounts.set(key, (incomingCounts.get(key) || 0) + 1);
    }
    for (const row of data.rows) {
      row.errors ||= [];
      row.warnings = [];
      const candidates =
        supplierMap.get(supplierKey(row.fournisseurMf, row.fournisseur)) || [];
      row.fournisseurId = candidates.length === 1 ? candidates[0].id : null;
      if (candidates.length > 1)
        row.errors.push(
          "Plusieurs fournisseurs correspondants : rapprocher manuellement.",
        );
      row.matches = (
        invoicesByNumber.get(row.numeroFacture.trim().toLowerCase()) || []
      ).filter(
        (f) =>
          (f.fournisseur_id === row.fournisseurId ||
            supplierIdsByMf
              .get(cleanMf(row.fournisseurMf))
              ?.has(f.fournisseur_id)) &&
          f.numero_facture.trim().toLowerCase() ===
            row.numeroFacture.trim().toLowerCase() &&
          (f.date === row.dateFacture || !f.date || !row.dateFacture),
      );
      row.duplicate = row.matches.length > 0;
      row.duplicate ||= incomingCounts.get(incomingKey(row)) > 1;
      if (row.duplicate) row.warnings.push("DOUBLON_POSSIBLE");
      if (row.datePrecision !== "day") row.warnings.push("DATE_INCOMPLETE");
      if (
        row.montantHtMillimes &&
        row.tvaSuspendueMillimes &&
        calculateVat(row.montantHtMillimes, v.tauxTvaBps) !==
          row.tvaSuspendueMillimes
      )
        row.warnings.push("TVA_MANUELLE");
    }
    const preview = {
      ...data,
      annee: v.annee,
      trimestre: v.trimestre,
      tauxTvaBps: v.tauxTvaBps,
    };
    let batch = (
      await query(
        `insert into apurement_imports(societe_id,hash,profile,raw,preview,created_by) values($1,$2,$3,$4,$5,$6)
      on conflict(societe_id,hash) do update set preview=case when apurement_imports.committed_at is null then excluded.preview else apurement_imports.preview end,
      expires_at=now()+interval '30 minutes' where apurement_imports.committed_at is null returning id,preview`,
        [
          v.societeId,
          checksum,
          data.profile,
          bytes,
          JSON.stringify(preview),
          acteurSession(req.session),
        ],
      )
    ).rows[0];
    if (!batch)
      batch = (
        await query(
          "select id,preview from apurement_imports where societe_id=$1 and hash=$2",
          [v.societeId, checksum],
        )
      ).rows[0];
    // Hash the database-normalized JSON, whose key ordering is stable on re-read.
    res.json({
      batchId: batch.id,
      previewHash: hash(batch.preview),
      ...batch.preview,
    });
  });
  router.post("/imports/:id/commit", async (req, res) => {
    const v = parse(
      z.object({
        previewHash: z.string().length(64),
        motifEcartPied: z.string().max(2000).default(""),
        rows: z
          .array(
            z.object({
              row: z.number().int(),
              bcId: uuid.optional(),
              motif: z.string().max(2000).optional(),
              updateFactureId: uuid.optional(),
              expectedVersion: z.number().int().min(1).optional(),
            }),
          )
          .min(1)
          .max(2000),
      }),
      req.body,
    );
    res.json(
      await withTransaction(async (c) => {
        const batch = await get(
          c,
          req.session,
          "apurement_imports",
          req.params.id,
          true,
        );
        if (batch.committed_at) return batch.rapport;
        if (new Date(batch.expires_at) < new Date())
          fail(
            409,
            "IMPORT_EXPIRE",
            "Aperçu expiré : demander un nouvel aperçu.",
          );
        if (hash(batch.preview) !== v.previewHash)
          fail(409, "IMPORT_MODIFIE", "Aperçu différent de celui revu.");
        if (
          batch.preview.warnings.some((w) =>
            ["BCD_ECART_PIED", "IDENTITE_DECLARANT_DIFFERENTE"].includes(
              w.code,
            ),
          ) &&
          !v.motifEcartPied.trim()
        )
          fail(
            422,
            "IMPORT_REVUE_SOURCE",
            "Les écarts du document source doivent être explicitement revus et justifiés avant import.",
          );
        if (new Set(v.rows.map((x) => x.row)).size !== v.rows.length)
          fail(422, "IMPORT_SELECTION", "Lignes sélectionnées en double.");
        const rapport = [];
        const updateTargets = v.rows
          .map((r) => r.updateFactureId)
          .filter(Boolean);
        if (new Set(updateTargets).size !== updateTargets.length)
          fail(
            422,
            "IMPORT_CIBLE_DOUBLE",
            "Une facture ne peut être mise à jour qu’une fois par lot.",
          );
        for (const decision of v.rows) {
          const row = batch.preview.rows.find((r) => r.row === decision.row);
          if (!row || row.errors.length)
            fail(
              422,
              "IMPORT_LIGNE",
              "Corriger ou exclure les lignes invalides avant import.",
            );
          if (row.duplicate && !decision.motif?.trim())
            fail(
              422,
              "IMPORT_DOUBLON",
              "Doublon possible : justification explicite requise.",
            );
          let target = null;
          if (decision.updateFactureId) {
            if (
              !row.matches?.some(
                (m) =>
                  m.id === decision.updateFactureId &&
                  m.version === decision.expectedVersion,
              )
            )
              fail(
                422,
                "IMPORT_CIBLE",
                "La cible de mise à jour doit provenir de l’aperçu revu.",
              );
            if (!decision.motif?.trim())
              fail(
                422,
                "IMPORT_MOTIF_MAJ",
                "Justifier explicitement la mise à jour de la facture existante.",
              );
            target = await get(
              c,
              req.session,
              "apurement_factures",
              decision.updateFactureId,
              true,
            );
            checkVersion(target, decision.expectedVersion);
            if (target.societe_id !== batch.societe_id || target.archived)
              fail(422, "IMPORT_CIBLE", "Cible hors du dossier actif.");
          }
          let fournisseurId = target?.fournisseur_id || row.fournisseurId;
          let bcId = decision.bcId || target?.bc_id;
          if (target && !bcId) {
            const supplier = await relation(
              c,
              "apurement_fournisseurs",
              fournisseurId,
              batch.societe_id,
            );
            if (
              ![
                supplier.matricule_fiscal_raw,
                supplier.matricule_fiscal_normalise,
              ].some(
                (value) =>
                  cleanMf(value) &&
                  cleanMf(value) === cleanMf(row.fournisseurMf),
              )
            )
              fail(
                422,
                "IMPORT_IDENTITE",
                "Le fournisseur de la facture cible ne correspond pas au matricule de la source.",
              );
          }
          if (bcId) {
            const chosenBc = await relation(
              c,
              "apurement_bons_commande",
              bcId,
              batch.societe_id,
            );
            const chosenSupplier = await relation(
              c,
              "apurement_fournisseurs",
              chosenBc.fournisseur_id,
              batch.societe_id,
            );
            const mf = (value) =>
              String(value || "")
                .replace(/\s+/g, "")
                .toUpperCase();
            if (
              !mf(row.fournisseurMf) ||
              ![
                chosenSupplier.matricule_fiscal_raw,
                chosenSupplier.matricule_fiscal_normalise,
              ]
                .map(mf)
                .includes(mf(row.fournisseurMf))
            )
              fail(
                422,
                "IMPORT_IDENTITE",
                "Le fournisseur du BC choisi ne correspond pas au matricule de la source. Corriger ou rapprocher l’identité avant import.",
              );
            const chosenAuthorization = await relation(
              c,
              "apurement_autorisations",
              chosenBc.autorisation_id,
              batch.societe_id,
            );
            const differs =
              row.bcNumero !== chosenBc.numero ||
              row.autorisation !== chosenAuthorization.numero ||
              row.dateBc !== dto(chosenBc).dateBc ||
              ![chosenSupplier.raison_sociale, ...chosenSupplier.aliases].some(
                (n) =>
                  n.trim().toLowerCase() ===
                  row.fournisseur.trim().toLowerCase(),
              );
            if (differs && !decision.motif?.trim())
              fail(
                422,
                "IMPORT_RAPPROCHEMENT",
                "Justifier les différences avec le BC et le fournisseur choisis.",
              );
            fournisseurId = chosenSupplier.id;
          }
          if (!fournisseurId) {
            const matches = (
              await c.query(
                "select id from apurement_fournisseurs where societe_id=$1 and raison_sociale=$2 and matricule_fiscal_raw=$3",
                [batch.societe_id, row.fournisseur, row.fournisseurMf],
              )
            ).rows;
            if (matches.length > 1)
              fail(422, "IMPORT_FOURNISSEUR", "Identité ambiguë.");
            fournisseurId =
              matches[0]?.id ||
              (
                await saveEntity(c, req.session, "fournisseurs", {
                  societeId: batch.societe_id,
                  raisonSociale: row.fournisseur,
                  matriculeFiscalRaw: row.fournisseurMf,
                })
              ).id;
          }
          if (!bcId) {
            let authorizations = (
              await c.query(
                "select * from apurement_autorisations where societe_id=$1 and numero=$2",
                [batch.societe_id, row.autorisation],
              )
            ).rows;
            if (authorizations.length > 1)
              fail(
                422,
                "IMPORT_AUTORISATION",
                "Autorisation ambiguë : associer un BC existant.",
              );
            const authorization =
              authorizations[0] ||
              (await saveEntity(c, req.session, "autorisations", {
                societeId: batch.societe_id,
                numero: row.autorisation,
              }));
            const bcs = (
              await c.query(
                "select * from apurement_bons_commande where societe_id=$1 and autorisation_id=$2 and fournisseur_id=$3 and numero=$4",
                [
                  batch.societe_id,
                  authorization.id,
                  fournisseurId,
                  row.bcNumero,
                ],
              )
            ).rows;
            if (bcs.length > 1)
              fail(
                422,
                "IMPORT_BC",
                "BC ambigu : choisir explicitement le BC.",
              );
            bcId =
              bcs[0]?.id ||
              (
                await saveEntity(c, req.session, "bcs", {
                  societeId: batch.societe_id,
                  autorisationId: authorization.id,
                  fournisseurId,
                  numero: row.bcNumero,
                  dateBc: row.dateBc,
                })
              ).id;
          }
          const duplicateNow = (
            await c.query(
              `select f.id from apurement_factures f join apurement_fournisseurs s on s.id=f.fournisseur_id and s.societe_id=f.societe_id
            join apurement_fournisseurs chosen on chosen.id=$2 and chosen.societe_id=$1 where f.societe_id=$1 and not f.archived
            and (f.fournisseur_id=$2 or (chosen.matricule_fiscal_normalise is not null and s.matricule_fiscal_normalise=chosen.matricule_fiscal_normalise))
            and lower(trim(f.numero_facture))=$3 and ($4::date is null or f.date_facture is null or f.date_facture=$4)
            and ($5::uuid is null or f.id<>$5) limit 1`,
              [
                batch.societe_id,
                fournisseurId,
                row.numeroFacture.trim().toLowerCase(),
                row.dateFacture,
                target?.id || null,
              ],
            )
          ).rows[0];
          if (duplicateNow && !row.duplicate)
            fail(
              409,
              "IMPORT_DONNEES_MODIFIEES",
              "Une facture correspondante est apparue depuis l’aperçu. Relancer le rapprochement avant import.",
            );
          const calculated = calculateVat(
              row.montantHtMillimes,
              batch.preview.tauxTvaBps,
            ),
            manual = calculated !== row.tvaSuspendueMillimes;
          if (manual && !decision.motif?.trim())
            fail(
              422,
              "IMPORT_TVA",
              "TVA différente du calcul provisoire : justifier avant import.",
            );
          const invoice = await saveEntity(
            c,
            req.session,
            "factures",
            {
              societeId: batch.societe_id,
              bcId,
              fournisseurId,
              numeroFacture: row.numeroFacture,
              dateFacture: row.dateFacture,
              datePrecision: row.datePrecision,
              dateBrute: row.dateBrute,
              objet: row.objet,
              montantHtMillimes: row.montantHtMillimes,
              tauxTvaBps: batch.preview.tauxTvaBps,
              tvaMode: manual ? "manuel" : "auto",
              tvaSuspendueMillimes: row.tvaSuspendueMillimes,
              motifCorrection: manual ? decision.motif : "",
              annee: batch.preview.annee,
              trimestre: batch.preview.trimestre,
              motifPeriode: target?.motif_periode || "",
            },
            target,
          );
          if (target) await syncToStock(c, req.session, target, invoice);
          await c.query(
            "update apurement_factures set source=case when stock_mouvement_id is null then 'import' else source end,import_id=$2 where id=$1",
            [invoice.id, batch.id],
          );
          rapport.push({
            row: row.row,
            factureId: invoice.id,
            action: target ? "mis_a_jour" : "cree",
            version: invoice.version,
            warnings: row.warnings,
          });
        }
        await c.query(
          "update apurement_imports set committed_at=now(),rapport=$2,revue=$3 where id=$1",
          [
            batch.id,
            JSON.stringify(rapport),
            JSON.stringify({
              motifEcartPied: v.motifEcartPied,
              sourceWarnings: batch.preview.warnings,
              acteur: acteurSession(req.session),
            }),
          ],
        );
        await audit(
          c,
          req.session,
          batch.societe_id,
          "import.valider",
          batch.id,
          null,
          {
            hash: batch.hash,
            decisions: v.rows,
            motifEcartPied: v.motifEcartPied,
            rapport,
          },
        );
        return rapport;
      }),
    );
  });
  router.get("/imports/:id/rapport", async (req, res) => {
    const b = await get(
      { query },
      req.session,
      "apurement_imports",
      req.params.id,
    );
    res.json({
      id: b.id,
      hash: b.hash,
      committedAt: b.committed_at,
      rapport: b.rapport,
      revue: b.revue,
      rows: b.preview.rows.map(({ raw: _, ...r }) => r),
    });
  });
}
