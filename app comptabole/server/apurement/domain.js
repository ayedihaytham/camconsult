import { z } from "zod";
import { millimes, calculateVat } from "./amounts.js";

export function fail(status, code, message, fields) {
  throw Object.assign(new Error(message), { status, code, fields });
}
export const uuid = z.string().uuid();
export const text = z.string().trim().min(1).max(240);
export const amount = z.string().refine((v) => {
  try {
    millimes(v);
    return true;
  } catch {
    return false;
  }
}, "Millimes invalides");
export const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(`${v}T12:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, "Date invalide");
export const periodSchema = z.object({
  annee: z.coerce.number().int().min(2000).max(2100),
  trimestre: z.enum(["T1", "T2", "T3", "T4"]),
});
export const invoiceSchema = z
  .object({
    societeId: uuid,
    bcId: uuid.nullable().default(null),
    fournisseurId: uuid,
    numeroFacture: text,
    dateFacture: day.nullable().default(null),
    datePrecision: z.enum(["day", "month", "unknown"]).default("unknown"),
    dateBrute: z.string().max(80).default(""),
    objet: z.string().max(2000).default(""),
    montantHtMillimes: amount,
    tauxTvaBps: z.number().int().min(0).max(10000),
    tvaMode: z.enum(["auto", "manuel"]).default("auto"),
    tvaSuspendueMillimes: amount.optional(),
    motifCorrection: z.string().max(2000).default(""),
    annee: z.number().int().min(2000).max(2100),
    trimestre: z.enum(["T1", "T2", "T3", "T4"]),
    motifPeriode: z.string().max(2000).default(""),
  })
  .strict()
  .superRefine((v, ctx) => {
    if ((v.datePrecision === "day") !== Boolean(v.dateFacture))
      ctx.addIssue({
        code: "custom",
        message: "Date complète et précision incohérentes.",
      });
    if (
      v.datePrecision === "month" &&
      !/^(0[1-9]|1[0-2])\/\d{4}$/.test(v.dateBrute)
    )
      ctx.addIssue({
        code: "custom",
        message: "Mois brut attendu sous MM/AAAA.",
      });
    if (
      v.tvaMode === "manuel" &&
      (!v.motifCorrection.trim() || v.tvaSuspendueMillimes === undefined)
    )
      ctx.addIssue({
        code: "custom",
        message: "TVA manuelle : montant et justification obligatoires.",
      });
  });
export function invoiceValues(v) {
  const calculated = calculateVat(v.montantHtMillimes, v.tauxTvaBps);
  return {
    ...v,
    tvaCalculeeMillimes: calculated,
    tvaSuspendueMillimes:
      v.tvaMode === "auto" ? calculated : v.tvaSuspendueMillimes,
  };
}
export function parse(schema, input) {
  const result = schema.safeParse(input);
  if (!result.success)
    fail(
      400,
      "ENTREE_INVALIDE",
      result.error.issues[0].message,
      result.error.flatten(),
    );
  return result.data;
}
export function checkVersion(row, version) {
  if (!Number.isInteger(version) || version !== row.version)
    fail(
      409,
      "CONFLIT_VERSION",
      "Les données ont changé. Rechargez avant de réessayer.",
    );
}
