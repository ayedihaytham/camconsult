// All arithmetic stays in integer millimes. JSON transports decimal strings.
const MAX = 9223372036854775807n;
export function millimes(value) {
  if (
    typeof value !== "string" ||
    !/^\d{1,19}$/.test(value) ||
    BigInt(value) > MAX
  )
    throw new Error("Montant attendu en millimes entiers positifs (chaîne).");
  return BigInt(value).toString();
}
export function parseTnd(value) {
  if (typeof value !== "string")
    throw new Error("Montant décimal texte requis.");
  const s = value.trim().replace(/[\u00a0\u202f ]/g, "");
  if (!/^\d+(?:[.,]\d{1,3})?$/.test(s))
    throw new Error(
      "Montant ambigu ou précision supérieure à trois décimales : revue requise.",
    );
  const [whole, decimal = ""] = s.split(/[.,]/);
  return millimes(
    (BigInt(whole) * 1000n + BigInt(decimal.padEnd(3, "0"))).toString(),
  );
}
export function formatTnd(value) {
  const n = BigInt(value);
  const abs = n < 0n ? -n : n;
  return `${n < 0n ? "-" : ""}${abs / 1000n}.${String(abs % 1000n).padStart(3, "0")}`;
}
export function calculateVat(ht, rate) {
  if (!Number.isInteger(rate) || rate < 0 || rate > 10000)
    throw new Error("Taux invalide.");
  // PROVISIONAL: half-up per invoice. No official rounding claim.
  return millimes(
    ((BigInt(millimes(ht)) * BigInt(rate) + 5000n) / 10000n).toString(),
  );
}
export function totals(rows) {
  let ht = 0n,
    vat = 0n,
    globalNumerator = 0n;
  for (const row of rows) {
    ht += BigInt(row.montant_ht_millimes);
    vat += BigInt(row.tva_suspendue_millimes);
    globalNumerator +=
      BigInt(row.montant_ht_millimes) * BigInt(row.taux_tva_bps);
  }
  const global = (globalNumerator + 5000n) / 10000n;
  return {
    ht: ht.toString(),
    tvaLignes: vat.toString(),
    tvaGlobale: global.toString(),
    ecart: (vat - global).toString(),
    provisoire: true,
  };
}
