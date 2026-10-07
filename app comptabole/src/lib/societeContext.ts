import type { NavGroup } from "@/components/layout/sidebar/navigation";

/** Modules dont chaque page est celle d'UNE société : /<module>/:societeId. */
export const MODULES_PAR_SOCIETE = [
  "/stock",
  "/fournisseurs",
  "/etats-financiers",
  "/honoraires",
  "/souche-cheques",
  "/suivi-devise",
] as const;

const ROUTE_SOCIETE = /^(\/(?:stock|fournisseurs|etats-financiers|honoraires|souche-cheques|suivi-devise))(?=\/|$)(?:\/([^/]+))?/;

/** Société portée par l'adresse courante (ex. /stock/abc -> abc), sinon null. */
export function societeIdFromPath(pathname: string): string | null {
  return ROUTE_SOCIETE.exec(pathname)?.[2] ?? null;
}

/** Adresse du même module pour une autre société (ou la liste si `societeId` est
 * null). Null quand la page courante n'est pas un module par société. */
export function cheminPourSociete(pathname: string, societeId: string | null): string | null {
  const m = ROUTE_SOCIETE.exec(pathname);
  if (!m) return null;
  return societeId ? `${m[1]}/${societeId}` : m[1];
}

/** Lien du menu : la page de la société active pour un module par société. */
export function lienDeSociete(to: string, societeId: string | null): string {
  return societeId && (MODULES_PAR_SOCIETE as readonly string[]).includes(to) ? `${to}/${societeId}` : to;
}

/** Menu dont les modules par société ouvrent directement la société active. */
export function ciblerNavigation(groups: NavGroup[], societeId: string | null): NavGroup[] {
  if (!societeId) return groups;
  return groups.map((group) => ({
    ...group,
    items: group.items.map((item) => ({
      ...item,
      to: item.to ? lienDeSociete(item.to, societeId) : item.to,
      children: item.children?.map((child) => ({ ...child, to: lienDeSociete(child.to, societeId) })),
    })),
  }));
}

interface AvecSociete {
  societeId?: string | null;
}

export interface DonneesDossier<S, T, N, C, V, B, J> {
  societes: S[];
  taches: T[];
  noeuds: N[];
  collectes: C[];
  conversations: V[];
  bordereaux: B[];
  journalEntries: J[];
}

/** Restreint les données du Dashboard à une société. Les bordereaux et le journal
 * ne sont pas rattachés à une société : ils sont retirés plutôt que montrés tels
 * quels, ce qui afficherait des chiffres du cabinet entier sous le nom d'un client. */
export function dossierDeSociete<
  S extends { id: string },
  T extends AvecSociete,
  N extends AvecSociete,
  C extends AvecSociete,
  V extends AvecSociete,
  B,
  J,
>(donnees: DonneesDossier<S, T, N, C, V, B, J>, societeId: string | null): DonneesDossier<S, T, N, C, V, B, J> {
  if (!societeId) return donnees;
  const memeSociete = <X extends AvecSociete>(x: X) => x.societeId === societeId;
  return {
    societes: donnees.societes.filter((s) => s.id === societeId),
    taches: donnees.taches.filter(memeSociete),
    noeuds: donnees.noeuds.filter(memeSociete),
    collectes: donnees.collectes.filter(memeSociete),
    conversations: donnees.conversations.filter(memeSociete),
    bordereaux: [],
    journalEntries: [],
  };
}
