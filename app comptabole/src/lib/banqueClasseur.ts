import {
  classerMouvement,
  dateFlexible,
  montantCellule,
  normaliser,
  texte,
  type MouvementImport,
} from "@/lib/banque";

/** Fusion verticale de cellules, en indices de lignes de la feuille lue (la valeur est dans la première ligne). */
export interface FusionVerticale {
  ligne1: number;
  ligne2: number;
  colonne: number;
}

export interface SoldeDate {
  date: string | null;
  montant: number;
}

export interface EcartSociete {
  libelle: string;
  societe: number;
  banque: number;
}

export interface FeuilleBancaire {
  mouvements: MouvementImport[];
  ignorees: number;
  /** « START DATE / BANK BALANCE » en tête de feuille, ou « Solde au … » d'un relevé. */
  ouverture: SoldeDate | null;
  /** « SOLDE REEL » (ou « BANK BALANCE 31/01/2026 ») en pied de feuille. */
  soldeReel: SoldeDate | null;
  totalDebit: number;
  totalCredit: number;
  /** Lignes où le montant du bloc « société » diffère de celui du bloc « banque » (frais bancaires, par exemple). */
  ecartsSociete: EcartSociete[];
}

const r3 = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000;
const minuscule = (v: unknown) => normaliser(texte(v)).toLowerCase().replace(/\s+/g, " ").trim();

const RE_DATE_OP = /^date( op(eration)?)?$/;
const RE_LIBELLE = /libell|description|designation/;

/** Une cellule qui est réellement une date (objet Date ou texte), jamais un nombre : un solde de 54 518,87 n'est pas le 25/02/2149. */
const dateCellule = (v: unknown): string | null => (v instanceof Date || typeof v === "string" ? dateFlexible(v) : null);

/** Cours de change lu dans un texte : « COURS 3.38 », « TAUX DE 3.375TND », « ACHAT VENTE DEVISE 3.3990 ». */
export function extraireCours(...textes: string[]): number | null {
  for (const t of textes) {
    const m =
      /\bCOURS\s*[:=]?\s*(\d{1,3}[.,]\d{2,5})/i.exec(t) ??
      /\bTAUX(?:\s+DE)?\s*[:=]?\s*(\d{1,3}[.,]\d{2,5})/i.exec(t) ??
      /\bDEVISES?\s+(\d{1,3}[.,]\d{3,5})\b/i.exec(t);
    if (m) {
      const n = Number(m[1].replace(",", "."));
      if (n > 0 && n < 1000) return n;
    }
  }
  return null;
}

/** Première cellule de la ligne, à droite de `depuis`, qui satisfait le test. */
function adroite<T>(row: unknown[], depuis: number, lire: (v: unknown) => T | null): T | null {
  for (let c = depuis + 1; c < row.length; c++) {
    const v = lire(row[c]);
    if (v !== null) return v;
  }
  return null;
}

/** Une feuille de relevé retravaillée par le cabinet : en-tête sur une ou deux lignes (Date op, Description, Débit/Crédit
 * sous « PETRA CMC » puis « BANK »…), solde de départ en tête, TOTAL / SOLDE REEL en pied, N° de pièce fusionnés sur
 * plusieurs lignes (une opération et ses frais). Les montants lus sont ceux de la BANQUE. Renvoie null sans en-tête reconnu. */
