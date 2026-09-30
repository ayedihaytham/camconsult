/** Cellule Excel/CSV → date « AAAA-MM-JJ » : vraie date (lecture avec
 * `cellDates: true`), numéro de série Excel, « 2026-09-24 » ou « 24/09/2026 ».
 * null si illisible. */
export function toDateString(v: unknown): string | null {
  const pad = (n: number) => String(n).padStart(2, "0");
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null;
    return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
  }
  if (typeof v === "number") {
    // Numéro de série Excel (1900) — plage plausible 1982…2119.
    if (v < 30000 || v > 80000) return null;
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }
  const s = String(v ?? "").trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
  if (m) return `${m[3]}-${pad(Number(m[2]))}-${pad(Number(m[1]))}`;
  return null;
}
