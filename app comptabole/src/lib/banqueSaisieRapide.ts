import { classerMouvement, dateFlexible, type MouvementImport } from "@/lib/banque";
import { lireNombre } from "@/lib/filtresRecapSociete";

/** Saisie rapide de mouvements en grille : chaque ligne est du texte tel que tapé ou collé depuis Excel ; elle est lue, contrôlée et typée ici. */
export interface LigneSaisie {
  date: string;
  libelle: string;
  debit: string;
  credit: string;
}

export const COLONNES = ["date", "libelle", "debit", "credit"] as const;
export type Colonne = (typeof COLONNES)[number];

export const ligneVide = (date = ""): LigneSaisie => ({ date, libelle: "", debit: "", credit: "" });
export const estVide = (l: LigneSaisie) => !l.libelle.trim() && !l.debit.trim() && !l.credit.trim();

export type ResultatLigne = { etat: "vide" } | { etat: "ok"; mouvement: MouvementImport } | { etat: "erreur"; erreur: string };

/** Date saisie : « 05/09/2026 », « 5-9-26 », ou « 5/9 » (l'année est alors celle de `annee`). */
export function lireDate(texte: string, annee: string): string | null {
  const t = texte.trim();
  const sansAnnee = /^(\d{1,2})[/.\-](\d{1,2})$/.exec(t);
  return dateFlexible(sansAnnee ? `${sansAnnee[1]}/${sansAnnee[2]}/${annee}` : t);
}

/** Lit une ligne de la grille ; `annee` complète les dates saisies sans année. */
export function lireLigneSaisie(l: LigneSaisie, annee: string): ResultatLigne {
  if (estVide(l)) return { etat: "vide" };
  const dateOp = lireDate(l.date, annee);
  if (!dateOp) return { etat: "erreur", erreur: "Date illisible" };
  if (!l.libelle.trim()) return { etat: "erreur", erreur: "Libellé requis" };
  const lire = (t: string) => (t.trim() === "" ? 0 : lireNombre(t));
  const debit = lire(l.debit);
  const credit = lire(l.credit);
  if (Number.isNaN(debit) || Number.isNaN(credit) || debit < 0 || credit < 0) return { etat: "erreur", erreur: "Montant illisible" };
  if (debit > 0 && credit > 0) return { etat: "erreur", erreur: "Débit ou crédit, pas les deux" };
  if (debit === 0 && credit === 0) return { etat: "erreur", erreur: "Montant requis" };
  const libelle = l.libelle.replace(/\s+/g, " ").trim();
  return {
    etat: "ok",
    mouvement: { dateOp, dateValeur: null, libelle, details: "", reference: "", numPiece: "", debit, credit, type: classerMouvement(libelle, debit, credit), cours: null },
  };
}

/**
 * Texte collé depuis Excel (lignes séparées par un saut de ligne, colonnes par une tabulation) : remplit la grille à partir de la cellule choisie,
 * en ajoutant des lignes si besoin. Les colonnes en trop sont ignorées.
 */
export function collerDansGrille(lignes: LigneSaisie[], texte: string, ligneDebut: number, colonneDebut: Colonne): LigneSaisie[] {
  const morceaux = texte.replace(/\r/g, "").replace(/\n+$/, "").split("\n").map((r) => r.split("\t"));
  const resultat = lignes.map((l) => ({ ...l }));
  const c0 = COLONNES.indexOf(colonneDebut);
  morceaux.forEach((cellules, i) => {
    const r = ligneDebut + i;
    while (resultat.length <= r) resultat.push(ligneVide());
    cellules.forEach((valeur, j) => {
      const colonne = COLONNES[c0 + j];
      if (colonne) resultat[r][colonne] = valeur.trim();
    });
  });
  return resultat;
}
