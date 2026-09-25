import type { Societe } from "@/types";

function normalizeSearch(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("fr-FR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/_/g, " ");
}

interface FinancialSocieteFilters {
  query: string;
  statut: Societe["statut"] | "all";
  theme: Societe["theme"] | "all";
}

/** Search existing société identity, structure and readable status fields. */
export function searchFinancialSocietes(societes: Societe[], query: string) {
  const needle = normalizeSearch(query);
  if (!needle) return societes;

  return societes.filter((societe) =>
    [
      societe.raisonSociale,
      societe.code,
      societe.rne,
      societe.theme,
      societyStatusLabel(societe.statut),
    ].some((value) => normalizeSearch(value ?? "").includes(needle)),
  );
}

function societyStatusLabel(statut: Societe["statut"]) {
  switch (statut) {
    case "actif": return "Actif";
    case "en_attente": return "En attente";
    case "inactif": return "Inactif";
  }
}

/** Filtering order: query first, then status and structure; authorization is supplied upstream. */
export function filterFinancialSocietes(
  authorizedSocietes: Societe[],
  filters: FinancialSocieteFilters,
) {
  return searchFinancialSocietes(authorizedSocietes, filters.query).filter((societe) =>
    (filters.statut === "all" || societe.statut === filters.statut)
    && (filters.theme === "all" || societe.theme === filters.theme),
  );
}
