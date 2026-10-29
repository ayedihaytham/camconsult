import type { MouvementImport } from "@/lib/banque";
import type { ControleReleve } from "@/lib/controleReleve";

/**
 * Vérification d'un import de relevé : chaque ligne du fichier doit se retrouver, à l'identique (date, libellé, débit, crédit), parmi les mouvements enregistrés
 * dans le compte, et les totaux enregistrés doivent être ceux du fichier — et, pour un PDF qui imprime ses totaux, ceux du relevé.
 */

type Ligne = Pick<MouvementImport, "dateOp" | "libelle" | "debit" | "credit">;

const r3 = (n: number) => Math.round(n * 1000) / 1000;
const cle = (m: Ligne) => `${m.dateOp}|${m.libelle.replace(/\s+/g, " ").trim().toLowerCase()}|${r3(m.debit)}|${r3(m.credit)}`;

export interface LigneVerification {
  libelle: string;
  /** Ce que le relevé imprime (PDF avec totaux) ; null si le fichier n'imprime rien de comparable. */
  releve: number | null;
  fichier: number;
  compte: number;
  ok: boolean;
}

export interface VerificationImport {
  lignes: LigneVerification[];
  /** Lignes du fichier introuvables dans le compte. */
  manquantes: Ligne[];
  ok: boolean;
}

export function verifierImport(fichier: Ligne[], enregistres: Ligne[], controle: ControleReleve | null = null): VerificationImport {
  const dispo = new Map<string, number>();
  for (const m of enregistres) dispo.set(cle(m), (dispo.get(cle(m)) ?? 0) + 1);
  const manquantes: Ligne[] = [];
  const trouvees: Ligne[] = [];
  for (const m of fichier) {
    const k = cle(m);
    if ((dispo.get(k) ?? 0) > 0) {
      dispo.set(k, (dispo.get(k) ?? 0) - 1);
      trouvees.push(m);
    } else manquantes.push(m);
  }
  const somme = (l: Ligne[], champ: "debit" | "credit") => r3(l.reduce((s, m) => s + m[champ], 0));
  const imprime = (nom: string) => controle?.lignes.find((l) => l.libelle === nom)?.releve ?? null;
  const ligne = (libelle: string, releve: number | null, f: number, c: number): LigneVerification => ({
    libelle,
    releve,
    fichier: f,
    compte: c,
    ok: Math.abs(f - c) < 0.0005 && (releve === null || Math.abs(f - releve) < 0.0051),
  });
  const lignes = [
    ligne("Total débit", imprime("Total débit"), somme(fichier, "debit"), somme(trouvees, "debit")),
    ligne("Total crédit", imprime("Total crédit"), somme(fichier, "credit"), somme(trouvees, "credit")),
    ligne("Nombre de lignes", null, fichier.length, trouvees.length),
  ];
  const soldeFinal = controle?.lignes.find((l) => l.libelle.startsWith("Solde final"));
  if (soldeFinal) lignes.push({ libelle: "Solde final (ouverture + crédits − débits)", releve: soldeFinal.releve, fichier: soldeFinal.calcule, compte: soldeFinal.calcule, ok: soldeFinal.ok });
  return { lignes, manquantes, ok: manquantes.length === 0 && lignes.every((l) => l.ok) };
}
