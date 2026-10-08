import { convertirNombre } from "@/lib/pdfToTables";
import type { TabRow } from "./tabs";

/** Une écriture du grand-livre d'un compte (Sage 100 : date, code journal, n° de pièce, libellé, débit, crédit). */
export interface EcritureLivre {
  date: string;
  journal: string;
  piece: string;
  /** Libellé complet, lignes de suite comprises (« PAIEMENT CHQ N°144167 ADEL EDHAWTHI »). */
  libelle: string;
  debit: number;
  credit: number;
  nature: NatureEcriture;
}

export type NatureEcriture = "cheque_emis" | "cheque_recu" | "effet_recu" | "virement_emis" | "virement_recu" | "report" | "autre";

export interface GrandLivre {
  societe: string;
  compte: string;
  ecritures: EcritureLivre[];
  /** Totaux « À reporter » / « Total » imprimés au pied du document. */
  totaux: { debit: number; credit: number } | null;
  /** Les écritures lues additionnent bien les totaux imprimés (aucune ligne perdue à la lecture). */
  controle: boolean | null;
}

const r3 = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000;
const montant = (v: string) => {
  const t = v.trim();
  if (!t) return 0;
  const n = convertirNombre(t.replace(/^-/, ""));
  return n === null ? 0 : Math.abs(r3(n));
};

/** « 060126 » -> « 2026-01-06 ». */
function dateSage(v: string): string | null {
  const m = /^(\d{2})(\d{2})(\d{2})$/.exec(v);
  if (!m) return null;
  const [, jj, mm, aa] = m;
  if (Number(mm) < 1 || Number(mm) > 12 || Number(jj) < 1 || Number(jj) > 31) return null;
  return `20${aa}-${mm}-${jj}`;
}

const maj = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase();

/** Nature d'une écriture d'après son libellé et son sens : chèque émis (débit), chèque ou effet encaissé (crédit), virement… */
export function natureEcriture(libelle: string, debit: number, credit: number, journal = ""): NatureEcriture {
  const l = maj(libelle);
  if (/^RAN$/.test(maj(journal)) || /SOLDE ANTERIEUR|REPORT A NOUVEAU/.test(l)) return "report";
  if (/\bVIR\w*\s+EMIS\b|\bVIREMENT\s+EMIS\b/.test(l)) return "virement_emis";
  if (/\bEFFET\b/.test(l) && credit > 0) return "effet_recu";
  if (debit > 0 && credit === 0 && /\bBLOCAGE\b/.test(l)) return "cheque_emis";
  if (/\bCHQ\b|\bCHEQUE\b/.test(l)) {
    if (credit > 0 && debit === 0 && /ENC/.test(l)) return "cheque_recu";
    if (debit > 0 && credit === 0) return "cheque_emis";
    return credit > 0 ? "cheque_recu" : "cheque_emis";
  }
  if (credit > 0 && debit === 0 && /\bVIR|TRANSPFET|TRANSFERT/.test(l)) return "virement_recu";
  return "autre";
}

/** Lit le grand-livre d'un compte d'après le tableau reconstruit d'un PDF Sage 100 (cellules : « date journal pièce », libellé,
 * débit, crédit, solde progressif). Renvoie null si ce n'est pas un grand-livre de ce format. */