export function lireFeuilleBancaire(rows: unknown[][], fusions: FusionVerticale[] = []): FeuilleBancaire | null {
  // ── en-tête ─────────────────────────────────────────────────────────────
  let enTete = -1;
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const r = rows[i] ?? [];
    if (r.some((c) => RE_DATE_OP.test(minuscule(c))) && r.some((c) => RE_LIBELLE.test(minuscule(c)))) {
      enTete = i;
      break;
    }
  }
  if (enTete < 0) return null;

  const cols: Record<string, number> = {};
  const debits: number[] = [];
  const credits: number[] = [];
  let colBanque = -1;
  let colSolde = -1;
  const lireBande = (i: number, avecSolde = true) =>
    (rows[i] ?? []).forEach((cell, c) => {
      const t = minuscule(cell);
      if (!t) return;
      if (/^(bank|banque)$/.test(t)) colBanque = colBanque < 0 ? c : colBanque;
      else if (/^(bank balance|solde|balance)$/.test(t)) {
        if (avecSolde) colSolde = c;
      } else if (/debit/.test(t)) {
        if (!debits.includes(c)) debits.push(c);
      } else if (/credit/.test(t)) {
        if (!credits.includes(c)) credits.push(c);
      }
      else if (/valeur|value/.test(t)) cols.dateValeur ??= c;
      else if (RE_DATE_OP.test(t)) cols.dateOp ??= c;
      else if (RE_LIBELLE.test(t)) cols.libelle ??= c;
      else if (/^details?$/.test(t)) cols.details ??= c;
      else if (/^ref/.test(t)) cols.reference ??= c;
      else if (/piece/.test(t)) cols.numPiece ??= c;
    });
  // Les libellés de blocs (« BANK ») peuvent se trouver sur la ligne qui précède l'en-tête.
  if (enTete > 0) lireBande(enTete - 1, false);
  // La bande d'en-tête va jusqu'à la première ligne qui porte une vraie date d'opération.
  let finBande = enTete;
  lireBande(enTete);
  while (finBande + 1 < rows.length && finBande - enTete < 3 && !dateFlexible((rows[finBande + 1] ?? [])[cols.dateOp ?? -1])) {
    finBande++;
    lireBande(finBande);
  }
  if (cols.dateOp === undefined || cols.libelle === undefined || debits.length === 0 || credits.length === 0) return null;

  // Bloc « banque » : les colonnes à partir du libellé BANK ; sinon les dernières.
  const borne = colSolde >= 0 ? colSolde : Infinity;
  const dansBanque = (c: number) => (colBanque >= 0 ? c >= colBanque && c < borne : true);
  const debitBanque = (colBanque >= 0 ? debits.find(dansBanque) : debits[debits.length - 1]) ?? debits[debits.length - 1];
  const creditBanque = (colBanque >= 0 ? credits.find(dansBanque) : credits[credits.length - 1]) ?? credits[credits.length - 1];
  const debitSociete = debits.find((c) => c !== debitBanque);
  const creditSociete = credits.find((c) => c !== creditBanque);

  // ── N° de pièce fusionnés sur plusieurs lignes ───────────────────────────
  const lignes = rows.map((r) => [...(r ?? [])]);
  if (cols.numPiece !== undefined) {
    for (const f of fusions) {
      if (f.colonne !== cols.numPiece || f.ligne2 <= f.ligne1) continue;
      const valeur = lignes[f.ligne1]?.[f.colonne];
      for (let l = f.ligne1 + 1; l <= f.ligne2 && l < lignes.length; l++) lignes[l][f.colonne] = valeur;
    }
  }

  // ── solde de départ (avant l'en-tête) ────────────────────────────────────
  let ouverture: SoldeDate | null = null;
  for (let i = 0; i < enTete; i++) {
    const r = lignes[i];
    const cd = r.findIndex((c) => /^start date$/.test(minuscule(c)));
    const cb = r.findIndex((c) => /^bank balance$/.test(minuscule(c)));
    if (cd >= 0 && cb >= 0) {
      const date = adroite(r, cd, dateCellule);
      const montant = adroite(r, cb, (v) => (typeof v === "number" ? v : null));
      if (montant !== null) ouverture = { date, montant: r3(montant) };
    }
  }

  // ── mouvements, pied de feuille ──────────────────────────────────────────
  const mouvements: MouvementImport[] = [];
  const ecartsSociete: EcartSociete[] = [];
  let ignorees = 0;
  let soldeReel: SoldeDate | null = null;
  for (let i = finBande + 1; i < lignes.length; i++) {
    const row = lignes[i];
    const dateOp = dateFlexible(row[cols.dateOp]);
    const libelle = texte(row[cols.libelle]).replace(/\s+/g, " ").trim();

    if (!dateOp) {
      const cr = row.findIndex((c) => /^solde reel$/.test(minuscule(c)));
      if (cr >= 0) {
        const montant = adroite(row, cr, (v) => (typeof v === "number" ? v : null));
        if (montant !== null) soldeReel = { date: row.map(dateCellule).find((d) => d) ?? null, montant: r3(montant) };
        continue;
      }
      const cell = row.map((c) => texte(c)).find((t) => /^bank balance\s+\d/i.test(t));
      if (cell) {
        const ci = row.findIndex((c) => texte(c) === cell);
        const date = dateFlexible(/(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})/.exec(cell)?.[1]);
        const montant = adroite(row, ci, (v) => (typeof v === "number" ? v : null));
        if (montant !== null) soldeReel ??= { date, montant: r3(montant) };
        continue;
      }
      if (row.some((c) => texte(c))) ignorees++;
      continue;
    }

    const debit = montantCellule(row[debitBanque]);
    const credit = montantCellule(row[creditBanque]);
    if (debit === 0 && credit === 0) {
      ignorees++;
      continue;
    }
    // « Solde au 31/12/2025 » d'un relevé converti : solde de départ, pas une opération.
    if (/^SOLDE\b/.test(normaliser(libelle).trim())) {
      ouverture ??= { date: dateOp, montant: r3(credit - debit) };
      continue;
    }

    if (debitSociete !== undefined && creditSociete !== undefined) {
      // Le bloc société est le miroir de la banque : débit société = crédit banque, et inversement.
      const sd = montantCellule(row[debitSociete]);
      const sc = montantCellule(row[creditSociete]);
      if (Math.abs(sd - credit) > 0.0005 || Math.abs(sc - debit) > 0.0005) {
        ecartsSociete.push({ libelle, societe: sd || sc, banque: credit || debit });
      }
    }

    const lire = (c?: number) => (c === undefined ? "" : texte(row[c]).replace(/\s+/g, " ").trim());
    const pieceBrute = lire(cols.numPiece);
    // « COURS 3.38 » dans la colonne N° pièce : c'est le cours d'une opération de change, pas un numéro.
    const estCours = /COURS/i.test(pieceBrute);
    let numPiece = estCours ? "" : pieceBrute;
    let details = lire(cols.details);
    // Certaines feuilles mettent une catégorie (« PAIEMENT LC », « OPP CHG ») dans la colonne N° pièce : ce n'est pas un n°.
    let indice = "";
    if (numPiece && !/\d/.test(numPiece)) {
      indice = numPiece;
      details = details || numPiece;
      numPiece = "";
    }
    const type = classerMouvement(`${libelle} ${details} ${indice}`, debit, credit, estCours ? pieceBrute : numPiece);
    mouvements.push({
      dateOp,
      dateValeur: cols.dateValeur !== undefined ? dateCellule(row[cols.dateValeur]) : null,
      libelle,
      details,
      reference: lire(cols.reference),
      numPiece,
      debit,
      credit,
      type,
      cours: type === "change" ? extraireCours(pieceBrute, details, libelle) : null,
    });
  }

  return {
    mouvements,
    ignorees,
    ouverture,
    soldeReel,
    totalDebit: r3(mouvements.reduce((s, m) => s + m.debit, 0)),
    totalCredit: r3(mouvements.reduce((s, m) => s + m.credit, 0)),
    ecartsSociete,
  };
}

