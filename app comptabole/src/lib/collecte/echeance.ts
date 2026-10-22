const JOUR_MS = 86_400_000;

/** Jours entre aujourd'hui et une échéance AAAA-MM-JJ (négatif une fois dépassée), dates locales sans l'heure. */
export function joursAvantEcheance(echeance: string, maintenant: Date): number {
  const [a, m, j] = echeance.slice(0, 10).split("-").map(Number);
  const cible = new Date(a, (m || 1) - 1, j || 1);
  const aujourdhui = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate());
  return Math.round((cible.getTime() - aujourdhui.getTime()) / JOUR_MS);
}

/** Échéance en clair : « Aujourd'hui », « dans 5 j », « Retard de 3 j » ; null sans échéance. */
export function libelleEcheance(echeance: string | null, maintenant: Date): { texte: string; retard: boolean } | null {
  if (!echeance) return null;
  const jours = joursAvantEcheance(echeance, maintenant);
  if (jours < 0) return { texte: `Retard de ${-jours} j`, retard: true };
  if (jours === 0) return { texte: "Aujourd'hui", retard: false };
  return { texte: `dans ${jours} j`, retard: false };
}
