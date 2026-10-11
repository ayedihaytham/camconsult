import type { Session } from "@/store/auth";

export type TourStep = {
  target: string | { desktop: string; mobile: string };
  title: string;
  body: string;
};

export type Tour = {
  id: string;
  version: number;
  title: string;
  steps: TourStep[];
};

const STATEMENT_VIEWS = new Set(["actif", "passif", "resultat", "flux"]);

/** One walkthrough for the shared statement reading pattern. */
export function financialViewTour(view: string): Tour | null {
  if (!STATEMENT_VIEWS.has(view)) return null;
  return {
    id: `finance-statement-${view}`,
    version: 1,
    title: "Lire cet état financier",
    steps: [
      { target: "finance-identity", title: "Vérifier le dossier", body: "Vérifiez la société et l’exercice avant de lire cet état." },
      { target: { desktop: "finance-navigation-desktop", mobile: "finance-navigation-mobile" }, title: "Changer de document", body: "Choisissez un autre état ou une note depuis la navigation du dossier." },
      { target: "finance-surface", title: "Lire les montants", body: "Parcourez les rubriques, sous-totaux et totaux de cet état. La comparaison avec un autre exercice apparaît si elle est disponible." },
      { target: "finance-tools", title: "Conserver une copie", body: "Les outils proposent les exports et impressions disponibles. La visite ne lance aucune action." },
    ],
  };
}

const responsiveSearch = {
  desktop: "page-search-desktop",
  mobile: "page-search-mobile",
};
const responsiveRows = {
  desktop: "page-table-desktop",
  mobile: "page-table-mobile",
};
const responsivePagination = {
  desktop: "page-pagination-desktop",
  mobile: "page-pagination-mobile",
};

function registry(
  id: string,
  title: string,
  purpose: string,
  next: string,
  create?: string,
): Tour {
  return {
    id,
    version: 1,
    title,
    steps: [
      { target: "page-identity", title, body: purpose },
      {
        target: responsiveSearch,
        title: "Rechercher et filtrer",
        body: "Saisissez un terme dans la recherche. Les filtres affinent la liste.",
      },
      {
        target: "page-content-header",
        title: "Votre registre",
        body: "Le nombre visible suit votre recherche et vos filtres.",
      },
      { target: responsiveRows, title: "Ouvrir un dossier", body: next },
      {
        target: responsivePagination,
        title: "Parcourir la liste",
        body: "Passez aux pages suivantes pour parcourir les autres résultats.",
      },
      ...(create ? [{ target: "page-primary-action", title: "Ajouter", body: create }] : []),
    ],
  };
}