export interface FeuilleLue {
  nom: string;
  rows: unknown[][];
  fusions?: FusionVerticale[];
}

export interface ResumeFeuille {
  nom: string;
  nbMouvements: number;
  debit: number;
  credit: number;
  ouverture: number | null;
  /** Solde de départ + crédits − débits. */
  cloture: number | null;
  soldeReel: number | null;
}

export interface ClasseurBancaire {
  mouvements: MouvementImport[];
  feuilles: ResumeFeuille[];
  feuillesIgnorees: string[];
  ignorees: number;
  /** Solde et date de départ de la première feuille. */
  ouverture: SoldeDate | null;
  /** Solde réel de la dernière feuille qui en indique un. */
  soldeReel: SoldeDate | null;
  ecartsSociete: EcartSociete[];
  /** Incohérences à vérifier : solde de départ ≠ clôture du mois précédent, solde calculé ≠ solde réel. */
  avertissements: string[];
}

const ordreMois = (nom: string) => {
  const m = /^(\d{1,2})[-/.](\d{4})$/.exec(nom.trim());
  return m ? Number(m[2]) * 100 + Number(m[1]) : null;
};

const fr = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const cle = (m: MouvementImport) => [m.dateOp, m.libelle.trim().toLowerCase(), m.debit, m.credit].join("|");

