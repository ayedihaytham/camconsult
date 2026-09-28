import type { TabColumn, TabDef, TabRow } from "./tabs";

export type RowDraft = Record<string, string>;

export function editableRowColumns(def: TabDef, rowCount: number): TabColumn[] {
  if (def.key === "etat_caisse") {
    return rowCount === 0
      ? def.columns.filter((column) => column.key === "solde")
      : def.columns.filter((column) => column.key !== "solde");
  }
  return def.columns.filter((column) => !column.computed);
}

export function parseRowDraft(
  def: TabDef,
  rowCount: number,
  draft: RowDraft,
): { row: TabRow | null; errors: Record<string, string>; message: string | null } {
  const columns = editableRowColumns(def, rowCount);
  const filled = columns.some((column) => (draft[column.key] ?? "").trim() !== "");
  if (!filled) {
    const initialBalance = def.key === "etat_caisse" && rowCount === 0;
    return {
      row: null,
      errors: initialBalance ? { solde: "Renseignez le solde initial." } : {},
      message: initialBalance
        ? "Renseignez le solde initial."
        : "Renseignez au moins un champ avant d'ajouter la ligne.",
    };
  }

  const row: TabRow = {};
  const errors: Record<string, string> = {};
  for (const column of columns) {
    const value = draft[column.key] ?? "";
    if (column.type === "number" && value !== "") {
      const number = Number(value);
      if (!Number.isFinite(number)) {
        errors[column.key] = "Saisissez un nombre valide.";
      } else {
        row[column.key] = number;
      }
    } else {
      row[column.key] = value;
    }
  }

  return {
    row: Object.keys(errors).length ? null : row,
    errors,
    message: Object.keys(errors).length ? "Corrigez les champs signalés." : null,
  };
}
