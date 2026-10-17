export function tnd(value: string | undefined | null): string {
  if (value == null) return "—";
  const n = BigInt(value),
    abs = n < 0n ? -n : n;
  return `${n < 0n ? "−" : ""}${(abs / 1000n).toLocaleString("fr-TN")},${String(abs % 1000n).padStart(3, "0")} TND`;
}
export function inputTnd(value: string): string {
  const s = value.trim().replace(/[\s\u00a0]/g, "");
  if (!/^\d+(?:[.,]\d{1,3})?$/.test(s))
    throw new Error(
      "Saisissez un montant positif avec trois décimales au maximum.",
    );
  const [a, b = ""] = s.split(/[.,]/);
  return (BigInt(a) * 1000n + BigInt(b.padEnd(3, "0"))).toString();
}
export function decimalTnd(value?: string | null): string {
  if (value == null) return "";
  const n = BigInt(value);
  return `${n / 1000n}.${String(n % 1000n).padStart(3, "0")}`;
}
export function inputRate(value: string): number {
  const s = value.trim();
  if (!/^\d{1,3}(?:[.,]\d{1,2})?$/.test(s))
    throw new Error(
      "Taux en pourcentage attendu, avec deux décimales au maximum.",
    );
  const [a, b = ""] = s.split(/[.,]/);
  const bps = BigInt(a) * 100n + BigInt(b.padEnd(2, "0"));
  if (bps > 10000n) throw new Error("Taux entre 0 et 100 % requis.");
  return Number(bps);
}
export function displayRate(bps?: number): string {
  if (bps === undefined) return "";
  const fractional = String(bps % 100)
    .padStart(2, "0")
    .replace(/0+$/, "");
  return `${Math.floor(bps / 100)}${fractional ? "." + fractional : ""}`;
}
