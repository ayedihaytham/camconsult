/** Droits par défaut selon le rôle du collaborateur (miroir de src/store/data.ts). */
export function defaultPermissions(type) {
  switch (type) {
    case "Comptable":
      return {
        consulterDossiers: true,
        deposerFichiers: true,
        modifierSocietes: true,
        supprimer: true,
        messagerie: true,
      };
    case "Gestionnaire de paie":
    case "Assistant":
      return {
        consulterDossiers: true,
        deposerFichiers: true,
        modifierSocietes: false,
        supprimer: false,
        messagerie: true,
      };
    case "Stagiaire":
    default:
      return {
        consulterDossiers: true,
        deposerFichiers: false,
        modifierSocietes: false,
        supprimer: false,
        messagerie: true,
      };
  }
}

/** Droits fixes d'un employé de société cliente : lecture des dossiers de sa société + messagerie. */
export function societeEmployePermissions() {
  return {
    consulterDossiers: true,
    deposerFichiers: false,
    modifierSocietes: false,
    supprimer: false,
    messagerie: true,
  };
}

export function can(session, key) {
  return Boolean(session?.permissions?.[key]);
}
