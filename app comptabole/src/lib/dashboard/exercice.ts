/** Exercice comptable du jour : année civile (clôture au 31 décembre). Uniquement calculé à partir de la date. */
export interface ExerciceDuJour {
  annee: number;
  /** Jours restants avant la clôture (0 le 31 décembre). */
  joursRestants: number;
  /** Part de l'exercice écoulée, de 0 à 100. */
  pourcent: number;
}

const JOUR = 86_400_000;

export function exerciceDuJour(now: Date): ExerciceDuJour {
  const annee = now.getFullYear();
  const debut = Date.UTC(annee, 0, 1);
  const cloture = Date.UTC(annee, 11, 31);
  const aujourdhui = Date.UTC(annee, now.getMonth(), now.getDate());
  const total = Math.round((cloture - debut) / JOUR) + 1;
  const ecoules = Math.round((aujourdhui - debut) / JOUR) + 1;
  return {
    annee,
    joursRestants: Math.max(0, Math.round((cloture - aujourdhui) / JOUR)),
    pourcent: Math.min(100, Math.max(0, Math.round((ecoules / total) * 100))),
  };
}

/** « dans 42 jours », « demain », « aujourd'hui » : durée avant la clôture, en toutes lettres. */
export function dureeAvantCloture(joursRestants: number): string {
  if (joursRestants === 0) return "aujourd'hui";
  if (joursRestants === 1) return "demain";
  return `dans ${joursRestants} jours`;
}
