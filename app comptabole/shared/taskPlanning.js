/** Dates civiles de planification, indépendantes des événements création/fin réelle. */
export function isPlanningDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function taskPlanningError(debutPrevu, finPrevue) {
  const start = debutPrevu == null || debutPrevu === "" ? null : debutPrevu;
  const end = finPrevue == null || finPrevue === "" ? null : finPrevue;
  if (start === null && end === null) return null;
  if (start === null || end === null) return "Renseignez le début et la fin prévus, ou laissez les deux dates vides.";
  if (!isPlanningDate(start) || !isPlanningDate(end)) return "Les dates de planification doivent être des dates valides.";
  if (end < start) return "La fin prévue doit être le même jour ou après le début prévu.";
  return null;
}
