export interface ModuleApp {
  cle: string;
  libelle: string;
  chemins: string[];
  exact?: boolean;
  api: string[];
  dependants?: string[];
}
export const MODULES: ModuleApp[];
export const MODULES_PRODUCTION: string[];
export function lireModulesActifs(valeur: string | undefined | null): Set<string> | null;
export function moduleDuChemin(chemin: string): string | null;
export function moduleDeApi(url: string): ModuleApp | null;
export function cheminOuvert(actifs: Set<string> | null, chemin: string): boolean;
export function apiOuverte(actifs: Set<string> | null, url: string): boolean;
