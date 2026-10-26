/** Cause d'un PDF non converti, avec ce que l'utilisateur peut faire. Pure : aucune dépendance à l'écran. */
export type CodeDiagnostic = "scanne" | "protege" | "endommage" | "autre";

export interface DiagnosticConversion {
  code: CodeDiagnostic;
  /** Une ligne, affichée sous le nom du fichier. */
  resume: string;
  /** Pourquoi la conversion n'a pas abouti. */
  cause: string;
  /** Ce qui peut être fait, du plus simple au plus long. */
  solutions: string[];
}

const DIAGNOSTICS: Record<CodeDiagnostic, Omit<DiagnosticConversion, "code">> = {
  scanne: {
    resume: "PDF scanné (image) : il ne contient pas de texte à extraire",
    cause: "Ce PDF est une photo ou un scan de page (par exemple CamScanner) : il n'y a pas de texte à lire, seulement une image.",
    solutions: [
      "Demander à la banque ou à l'émetteur le PDF d'origine (téléchargé depuis leur espace en ligne) : il se convertit directement et sans erreur.",
      "À défaut, ressaisir ou recopier les montants : un PDF scanné ne peut pas être converti en Excel.",
    ],
  },
  protege: {
    resume: "PDF protégé par un mot de passe",
    cause: "Le fichier est chiffré : il faut son mot de passe pour le lire.",
    solutions: ["Ouvrir le PDF avec son mot de passe, puis l'enregistrer sans protection (Imprimer > Enregistrer en PDF), et le déposer à nouveau."],
  },
  endommage: {
    resume: "PDF illisible : fichier endommagé ou incomplet",
    cause: "Le fichier est incomplet ou abîmé (téléchargement interrompu, copie tronquée).",
    solutions: ["Télécharger ou copier de nouveau le fichier depuis sa source.", "L'ouvrir dans un lecteur PDF puis l'enregistrer sous un nouveau nom (Imprimer > Enregistrer en PDF)."],
  },
  autre: {
    resume: "Fichier illisible — PDF protégé ou endommagé",
    cause: "Le fichier n'a pas pu être lu. La cause exacte n'est pas identifiée.",
    solutions: ["Vérifier que le fichier s'ouvre dans un lecteur PDF.", "Le ré-enregistrer sous un nouveau nom (Imprimer > Enregistrer en PDF) puis le déposer à nouveau."],
  },
};

export function diagnostic(code: CodeDiagnostic): DiagnosticConversion {
  return { code, ...DIAGNOSTICS[code] };
}

/** Classe l'erreur levée à la lecture d'un PDF (noms d'erreurs de pdf.js). */
export function diagnostiquerErreurPdf(erreur: unknown): DiagnosticConversion {
  const nom = erreur instanceof Error ? erreur.name : "";
  const message = erreur instanceof Error ? erreur.message : String(erreur ?? "");
  if (nom === "PasswordException" || /password/i.test(message)) return diagnostic("protege");
  if (nom === "InvalidPDFException" || nom === "MissingPDFException" || /invalid pdf|unexpected end|missing pdf/i.test(`${nom} ${message}`)) return diagnostic("endommage");
  return diagnostic("autre");
}

/** Détail à copier pour demander de l'aide : fichier, cause et solutions, sans contenu du document. */
export function detailPourCopie(nomFichier: string, taille: number, d: DiagnosticConversion, pages?: number): string {
  return [
    `Fichier : ${nomFichier}`,
    `Taille : ${taille >= 1_048_576 ? `${(taille / 1_048_576).toFixed(1)} Mo` : `${Math.max(1, Math.round(taille / 1024))} Ko`}`,
    pages ? `Pages : ${pages}` : null,
    `Problème : ${d.resume}`,
    `Cause : ${d.cause}`,
    "Solutions :",
    ...d.solutions.map((s, i) => `${i + 1}. ${s}`),
  ].filter((ligne): ligne is string => ligne !== null).join("\n");
}
