import type { BalanceLigneInput } from "@/store/balances";

export type AmountField = "debit" | "credit";

export interface BalanceImportRow extends BalanceLigneInput {
  sourceRow: number;
  amountErrors: Partial<Record<AmountField, string>>;
  debitRaw?: string;
  creditRaw?: string;
}

export type ParsedAmount =
  | { ok: true; value: number }
  | { ok: false; value: null; raw: string };

const SPACE = /[\s\u00a0\u202f]/g;

/**
 * Parses only unambiguous decimal and grouped-decimal forms. In particular,
 * a single separator followed by three digits (e.g. 1.234) is ambiguous
 * between a decimal and a thousands separator and is rejected.
 */
export function parseBalanceAmount(input: unknown): ParsedAmount {
  if (typeof input === "number") {
    return Number.isFinite(input)
      ? { ok: true, value: input }
      : { ok: false, value: null, raw: String(input) };
  }

  const raw = String(input ?? "").trim();
  if (!raw) return { ok: true, value: 0 };

  const compact = raw.replace(SPACE, " ");
  const sign = "[+-]?";
  const digits = "\\d+";
  const spaceGrouped = new RegExp(`^${sign}\\d{1,3}(?: \\d{3})+(?:[,.]\\d+)?$`);
  const frenchGrouped = new RegExp(`^${sign}\\d{1,3}(?:\\.\\d{3})+,\\d+$`);
  const usGrouped = new RegExp(`^${sign}\\d{1,3}(?:,\\d{3})+\\.\\d+$`);

  if (spaceGrouped.test(compact)) {
    const normalized = compact.replace(/ /g, "").replace(",", ".");
    const value = Number(normalized);
    return Number.isFinite(value)
      ? { ok: true, value }
      : { ok: false, value: null, raw };
  }
  if (frenchGrouped.test(raw)) {
    const value = Number(raw.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(value)
      ? { ok: true, value }
      : { ok: false, value: null, raw };
  }
  if (usGrouped.test(raw)) {
    const value = Number(raw.replace(/,/g, ""));
    return Number.isFinite(value)
      ? { ok: true, value }
      : { ok: false, value: null, raw };
  }

  const simple = new RegExp(`^${sign}${digits}(?:[.,]\\d+)?$`);
  if (!simple.test(raw)) return { ok: false, value: null, raw };

  const ambiguousGrouping = new RegExp(`^${sign}([1-9]\\d{0,2})[.,](\\d{3})$`);
  if (ambiguousGrouping.test(raw)) return { ok: false, value: null, raw };

  const value = Number(raw.replace(",", "."));
  return Number.isFinite(value)
    ? { ok: true, value }
    : { ok: false, value: null, raw };
}

function normalizeHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const HEADER_KEYS: Record<string, keyof BalanceLigneInput | "solde"> = {
  affectat: "affectat",
  affect: "affectat",
  compte: "compte",
  libelle: "libelle",
  debit: "debit",
  credit: "credit",
  solde: "solde",
};

export function parseBalanceRows(raw: unknown[][]): {
  headerFound: boolean;
  rows: BalanceImportRow[];
} {
  let headerIndex = -1;
  let columns: Partial<Record<keyof BalanceLigneInput | "solde", number>> = {};

  for (let i = 0; i < Math.min(raw.length, 10); i++) {
    const next: typeof columns = {};
    (raw[i] ?? []).forEach((cell, j) => {
      const key = HEADER_KEYS[normalizeHeader(String(cell ?? ""))];
      if (key) next[key] = j;
    });
    if (next.compte !== undefined) {
      headerIndex = i;
      columns = next;
      break;
    }
  }

  if (headerIndex < 0) return { headerFound: false, rows: [] };

  const rows: BalanceImportRow[] = [];
  for (let i = headerIndex + 1; i < raw.length; i++) {
    const row = raw[i] ?? [];
    const compte = String(row[columns.compte!] ?? "").trim();
    if (!compte) continue;

    const amountErrors: BalanceImportRow["amountErrors"] = {};
    let debit = 0;
    let credit = 0;
    let debitRaw: string | undefined;
    let creditRaw: string | undefined;

    if (columns.debit !== undefined) {
      const parsed = parseBalanceAmount(row[columns.debit]);
      if (parsed.ok) debit = parsed.value;
      else {
        debitRaw = parsed.raw;
        amountErrors.debit = "Montant Débit invalide ou ambigu.";
      }
    }
    if (columns.credit !== undefined) {
      const parsed = parseBalanceAmount(row[columns.credit]);
      if (parsed.ok) credit = parsed.value;
      else {
        creditRaw = parsed.raw;
        amountErrors.credit = "Montant Crédit invalide ou ambigu.";
      }
    }

    rows.push({
      compte,
      libelle: columns.libelle !== undefined ? String(row[columns.libelle] ?? "").trim() : "",
      debit,
      credit,
      affectat: columns.affectat !== undefined ? String(row[columns.affectat] ?? "").trim() : "",
      sourceRow: i + 1,
      amountErrors,
      ...(debitRaw === undefined ? {} : { debitRaw }),
      ...(creditRaw === undefined ? {} : { creditRaw }),
    });
  }

  return { headerFound: true, rows };
}
