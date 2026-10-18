/**
 * Brouillons : le travail saisi mais pas encore enregistré survit à un changement de page (un clic malheureux sur « précédent » ou
 * « suivant », un lien suivi trop vite) et à un rechargement de l'onglet. Gardés en mémoire et dans `sessionStorage` (propre à
 * l'onglet, vidé à sa fermeture et à la déconnexion) ; jamais envoyés au serveur.
 */
const PREFIXE = "camconsult:brouillon:";
const memoire = new Map<string, string>();

const stockage = (): Storage | null => {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
};

export function lireBrouillon<T>(cle: string): T | null {
  let brut = memoire.get(cle) ?? null;
  if (brut === null) {
    try {
      brut = stockage()?.getItem(PREFIXE + cle) ?? null;
    } catch {
      brut = null;
    }
  }
  if (brut === null) return null;
  try {
    return JSON.parse(brut) as T;
  } catch {
    return null;
  }
}

export function ecrireBrouillon(cle: string, valeur: unknown): void {
  const brut = JSON.stringify(valeur);
  memoire.set(cle, brut);
  try {
    stockage()?.setItem(PREFIXE + cle, brut);
  } catch {
    // stockage plein ou refusé : le brouillon reste en mémoire, il survit au changement de page mais pas au rechargement
  }
}

export function effacerBrouillon(cle: string): void {
  memoire.delete(cle);
  try {
    stockage()?.removeItem(PREFIXE + cle);
  } catch {
    // rien à faire
  }
}

/** À la déconnexion : aucun brouillon ne doit rester pour la personne suivante sur ce poste. */
export function effacerTousLesBrouillons(): void {
  memoire.clear();
  try {
    const s = stockage();
    if (!s) return;
    for (const cle of Object.keys(s).filter((k) => k.startsWith(PREFIXE))) s.removeItem(cle);
  } catch {
    // rien à faire
  }
}