export function lireGrandLivre(pages: string[][][]): GrandLivre | null {
  const rows = pages.flat();
  const enTete = rows.findIndex((r) => /^date\s+c\.?j/i.test(r[0] ?? "") || r.some((c) => /^libell[ée] [ée]criture/i.test(c)));
  if (enTete < 0 || !rows.some((r) => r.some((c) => /^grand-?livre/i.test(c)))) return null;

  const societe = (rows[0]?.[0] ?? "").trim();
  const compte = rows.map((r) => r[0] ?? "").find((c) => /^\d{6}\s+\S/.test(c) && !/^\d{6}\s+[A-Z]{2,5}\s+\d+$/.test(c)) ?? "";

  const ecritures: EcritureLivre[] = [];
  let totaux: GrandLivre["totaux"] = null;
  for (const r of rows.slice(enTete + 1)) {
    const [c0 = "", c1 = "", c2 = "", c3 = ""] = r.map((c) => c ?? "");
    const m = /^(\d{6})\s+(\S+)\s+(\d+)$/.exec(c0.trim());
    if (m && dateSage(m[1])) {
      const debit = montant(c2);
      const credit = montant(c3);
      ecritures.push({ date: dateSage(m[1])!, journal: m[2], piece: m[3], libelle: c1.trim(), debit, credit, nature: "autre" });
      continue;
    }
    if (!c0.trim() && /^(a reporter|report|total)\b/i.test(c1.trim())) {
      totaux = { debit: montant(c2), credit: montant(c3) };
      continue;
    }
    // Suite du libellé de l'écriture précédente (« N°144167 ADEL » puis « EDHAWTHI »), sans montant.
    if (!c0.trim() && c1.trim() && !c2.trim() && !c3.trim() && ecritures.length > 0) {
      const derniere = ecritures[ecritures.length - 1];
      derniere.libelle = `${derniere.libelle} ${c1.trim()}`.replace(/N°\s+(?=\d)/g, "N°").replace(/\s+/g, " ").trim();
    }
  }
  if (ecritures.length === 0) return null;
  for (const e of ecritures) e.nature = natureEcriture(e.libelle, e.debit, e.credit, e.journal);

  const sd = r3(ecritures.reduce((s, e) => s + e.debit, 0));
  const sc = r3(ecritures.reduce((s, e) => s + e.credit, 0));
  return {
    societe,
    compte,
    ecritures,
    totaux,
    controle: totaux ? Math.abs(sd - totaux.debit) < 0.005 && Math.abs(sc - totaux.credit) < 0.005 : null,
  };
}

/** Tableaux de la collecte qu'un grand-livre peut alimenter, et la nature d'écriture de chacun. */
export const TABLEAUX_GRAND_LIVRE: Record<string, { natures: NatureEcriture[]; titre: string }> = {
  souche_cheques: { natures: ["cheque_emis"], titre: "Chèques émis" },
  bordereaux_remise_cheques: { natures: ["cheque_recu", "effet_recu"], titre: "Chèques et effets encaissés" },
  virements_recus: { natures: ["virement_recu"], titre: "Virements reçus" },
  virements_emis: { natures: ["virement_emis"], titre: "Virements émis" },
};

const MOTIFS: Partial<Record<string, string>> = { "REG CHQ": "Règlement par chèque", "PAIEMENT CHQ": "Paiement par chèque", "BLOCAGE CHQ": "Chèque bloqué", "RESERVATION CHQ": "Chèque réservé" };

/** Numéro du chèque ou de l'effet, et texte qui suit (le nom du bénéficiaire ou de l'émetteur) : « REG CHQ N°4001511 BATTERIE QODS AUT ». */
export function decouperLibelle(libelle: string): { base: string; numero: string; reste: string } {
  const l = libelle.replace(/\s+/g, " ").trim();
  const m = /^(.*?)\s*N°\s*(\d+)\s*(.*)$/.exec(l);
  if (m) return { base: m[1].trim(), numero: m[2], reste: m[3].trim() };
  const v = /^(VIR ETRANGER|VIR EMIS|VIR|TRANSPFET ETRNAGER|TRANSPFET ETRANGER|TRANSFERT ETRANGER)\b\s*(.*)$/i.exec(l);
  if (v) return { base: v[1].trim(), numero: "", reste: v[2].trim() };
  return { base: l, numero: "", reste: "" };
}

/** Lignes d'un tableau de la collecte d'après les écritures du grand-livre qui le concernent. */
export function lignesPourTableau(onglet: string, ecritures: EcritureLivre[]): TabRow[] {
  const cible = TABLEAUX_GRAND_LIVRE[onglet];
  if (!cible) return [];
  return ecritures
    .filter((e) => cible.natures.includes(e.nature))
    .map((e): TabRow => {
      const { base, numero, reste } = decouperLibelle(e.libelle);
      switch (onglet) {
        case "souche_cheques":
          return { date: e.date, num_cheque: numero, beneficiaire: reste, motif: MOTIFS[maj(base)] ?? base, montant: e.debit, compte_bancaire: e.journal, observations: "" };
        case "bordereaux_remise_cheques":
          return { date_remise: e.date, num_bordereau: "", montant: "", banque: e.journal, num_cheque: numero, client_emetteur: reste, montant_cheque: e.credit, date_valeur: "", observations: "" };
        case "virements_recus":
          return { date: e.date, emetteur: reste, reference: base, montant: e.credit, compte_bancaire: e.journal, observations: "" };
        default:
          return { date: e.date, beneficiaire: reste, reference: base, montant: e.debit, compte_bancaire: e.journal, observations: "" };
      }
    });
}