const TOURS = {
  dashboard: {
    id: "dashboard",
    version: 1,
    title: "Tableau de bord",
    steps: [
      {
        target: "page-workspace",
        title: "Votre tableau de bord",
        body: "Retrouvez ici les informations utiles à votre rôle et à votre périmètre.",
      },
      {
        target: "dashboard-tabs",
        title: "Choisir une vue",
        body: "Changez de vue pour consulter le travail, les dossiers ou les messages disponibles pour vous.",
      },
      {
        target: "dashboard-summary",
        title: "Repérer l’essentiel",
        body: "Ces indicateurs résument les éléments qui demandent votre attention.",
      },
      {
        target: "dashboard-work",
        title: "Passer à l’action",
        body: "Ouvrez un élément du suivi pour poursuivre votre travail.",
      },
    ],
  },
  societes: registry(
    "societes",
    "Sociétés",
    "Consultez les sociétés accessibles et leur situation.",
    "Ouvrez une société pour consulter son dossier et ses informations.",
    "Si vous avez les droits nécessaires, ajoutez une société depuis cette commande.",
  ),
  employes: registry(
    "collaborateurs",
    "Collaborateurs",
    "Retrouvez les membres du cabinet et leur périmètre.",
    "Ouvrez une ligne pour consulter les accès et les sociétés associés.",
    "Ajoutez un collaborateur depuis cette commande si votre rôle le permet.",
  ),
  taches: {
    id: "taches",
    version: 1,
    title: "Tâches",
    steps: [
      {
        target: "page-identity",
        title: "Tâches",
        body: "Suivez le travail qui vous concerne selon votre rôle.",
      },
      {
        target: responsiveSearch,
        title: "Trouver une tâche",
        body: "La recherche et les filtres réduisent la liste des tâches affichées.",
      },
      {
        target: "tasks-board",
        title: "Suivre l’avancement",
        body: "Les colonnes montrent les tâches à faire, en cours et terminées.",
      },
      {
        target: "page-primary-action",
        title: "Créer une tâche",
        body: "Si vous y avez accès, créez une tâche depuis cette commande.",
      },
    ],
  },
  collecteList: {
    id: "collecte-list",
    version: 1,
    title: "Collecte de pièces",
    steps: [
      {
        target: "page-identity",
        title: "Collectes",
        body: "Suivez les dossiers de pièces et leur état.",
      },
      {
        target: "collecte-lenses",
        title: "Dossiers actifs et archives",
        body: "Changez de vue pour retrouver les dossiers en cours ou archivés.",
      },
      {
        target: responsiveSearch,
        title: "Rechercher",
        body: "Cherchez une collecte et utilisez les filtres pour affiner la liste.",
      },
      {
        target: responsiveRows,
        title: "Ouvrir un dossier",
        body: "Chaque ligne donne accès à la collecte, à son statut et à son échéance si elle existe.",
      },
      {
        target: responsivePagination,
        title: "Parcourir",
        body: "Utilisez la pagination pour voir les autres dossiers.",
      },
    ],
  },
  collecteWorkspace: {
    id: "collecte-workspace",
    version: 2,
    title: "Dossier de collecte",
    steps: [
      {
        target: "collecte-identity",
        title: "Votre dossier",
        body: "Le titre et le statut indiquent la collecte que vous consultez.",
      },
      {
        target: "collecte-navigation",
        title: "Parcourir le dossier",
        body: "Choisissez le tableau dans le sélecteur au-dessus de la saisie. Les autres sections disponibles dépendent de votre rôle ; le Récap est réservé à l'administrateur.",
      },
      {
        target: "collecte-content",
        title: "Compléter les informations",
        body: "Ajoutez ou modifiez les lignes dans la section ouverte.",
      },
      {
        target: "collecte-save",
        title: "Enregistrer",
        body: "Enregistrer conserve votre saisie. L'administrateur revient ensuite au Récap pour transmettre ou clôturer une demande. Le client transfère chaque tableau depuis sa barre fixe.",
      },
      {
        target: "collecte-tools",
        title: "Actions du dossier",
        body: "Le menu Outils regroupe l'export Excel, l'aperçu client, la modification et la relance selon vos droits.",
      },
    ],
  },
  stockDetail: {
    id: "stock-workspace",
    version: 1,
    title: "Gestion de stock",
    steps: [
      {
        target: "page-workspace",
        title: "Stock de la société",
        body: "Consultez les mouvements et les écarts de stock de ce dossier.",
      },
      {
        target: "stock-summary",
        title: "Lire les écarts",
        body: "Vérifiez les montants et les écarts calculés pour la société.",
      },
      {
        target: "stock-register",
        title: "Mouvements",
        body: "La liste détaille les achats et ventes enregistrés.",
      },
      {
        target: "stock-actions",
        title: "Poursuivre",
        body: "Les commandes autorisées permettent d’ajouter ou d’exporter des mouvements.",
      },
    ],
  },
  financeDossier: {
    id: "finance-dossier",
    version: 1,
    title: "Dossier financier",
    steps: [
      {
        target: "finance-identity",
        title: "Dossier financier",
        body: "Vérifiez la société et l’exercice affichés avant de lire les états.",
      },
      {
        target: {
          desktop: "finance-navigation-desktop",
          mobile: "finance-navigation-mobile",
        },
        title: "Changer de vue",
        body: "Choisissez un groupe puis un état, une note ou un contrôle.",
      },
      {
        target: "finance-tools",
        title: "Outils",
        body: "Les exports et impressions disponibles se trouvent ici.",
      },
      {
        target: "finance-surface",
        title: "Lire le document",
        body: "La zone centrale présente la vue financière sélectionnée.",
      },
    ],
  },
  balanceEditor: {
    id: "balance-editor",
    version: 1,
    title: "Éditeur de balance",
    steps: [
      {
        target: "balance-identity",
        title: "Balance de l’exercice",
        body: "Vérifiez la société et l’exercice avant de modifier des lignes.",
      },
      {
        target: "balance-indicators",
        title: "Contrôler la balance",
        body: "L’écart, le nombre de comptes et les codes AFFECTAT manquants aident à repérer ce qui reste à traiter.",
      },
      {
        target: "balance-grid",
        title: "Saisir les lignes",
        body: "Renseignez Compte, Libellé, Débit, Crédit et AFFECTAT. Le Solde est calculé.",
      },
      {
        target: "balance-actions",
        title: "Ajouter ou importer",
        body: "Ajoutez une ligne ou importez une balance depuis les commandes disponibles.",
      },
      {
        target: "balance-tools",
        title: "Enregistrer et exporter",
        body: "Utilisez les commandes de sauvegarde et les outils d’export lorsque votre travail est prêt.",
      },
    ],
  },
  affectat: {
    id: "grille-affectat",
    version: 1,
    title: "Grille AFFECTAT",
    steps: [
      {
        target: "page-identity",
        title: "Référentiel global",
        body: "Cette grille définit les codes et postes utilisés dans les états financiers du cabinet.",
      },
      {
        target: "affectat-search",
        title: "Trouver un code",
        body: "Cherchez par code, libellé ou poste. Les filtres limitent ensuite les résultats.",
      },
      {
        target: "affectat-register",
        title: "Lire le registre",
        body: "Chaque ligne montre un code, son libellé, son poste et ses comptes globaux rattachés.",
      },
      {
        target: {
          desktop: "affectat-rows-desktop",
          mobile: "affectat-rows-mobile",
        },
        title: "Modifier un poste",
        body: "Le poste global se modifie dans la ligne. Un avertissement explique son effet sur les états financiers.",
      },
      {
        target: "affectat-actions",
        title: "Autres actions",
        body: "Le menu de ligne permet de renommer ou retirer un code avec les confirmations nécessaires.",
      },
      {
        target: responsivePagination,
        title: "Parcourir les codes",
        body: "La pagination montre sept codes par page.",
      },
    ],
  },
  bordereaux: {
    id: "bordereaux",
    version: 1,
    title: "Bordereaux bancaires",
    steps: [
      {
        target: "page-workspace",
        title: "Bordereaux bancaires",
        body: "Retrouvez les bordereaux du cabinet dans cette page.",
      },
      {
        target: "bordereaux-filters",
        title: "Choisir une vue",
        body: "Utilisez les types et filtres disponibles pour retrouver un bordereau.",
      },
      {
        target: "bordereaux-register",
        title: "Lire les lignes",
        body: "Le registre présente les bordereaux et les informations de pointage.",
      },
      {
        target: "bordereaux-actions",
        title: "Créer ou exporter",
        body: "Les commandes de création et d’export restent sous votre contrôle.",
      },
    ],
  },
  deviseList: {
    id: "suivi-devise-list",
    version: 1,
    title: "Suivi client devise",
    steps: [
      {
        target: "page-identity",
        title: "Clients en devise",
        body: "Retrouvez les suivis de la société sélectionnée.",
      },
      {
        target: responsiveSearch,
        title: "Rechercher",
        body: "Cherchez un client ou un exercice dans la liste.",
      },
      {
        target: "devise-register",
        title: "Ouvrir un suivi",
        body: "Chaque ligne donne accès aux ventes, lots et mouvements du client.",
      },
      {
        target: "page-primary-action",
        title: "Créer un suivi",
        body: "Si la commande est disponible, créez un suivi depuis cette page.",
      },
    ],
  },
  deviseEditor: {
    id: "suivi-devise-editor",
    version: 1,
    title: "Suivi en devise",
    steps: [
      {
        target: "page-identity",
        title: "Dossier client en devise",
        body: "Vérifiez le client, l’exercice et la devise avant de travailler.",
      },
      {
        target: "devise-tabs",
        title: "Choisir une section",
        body: "Passez entre les factures, les lots et les mouvements.",
      },
      {
        target: "devise-editor",
        title: "Lire et compléter",
        body: "La section active présente les données et les commandes disponibles.",
      },
      {
        target: { desktop: "devise-actions", mobile: "page-primary-action" },
        title: "Outils",
        body: "Utilisez les actions autorisées pour ajouter, enregistrer ou exporter.",
      },
    ],
  },
  honorairesDetail: {
    id: "etat-client-detail",
    version: 1,
    title: "État client",
    steps: [
      {
        target: "page-identity",
        title: "Compte du client",
        body: "Consultez les déclarations, règlements et solde de cette société.",
      },
      {
        target: "honoraires-summary",
        title: "Lire les montants",
        body: "Le récapitulatif présente les montants et le solde courant.",
      },
      {
        target: responsiveSearch,
        title: "Rechercher",
        body: "Retrouvez une ligne par son libellé ou sa référence.",
      },
      {
        target: "honoraires-register",
        title: "Lire les opérations",
        body: "Les lignes détaillent les déclarations et les règlements.",
      },
      {
        target: "page-primary-action",
        title: "Actions autorisées",
        body: "L’ajout et la modification ne sont proposés qu’aux personnes habilitées.",
      },
    ],
  },
  chequesDetail: {
    id: "souche-cheques-detail",
    version: 1,
    title: "Souche de chèques",
    steps: [
      {
        target: "page-identity",
        title: "Chèques de la société",
        body: "Retrouvez les chèques enregistrés pour ce dossier.",
      },
      {
        target: "cheques-filters",
        title: "Filtrer",
        body: "Choisissez le statut et recherchez un chèque.",
      },
      {
        target: "cheques-register",
        title: "Consulter la souche",
        body: "Les lignes indiquent les montants et le suivi du débit.",
      },
      {
        target: "page-primary-action",
        title: "Créer et exporter",
        body: "Les commandes de saisie et d’export restent sous votre contrôle.",
      },
    ],
  },
  structuration: {
    id: "structuration",
    version: 1,
    title: "Structuration",
    steps: [
      {
        target: "page-workspace",
        title: "Structuration",
        body: "Organisez et retrouvez les documents du périmètre accessible.",
      },
      {
        target: "structuration-lenses",
        title: "Changer de vue",
        body: "Choisissez le tableau, l’arborescence ou l’organigramme.",
      },
      {
        target: "structuration-search",
        title: "Retrouver un élément",
        body: "La recherche et les filtres réduisent les résultats.",
      },
      {
        target: "structuration-content",
        title: "Parcourir le contenu",
        body: "Ouvrez les dossiers et fichiers depuis la zone de travail.",
      },
    ],
  },
  messagerie: {
    id: "messagerie",
    version: 1,
    title: "Messagerie",
    steps: [
      {
        target: "page-workspace",
        title: "Messagerie",
        body: "Échangez avec les personnes et groupes de votre périmètre.",
      },
      {
        target: "messages-list",
        title: "Choisir une conversation",
        body: "La liste montre les échanges et les messages non lus.",
      },
      {
        target: "messages-thread",
        title: "Lire les messages",
        body: "La conversation sélectionnée apparaît dans cette zone.",
      },
      {
        target: "messages-composer",
        title: "Rédiger",
        body: "Écrivez votre message ici. La visite n’envoie rien.",
      },
    ],
  },
  conversions: {
    id: "conversions",
    version: 1,
    title: "Conversions",
    steps: [
      {
        target: "page-workspace",
        title: "Conversions",
        body: "Convertissez les fichiers pris en charge depuis cet outil.",
      },
      {
        target: "conversions-upload",
        title: "Choisir un fichier",
        body: "Sélectionnez le fichier à convertir, puis lancez la conversion vous-même.",
      },
      {
        target: "conversions-results",
        title: "Voir le résultat",
        body: "Les fichiers produits et les options de téléchargement apparaissent ici.",
      },
    ],
  },
  journal: {
    id: "journal",
    version: 1,
    title: "Journal",
    steps: [
      {
        target: "page-workspace",
        title: "Journal",
        body: "Consultez la trace des actions enregistrées dans le cabinet.",
      },
      {
        target: "journal-filters",
        title: "Rechercher une action",
        body: "Filtrez le journal pour retrouver une personne ou une opération.",
      },
      {
        target: "journal-register",
        title: "Lire la trace",
        body: "Chaque ligne précise l’action et sa date.",
      },
      {
        target: "journal-actions",
        title: "Exporter ou effacer",
        body: "L’effacement du journal est une action sensible. La visite ne déclenche aucune commande.",
      },
    ],
  },
  parametres: {
    id: "parametres",
    version: 1,
    title: "Paramètres",
    steps: [
      {
        target: "page-workspace",
        title: "Paramètres",
        body: "Gérez les réglages du cabinet depuis cette page réservée à l’administration.",
      },
      {
        target: "parametres-account",
        title: "Compte et sécurité",
        body: "Vérifiez les informations du compte et les commandes de sécurité.",
      },
      {
        target: "parametres-data",
        title: "Données du cabinet",
        body: "Les sauvegardes, imports et réinitialisations peuvent avoir des conséquences importantes. La visite ne les lance jamais.",
      },
    ],
  },
} satisfies Record<string, Tour>;

