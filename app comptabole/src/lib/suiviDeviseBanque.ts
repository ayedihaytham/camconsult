import { normaliser } from "@/lib/banque";
import { arrondi3 as r3 } from "../../shared/arrondi.js";
import type { CompteBancaire, MouvementBancaire } from "@/types";

/**
 * Lien entre le suivi bancaire et le suivi client devise : on lit dans le libellé d'un encaissement les factures qu'il règle,
 * on propose la répartition du montant sur les factures de la fiche, et on retrouve les encaissements qui restent à affecter.
 */

const sansZeros = (n: string) => n.replace(/^0+(?=\d)/, "");

/** Numéro de facture mis sous une forme comparable : « 094/2025 », « 94-2025 » → « 94/2025 » ; un numéro sans année reste tel quel (chiffres seuls). */
export function normaliserNumeroFacture(numero: string): string {
  const t = numero.toUpperCase().replace(/\s+/g, "");
  const m = /^(\d{1,7})[-/](\d{4})$/.exec(t);
  if (m) return `${sansZeros(m[1])}/${m[2]}`;
  return t.replace(/[^0-9A-Z]/g, "");
}

/**
 * Numéros de facture cités dans le libellé d'un encaissement : « FACTURE N°94/2025 », « FAC N°003/2026 », « FACT N°130+131+132+133/2025 »
 * (une année pour tout le groupe), « (fact 2025135+2025136) », « REGLEMENT FACT 260030/260031 ». Sans doublon, dans l'ordre du libellé.
 */
export function numerosCitesClient(libelle: string): string[] {
  const texte = ` ${libelle.toUpperCase()} `;
  const trouves: string[] = [];
  const ajoute = (n: string) => {
    if (n && !trouves.includes(n)) trouves.push(n);
  };
  let reste = texte;
  // Groupe « 130+131+132+133/2025 » : l'année est celle de toutes les factures du groupe.
  reste = reste.replace(/(?<![\d/])(\d{1,7}(?:\s*[+,&]\s*\d{1,7})+)\s*\/\s*(\d{4})\b/g, (_m, groupe: string, annee: string) => {
    for (const n of groupe.split(/[+,&]/)) ajoute(`${sansZeros(n.trim())}/${annee}`);
    return " ";
  });
  // « 94/2025 », « 003/2026 »
  reste = reste.replace(/(?<![\d/])(\d{1,7})\s*\/\s*(\d{4})\b/g, (_m, n: string, annee: string) => {
    ajoute(`${sansZeros(n)}/${annee}`);
    return " ";
  });
  // Numéros longs sans année (« 2025135+2025136 », « 260030/260031 », « 320001350 ») : tels quels.
  for (const n of reste.match(/\d{6,}/g) ?? []) ajoute(n);
  return trouves;
}

/** Factures de la fiche dont le numéro est cité dans le libellé. */
export function facturesCiteesClient(libelle: string, factures: { id: string; nFacture: string }[]): string[] {
  const cites = numerosCitesClient(libelle);
  if (cites.length === 0) return [];
  return factures
    .filter((f) => {
      const n = normaliserNumeroFacture(f.nFacture);
      return n !== "" && cites.some((c) => c === n || (/^\d{6,}$/.test(c) && /^\d{6,}$/.test(n) && (c.endsWith(n) || n.endsWith(c))));
    })
    .map((f) => f.id);
}

export interface FactureARegler {
  id: string;
  /** Montant qu'il reste à régler sur la facture. */
  reste: number;
  dateFacture: string | null;
  ordre: number;
}

export interface Affectation {
  factureId: string;
  montant: number;
}

/**
 * Répartit un montant sur des factures : celles que le libellé cite d'abord, puis les plus anciennes non soldées, chacune dans la limite de son reste.
 * Renvoie la répartition et ce qui n'a pas pu être réparti (plus de facture à régler).
 */
export function repartitionAuto(montant: number, factures: FactureARegler[], citees: string[] = []): { affectations: Affectation[]; nonReparti: number } {
  const ouvertes = factures.filter((f) => f.reste > 0.0005);
  const parAnciennete = (a: FactureARegler, b: FactureARegler) => String(a.dateFacture ?? "").localeCompare(String(b.dateFacture ?? "")) || a.ordre - b.ordre;
  const ordre = [...ouvertes.filter((f) => citees.includes(f.id)).sort(parAnciennete), ...ouvertes.filter((f) => !citees.includes(f.id)).sort(parAnciennete)];
  let restant = montant;
  const affectations: Affectation[] = [];
  for (const f of ordre) {
    if (restant <= 0.0005) break;
    const part = r3(Math.min(f.reste, restant));
    affectations.push({ factureId: f.id, montant: part });
    restant = r3(restant - part);
  }
  return { affectations, nonReparti: Math.max(0, r3(restant)) };
}

export interface EncaissementCandidat {
  mouvement: MouvementBancaire;
  devise: string;
  /** Ce qu'il reste à affecter sur l'encaissement (crédit − règlements déjà reliés). */
  reste: number;
  /** Le libellé nomme le client de la fiche. */
  nommeLeClient: boolean;
}

const motsDuClient = (client: string) => normaliser(client).split(/[^A-Z0-9]+/).filter((m) => m.length >= 4);

/** Le libellé de l'encaissement nomme-t-il ce client (nom complet ou premier mot significatif) ? */
export function libelleNommeLeClient(libelle: string, client: string): boolean {
  const l = normaliser(libelle);
  const complet = normaliser(client).trim();
  if (complet && l.includes(complet)) return true;
  const mot = motsDuClient(client)[0];
  return mot ? l.includes(mot) : false;
}

/** Encaissements (crédits) des comptes de la devise de la fiche qu'il reste à affecter, ceux qui nomment le client d'abord, puis du plus récent au plus ancien.
 * `rendus` : montants que le règlement en cours de modification libère sur son propre encaissement. */
export function encaissementsCandidats(mouvements: MouvementBancaire[], comptes: CompteBancaire[], devise: string, client: string, rendus: Record<string, number> = {}): EncaissementCandidat[] {
  const devises = new Map(comptes.map((c) => [c.id, c.devise]));
  return mouvements
    .filter((m) => m.credit > 0 && devises.get(m.compteId) === devise)
    .map((m) => ({ mouvement: m, devise, reste: r3(m.credit - (m.affecteClient ?? 0) + (rendus[m.id] ?? 0)), nommeLeClient: libelleNommeLeClient(`${m.libelle} ${m.details}`, client) }))
    .filter((c) => c.reste > 0.0005)
    .sort((a, b) => Number(b.nommeLeClient) - Number(a.nommeLeClient) || b.mouvement.dateOp.localeCompare(a.mouvement.dateOp));
}
