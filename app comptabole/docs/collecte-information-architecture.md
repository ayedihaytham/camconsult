# Collecte de pièces — architecture de l’information

Le registre et le dossier partagent les composants CamConsult (marine, papier chaud, filets sobres, typographie existante). L’interface adapte la priorité aux tâches du rôle, sans modifier les statuts ni les droits.

## Registre `/collectes`

- **Cabinet :** registre de dossiers actifs, échéances et statuts; recherche/filtres; action d’ouverture contextualisée; création disponible aux rôles qui y ont droit; archives et suppression selon les droits actuels.
- **Client :** ses dossiers uniquement, avec période, échéance, avancement et action de reprise/remplissage; aucune commande de gestion du cabinet.
- La liste reste branchée au store existant et aux filtres/calculs métier existants.

## Dossier `/collectes/:id`

1. **Identité et état** — société, période, échéance, statut et avancement des pièces. Les actions globales restent visibles aux seuls rôles autorisés et annoncent clairement leur portée.
2. **Prochaine étape** — un résumé actionnable reste visible au-dessus du contenu : tableau transmis à examiner pour le cabinet; tableau ouvert ou récap demandé à compléter pour le client; états reçus, validés et archivés accessibles sans devenir des actions prioritaires.
3. **Checklist** — réception, total, date de suivi, commentaire et accès direct au tableau correspondant; ajout des tableaux manquants pour le cabinet autorisé.
4. **Récap** — demandes ciblées tableau par tableau, avec état et navigation directe vers les cases concernées.
5. **Tableaux** — saisie/grille existante, groupée en Chèques (CHQ), Virements (VRT), Traites (TR) et autres tableaux; archives séparées. Les 14 définitions et leurs états restent accessibles.
6. **Documents** — dépôt, aperçu et opérations de fichiers autorisées.
7. **Historique** — journal d’audit visible au cabinet.

La navigation de dossier est placée avant le contenu pour éviter de parcourir une longue grille avant de changer de section; elle reste défilable sur petits écrans. La sélection conserve la sauvegarde/protection des saisies non enregistrées. Les raccourcis de prochaine étape ne font que sélectionner une section existante.
