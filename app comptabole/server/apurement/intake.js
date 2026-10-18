import { z } from "zod";
import { uuid, text, day, parse, fail } from "./domain.js";
import { entities, company, relation, saveEntity, get } from "./repository.js";
import { withApurementTransaction } from "./notifications.js";
import { audit, hash } from "./audit.js";

const intake = z
  .object({
    societeId: uuid,
    requestId: uuid,
    fournisseur: z.union([
      uuid,
      entities.fournisseurs.schema.omit({
        societeId: true,
        matriculeFiscalNormalise: true,
      }),
    ]),
    bc: z
      .union([
        uuid,
        z
          .object({
            numero: text,
            dateBc: day.nullable(),
            autorisation: z.union([
              uuid,
              entities.autorisations.schema.omit({ societeId: true }),
            ]),
          })
          .strict(),
      ])
      .nullable(),
    facture: z.record(z.unknown()),
  })
  .strict();

// One company lock and transaction for the entire entry; the existing domain
// validators and audit remain authoritative for each entity and financial value.
export async function enterPurchase(session, input) {
  const v = parse(intake, input);
  return withApurementTransaction(async (c) => {
    await company(c, session, v.societeId, true);
    const inputHash = hash(v);
    const prior = (
      await c.query(
        "select entity_id,apres from apurement_audit where societe_id=$1 and action='achat.saisir' and apres->>'requestId'=$2 limit 1",
        [v.societeId, v.requestId],
      )
    ).rows[0];
    if (prior) {
      if (prior.apres.inputHash !== inputHash)
        fail(
          409,
          "SAISIE_DEJA_ENREGISTREE",
          "Cette saisie a déjà été enregistrée. Rechargez la liste avant de la modifier.",
        );
      return get(c, session, "apurement_factures", prior.entity_id);
    }
    const supplier =
      typeof v.fournisseur === "string"
        ? await relation(
            c,
            "apurement_fournisseurs",
            v.fournisseur,
            v.societeId,
          )
        : await saveEntity(c, session, "fournisseurs", {
            ...v.fournisseur,
            societeId: v.societeId,
          });
    let bc = null;
    if (typeof v.bc === "string")
      bc = await relation(c, "apurement_bons_commande", v.bc, v.societeId);
    else if (v.bc) {
      const authorization =
        typeof v.bc.autorisation === "string"
          ? await relation(
              c,
              "apurement_autorisations",
              v.bc.autorisation,
              v.societeId,
            )
          : await saveEntity(c, session, "autorisations", {
              ...v.bc.autorisation,
              societeId: v.societeId,
            });
      bc = await saveEntity(c, session, "bcs", {
        societeId: v.societeId,
        fournisseurId: supplier.id,
        autorisationId: authorization.id,
        numero: v.bc.numero,
        dateBc: v.bc.dateBc,
      });
    }
    const invoice = await saveEntity(c, session, "factures", {
      ...v.facture,
      societeId: v.societeId,
      fournisseurId: supplier.id,
      bcId: bc?.id || null,
    });
    await audit(c, session, v.societeId, "achat.saisir", invoice.id, null, {
      requestId: v.requestId,
      inputHash,
    });
    return invoice;
  });
}
