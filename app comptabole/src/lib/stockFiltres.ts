import type { StockMouvement } from "@/types";
import { coteRenseigne } from "@/lib/stockLot";

/** Situation d'un mouvement, en clair : soldé, écart, vendu sans achat, acheté sans vente. */
export type SituationStock = "solde" | "ecart" | "sans-achat" | "sans-vente" | "vide";
export type FiltreSituation = "tous" | "solde" | "ecart" | "sans-achat" | "sans-vente";

export function situationMouvement(m: StockMouvement): SituationStock {
  const achat = coteRenseigne(m, "achat");
  const vente = coteRenseigne(m, "vente");
  if (achat && vente) return m.ecart === 0 ? "solde" : "ecart";
  if (achat) return "sans-vente";
  if (vente) return "sans-achat";
  return "vide";
}

/** Texte comparable : sans accents, casse ni ponctuation. */
export const norme = (texte: string | null | undefined) =>
  String(texte ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export interface ValeurFiltre {
  /** Clé de comparaison (nom normalisé). */
  cle: string;
  /** Nom tel qu'il est le plus souvent saisi. */
  nom: string;
  nombre: number;
}

/** Les clients (vente) ou les fournisseurs (achat) présents, avec le nombre de mouvements de chacun, du A au Z. */
export function valeursTiers(mouvements: StockMouvement[], champ: "client" | "fournisseur"): ValeurFiltre[] {
  const groupes = new Map<string, { noms: Map<string, number>; nombre: number }>();
  for (const m of mouvements) {
    const nom = (champ === "client" ? m.client : m.fournisseur).trim();
    const cle = norme(nom);
    if (!cle) continue;
    const g = groupes.get(cle) ?? { noms: new Map<string, number>(), nombre: 0 };
    g.noms.set(nom, (g.noms.get(nom) ?? 0) + 1);
    g.nombre++;
    groupes.set(cle, g);
  }
  return [...groupes.entries()]
    .map(([cle, g]) => ({ cle, nom: [...g.noms.entries()].sort((a, b) => b[1] - a[1])[0][0], nombre: g.nombre }))
    .sort((a, b) => a.nom.localeCompare(b.nom, "fr", { numeric: true }));
}

export interface CriteresStock {
  situation: FiltreSituation;
  /** Clés (voir `valeursTiers`) des clients retenus ; vide = tous. */
  clients: ReadonlySet<string>;
  fournisseurs: ReadonlySet<string>;
  recherche: string;
}

export const CRITERES_VIDES: CriteresStock = { situation: "tous", clients: new Set(), fournisseurs: new Set(), recherche: "" };

/** Mouvements qui répondent à tous les critères : situation, client (côté vente), fournisseur (côté achat) et recherche libre. */
export function filtrerMouvements(mouvements: StockMouvement[], c: CriteresStock): StockMouvement[] {
  const mots = norme(c.recherche).split(" ").filter(Boolean);
  return mouvements.filter((m) => {
    if (c.situation !== "tous" && situationMouvement(m) !== c.situation) return false;
    if (c.clients.size > 0 && !c.clients.has(norme(m.client))) return false;
    if (c.fournisseurs.size > 0 && !c.fournisseurs.has(norme(m.fournisseur))) return false;
    if (mots.length === 0) return true;
    const texte = norme([m.venteNumFacture, m.achatNumFacture, m.client, m.fournisseur, m.natureMarchandise, m.douaneNumDeclaration].join(" "));
    return mots.every((mot) => texte.includes(mot));
  });
}

/** Nombre de mouvements par situation (pour les pastilles de filtre). */
export function comptesSituation(mouvements: StockMouvement[]): Record<FiltreSituation, number> {
  const comptes: Record<FiltreSituation, number> = { tous: mouvements.length, solde: 0, ecart: 0, "sans-achat": 0, "sans-vente": 0 };
  for (const m of mouvements) {
    const s = situationMouvement(m);
    if (s !== "vide") comptes[s]++;
  }
  return comptes;
}

/** Texte court de la situation, pour la pastille de l'écart : « sans achat », « sans vente », « soldé ». */
export const LEGENDE_SITUATION: Record<SituationStock, string> = { solde: "soldé", ecart: "", "sans-achat": "sans achat", "sans-vente": "sans vente", vide: "" };