export function getPageTour(
  pathname: string,
  _session: Session | null,
  search = "",
): Tour | null {
  if (pathname === "/") {
    if (_session?.poste === "societe_employe") return TOURS.dashboard;
    if (new URLSearchParams(search).get("tab") === "tasks") return {
      id: "dashboard-tasks", version: 1, title: "Tâches du tableau de bord",
      steps: [
        { target: "dashboard-tasks", title: "Le travail accessible", body: "Cette vue conserve les tâches accessibles à votre compte. Les tâches n’ont pas de date limite." },
        { target: "dashboard-task-lens", title: "Ouvertes ou terminées", body: "Changez de vue pour consulter le travail ouvert ou terminé. Les compteurs représentent tout le périmètre chargé." },
        { target: "dashboard-task-resume", title: "Reprendre une tâche", body: "Le dossier présente une tâche réellement en cours, dans l’ordre existant. Reprendre ouvre la page Tâches." },
        { target: "dashboard-task-ongoing", title: "Travail en cours", body: "Ce registre regroupe les tâches déjà commencées, leur société, leur collaborateur et leur statut." },
        { target: "dashboard-task-todo", title: "Tâches à commencer", body: "Les tâches à faire restent distinctes du travail en cours, sans priorité ni échéance inventée." },
        { target: "dashboard-task-completed", title: "Travail terminé", body: "Le même registre présente les tâches terminées lorsque cette vue est sélectionnée." },
        { target: "dashboard-task-open", title: "Ouvrir le travail", body: "Chaque ligne ouvre la page Tâches. Les tâches de société conservent leur indication de lecture seule au cabinet." },
      ],
    };
    return {
      id: "dashboard", version: 3, title: "Mon bureau",
      steps: [
        { target: "page-workspace", title: "Votre tableau de bord", body: "Votre bureau rassemble le travail accessible à votre compte. Aucune action n’est effectuée pendant la visite." },
        { target: "dashboard-summary", title: "Repérer l’essentiel", body: "Le bandeau situe votre journée de travail. Retrouvez les destinations autorisées dans Actions rapides et les vues du bureau." },
        { target: "dashboard-tabs", title: "Choisir une vue", body: "Mon bureau présente les aperçus du quotidien. Les autres onglets ouvrent les listes complètes accessibles à votre compte." },
        { target: "dashboard-resume", title: "Reprendre le travail", body: "Ce dossier met en avant une tâche réellement en cours. Reprendre ouvre la page Tâches pour la poursuivre." },
        { target: "dashboard-transmissions", title: "Préparer les transmissions", body: "Ce registre présente les collectes du jour sélectionné et les prochaines transmissions. Les tâches n’ont pas de date limite." },
        { target: "dashboard-deadline-strip", title: "Choisir une date", body: "Le repère Aujourd’hui situe la journée. Sélectionnez une date du rail pour consulter ses collectes, sans modifier leurs échéances." },
        { target: "dashboard-attention", title: "Repérer les éléments à traiter", body: "Les retards, corrections et éléments à examiner sont distingués dans ce suivi. Tout voir ouvre la liste complète." },
        { target: "dashboard-tasks", title: "Avancer sur les tâches", body: "Retrouvez le travail en cours et les tâches à commencer, séparés des échéances de collecte." },
        { target: "dashboard-attention-lens", title: "Consulter les éléments à traiter", body: "Cette vue regroupe corrections, échéances dépassées et communication. Les vues disponibles suivent vos droits." },
        { target: "dashboard-quick-actions", title: "Accéder aux modules", body: "Actions rapides ouvre les destinations autorisées. La visite ne crée, n’envoie et ne modifie aucun élément." },
      ],
    };
  }
  if (pathname === "/societes") return TOURS.societes;
  if (pathname === "/employes") return TOURS.employes;
  if (pathname === "/taches") return TOURS.taches;
  if (pathname === "/collectes") return TOURS.collecteList;
  if (/^\/collectes\/[^/]+$/.test(pathname)) return TOURS.collecteWorkspace;
  if (pathname === "/stock")
    return registry(
      "stock-registry",
      "Gestion de stock",
      "Choisissez une société pour consulter ses mouvements de stock.",
      "Ouvrez une société pour accéder à ses achats, ventes et écarts.",
    );
  if (/^\/stock\/[^/]+$/.test(pathname)) return TOURS.stockDetail;
  if (pathname === "/etats-financiers")
    return registry(
      "finance-registry",
      "États financiers",
      "Choisissez une société accessible pour consulter ses états.",
      "Ouvrez la société pour parcourir ses exercices et documents financiers.",
    );
  if (/^\/etats-financiers\/[^/]+$/.test(pathname)) return TOURS.financeDossier;
  if (
    /^\/etats-financiers\/[^/]+\/[^/]+$/.test(pathname) &&
    !pathname.endsWith("/imprimer")
  )
    return TOURS.balanceEditor;
  if (pathname === "/grille-affectat") return TOURS.affectat;
  if (pathname === "/bordereaux") return TOURS.bordereaux;
  if (pathname === "/honoraires")
    return registry(
      "etat-client-registry",
      "État client",
      "Choisissez une société pour consulter son compte courant.",
      "Ouvrez une société pour retrouver ses déclarations et règlements.",
    );
  if (/^\/honoraires\/[^/]+$/.test(pathname)) return TOURS.honorairesDetail;
  if (pathname === "/souche-cheques")
    return registry(
      "souche-cheques-registry",
      "Souche de chèques",
      "Choisissez une société pour consulter ses chèques.",
      "Ouvrez une société pour voir sa souche et le suivi des débits.",
    );
  if (/^\/souche-cheques\/[^/]+$/.test(pathname)) return TOURS.chequesDetail;
  if (pathname === "/suivi-devise")
    return registry(
      "suivi-devise-registry",
      "Suivi client devise",
      "Choisissez une société pour consulter ses suivis en devise.",
      "Ouvrez une société pour voir ses clients et exercices.",
    );
  if (/^\/suivi-devise\/[^/]+$/.test(pathname)) return TOURS.deviseList;
  if (/^\/suivi-devise\/[^/]+\/[^/]+$/.test(pathname))
    return TOURS.deviseEditor;
  if (pathname === "/structuration") return TOURS.structuration;
  if (pathname === "/messagerie") return TOURS.messagerie;
  if (pathname === "/conversions") return TOURS.conversions;
  if (pathname === "/journal") return TOURS.journal;
  if (pathname === "/parametres") return TOURS.parametres;
  return null;
}
