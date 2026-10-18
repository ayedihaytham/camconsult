export type ImportRow = {
  row: number;
  numeroFacture: string;
  fournisseur: string;
  bcNumero: string;
  dateFacture: string | null;
  dateBrute: string;
  datePrecision: string;
  montantHtMillimes: string;
  tvaSuspendueMillimes: string;
  warnings: string[];
  errors: string[];
  duplicate: boolean;
  matches?: {
    id: string;
    version: number;
    date: string | null;
    ht: string;
    tva: string;
  }[];
  raw: unknown;
};
export type ImportPreview = {
  profil?: { raisonSociale?: string; matriculeFiscal?: string };
  batchId: string;
  previewHash: string;
  profile: string;
  rows: ImportRow[];
  warnings: { code?: string; message: string; tva?: string }[];
  alreadyCommitted?: boolean;
};
const warningLabels: Record<string, string> = {
  DOUBLON_POSSIBLE: "Facture déjà présente ou doublon dans le fichier",
  DATE_INCOMPLETE: "Jour de facture à compléter avant déclaration",
  TVA_MANUELLE: "TVA source différente du calcul : justification obligatoire",
};
export const importWarning = (code: string) => warningLabels[code] || code;
export function sourceReviewRequired(preview: ImportPreview) {
  return preview.warnings.some((w) =>
    ["BCD_ECART_PIED", "IDENTITE_DECLARANT_DIFFERENTE"].includes(w.code || ""),
  );
}
export function rowReviewRequired(
  row: ImportRow,
  target?: string,
  bc?: string,
) {
  return (
    row.duplicate ||
    row.warnings.includes("TVA_MANUELLE") ||
    Boolean(target || bc)
  );
}
export function importReviewIssues(
  preview: ImportPreview,
  selected: number[],
  notes: Record<number, string>,
  targets: Record<number, string>,
  mapping: Record<number, string>,
  sourceNote: string,
  identityConfirmed: boolean,
) {
  const issues: { message: string; field?: string }[] = [];
  if (!selected.length)
    issues.push({ message: "Sélectionnez au moins une ligne à importer." });
  if (sourceReviewRequired(preview) && !sourceNote.trim())
    issues.push({
      message: "Expliquez les écarts du fichier dans « Revue du fichier ».",
      field: "import-source-note",
    });
  if (
    preview.warnings.some((w) => w.code === "IDENTITE_DECLARANT_DIFFERENTE") &&
    !identityConfirmed
  )
    issues.push({
      message:
        "Vérifiez la société choisie et confirmez l’identité du déclarant.",
      field: "import-identity-confirm",
    });
  for (const number of selected) {
    const row = preview.rows.find((r) => r.row === number);
    if (!row || row.errors.length) {
      issues.push({
        message: `Ligne ${number} invalide : excluez-la de la sélection.`,
      });
      continue;
    }
    if (
      rowReviewRequired(row, targets[number], mapping[number]) &&
      !notes[number]?.trim()
    )
      issues.push({
        message: `Ligne ${number} (${row.numeroFacture}) : ajoutez une justification.`,
        field: `import-note-${number}`,
      });
    if (targets[number] && !row.matches?.some((m) => m.id === targets[number]))
      issues.push({
        message: `Ligne ${number} : relancez l’aperçu pour revoir la facture cible.`,
      });
  }
  const ids = selected.map((n) => targets[n]).filter(Boolean);
  if (new Set(ids).size !== ids.length)
    issues.push({
      message:
        "Une même facture ne peut être mise à jour deux fois dans un lot.",
    });
  return issues;
}
