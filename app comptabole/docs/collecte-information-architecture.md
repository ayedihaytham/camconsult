# Collecte de pièces — espaces de travail

## Cabinet

- **Entrée `/collectes` :** la vue « À examiner » s’ouvre par défaut, compte les tableaux transmis et filtre les dossiers avec une revue en attente. Chaque ligne ouvre le dossier.
- **Dossier :** identité, période, statut, réception et échéance restent en tête. Le premier tableau transmis s’ouvre directement; son statut, les pièces jointes liées et les actions de validation/renvoi sont dans le même espace.
- **Navigation :** checklist, récap, documents, historique et chaque tableau demandé ont leur propre destination directe. Les tables apparaissent dans un sélecteur compact groupé par famille; chaque statut et case à compléter restent visibles dans la liste.
- **Revue :** les 14 définitions, statuts indépendants, calculs, notes, import/export et confirmations de transmission/renvoi restent branchés aux stores et API existants. Un changement de section volontaire enregistre le brouillon, annonce l’opération et conserve la section en cas d’échec.

## Client

- **Entrée `/collectes` :** ses dossiers autorisés restent visibles dans le registre; l’interface n’expose pas les commandes du cabinet.
- **Dossier :** le premier récap demandé ou tableau encore ouvert s’affiche immédiatement. Pour une saisie vide, la première ligne est préparée et le curseur placé dans la première case. Les demandes de récap ouvrent la table et la case concernées.
- **Navigation :** checklist, récap, documents et vérification sont des destinations visibles; les tableaux sont accessibles dans un sélecteur groupé par famille. Le client peut choisir un tableau sans suivre un assistant linéaire.
- **Saisie/transmission :** « Enregistrer et vérifier » sauvegarde via le store existant puis ouvre un récapitulatif avant transmission. La transmission globale conserve son avertissement et sa confirmation; les réponses de récap restent distinctes et gardent leur action existante.

## Contexte partagé

- Les fichiers attachés au dossier ou au tableau actif sont visibles depuis ce tableau, avec aperçu et téléchargement quand les données du fichier sont disponibles.
- Les états de sauvegarde, erreurs, cases manquantes et statuts réels restent visibles au point de travail.
- Les couleurs marine/or de CamConsult, la typographie, les boutons et les composants partagés sont conservés.
- Les actions visibles ne remplacent jamais les contrôles de rôles, société, statut et permissions des routes Express.