/** Un classeur de relevés : une feuille par mois (« 01-2026 » … « 08-2026 »), lues ensemble, du plus ancien au plus récent.
 * Deux erreurs de saisie courantes sont corrigées, avec un avertissement : une date d'un mois de la feuille mais d'une mauvaise
 * année (2025 au lieu de 2026), et une opération du mois suivant saisie à la fois au bas d'une feuille et dans la suivante. */
export function lireClasseurBancaire(feuilles: FeuilleLue[]): ClasseurBancaire {
  const ordonnees = [...feuilles];
  if (ordonnees.every((f) => ordreMois(f.nom) !== null)) ordonnees.sort((a, b) => ordreMois(a.nom)! - ordreMois(b.nom)!);

  const res: ClasseurBancaire = {
    mouvements: [], feuilles: [], feuillesIgnorees: [], ignorees: 0, ouverture: null, soldeReel: null, ecartsSociete: [], avertissements: [],
  };
  const lues: { nom: string; lue: FeuilleBancaire }[] = [];
  for (const f of ordonnees) {
    const lue = lireFeuilleBancaire(f.rows, f.fusions);
    if (!lue || (lue.mouvements.length === 0 && !lue.ouverture)) res.feuillesIgnorees.push(f.nom);
    else lues.push({ nom: f.nom, lue });
  }

  // Corrections par feuille « MM-AAAA ».
  lues.forEach(({ nom, lue }) => {
    const mois = ordreMois(nom);
    if (mois === null) return;
    const annee = Math.floor(mois / 100);
    const moisNum = mois % 100;
    const aCorriger: string[] = [];
    lue.mouvements = lue.mouvements.map((m) => {
      const [y, mm, dd] = m.dateOp.split("-").map(Number);
      if (mm === moisNum && y !== annee) {
        aCorriger.push(`${dd}/${mm}/${y}`);
        return { ...m, dateOp: `${annee}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`, dateValeur: m.dateValeur && m.dateValeur.slice(5) === m.dateOp.slice(5) ? `${annee}-${m.dateValeur.slice(5)}` : m.dateValeur };
      }
      return m;
    });
    if (aCorriger.length) {
      res.avertissements.push(`« ${nom} » : ${aCorriger.length} date${aCorriger.length > 1 ? "s" : ""} avec une mauvaise année (${aCorriger.slice(0, 3).join(", ")}${aCorriger.length > 3 ? "…" : ""}) corrigée${aCorriger.length > 1 ? "s" : ""} en ${annee}.`);
    }
  });
  lues.forEach(({ nom, lue }, index) => {
    const mois = ordreMois(nom);
    if (mois === null) return;
    const plusTard = new Set(lues.slice(index + 1).flatMap((x) => x.lue.mouvements.map(cle)));
    const retirees: MouvementImport[] = [];
    lue.mouvements = lue.mouvements.filter((m) => {
      const debutSuivant = `${Math.floor(mois / 100) + (mois % 100 === 12 ? 1 : 0)}-${String(mois % 100 === 12 ? 1 : (mois % 100) + 1).padStart(2, "0")}`;
      if (m.dateOp.slice(0, 7) >= debutSuivant && plusTard.has(cle(m))) {
        retirees.push(m);
        return false;
      }
      return true;
    });
    if (retirees.length) {
      lue.totalDebit = r3(lue.mouvements.reduce((s, m) => s + m.debit, 0));
      lue.totalCredit = r3(lue.mouvements.reduce((s, m) => s + m.credit, 0));
      res.avertissements.push(
        `« ${nom} » : ${retirees.length} opération${retirees.length > 1 ? "s" : ""} datée${retirees.length > 1 ? "s" : ""} du mois suivant, déjà saisie${retirees.length > 1 ? "s" : ""} dans la feuille suivante, ignorée${retirees.length > 1 ? "s" : ""} ici (${retirees[0].libelle.trim()}, ${fr(retirees[0].debit || retirees[0].credit)}).`,
      );
    }
    // Lignes qui n'appartiennent à aucun jour du mois de la feuille et qu'on laisse telles quelles.
    const hors = lue.mouvements.filter((m) => {
      const [y, mm] = m.dateOp.split("-").map(Number);
      return y * 100 + mm !== mois;
    });
    if (hors.length) res.avertissements.push(`« ${nom} » : ${hors.length} opération${hors.length > 1 ? "s" : ""} datée${hors.length > 1 ? "s" : ""} hors du mois de la feuille (${hors[0].dateOp}).`);
  });

  let cloturePrecedente: { nom: string; montant: number } | null = null;
  for (const { nom, lue } of lues) {
    res.mouvements.push(...lue.mouvements);
    res.ignorees += lue.ignorees;
    res.ecartsSociete.push(...lue.ecartsSociete);
    res.ouverture ??= lue.ouverture;
    if (lue.soldeReel) res.soldeReel = lue.soldeReel;

    const cloture = lue.ouverture ? r3(lue.ouverture.montant + lue.totalCredit - lue.totalDebit) : null;
    res.feuilles.push({
      nom,
      nbMouvements: lue.mouvements.length,
      debit: lue.totalDebit,
      credit: lue.totalCredit,
      ouverture: lue.ouverture?.montant ?? null,
      cloture,
      soldeReel: lue.soldeReel?.montant ?? null,
    });
    if (cloturePrecedente && lue.ouverture && Math.abs(lue.ouverture.montant - cloturePrecedente.montant) > 0.005) {
      res.avertissements.push(`« ${nom} » démarre à ${fr(lue.ouverture.montant)} alors que « ${cloturePrecedente.nom} » se termine à ${fr(cloturePrecedente.montant)}.`);
    }
    if (cloture !== null && lue.soldeReel && Math.abs(cloture - lue.soldeReel.montant) > 0.005) {
      res.avertissements.push(`« ${nom} » : solde calculé ${fr(cloture)} ≠ solde réel ${fr(lue.soldeReel.montant)}.`);
    }
    cloturePrecedente = cloture !== null ? { nom, montant: cloture } : cloturePrecedente;
  }
  return res;
}

/** Mouvements d'un tableau de cellules (relevé PDF converti en tableau) : même lecture qu'une feuille Excel. */
export function lignesVersMouvements(
  rows: unknown[][],
): { mouvements: MouvementImport[]; ignorees: number; soldeOuverture: { date: string; montant: number } | null } | null {
  const f = lireFeuilleBancaire(rows);
  if (!f) return null;
  return {
    mouvements: f.mouvements,
    ignorees: f.ignorees,
    soldeOuverture: f.ouverture?.date ? { date: f.ouverture.date, montant: f.ouverture.montant } : null,
  };
}
