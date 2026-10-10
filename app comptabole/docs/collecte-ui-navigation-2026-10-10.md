# Collecte de pièces — navigation et barre de travail (10/10/2026)

## Modifications de cette livraison

- Bandeau de collecte restauré en couleur `primary` (bleu nuit de l'application) avec identité, état, échéance et actions autorisées. Les actions globales (`Tout en Excel`, `Aperçu client`, `Modifier la collecte`, `Relancer maintenant`, validation/renvoi/archivage global) sont désormais des boutons visibles au lieu du menu « Actions ».
- Exports Excel/PDF/impression par tableau directement visibles, y compris en disposition étroite.
- Barre de travail du tableau déplacée au-dessus des colonnes et rendue `position: sticky; top: 0`. Elle regroupe la répartition en temps réel des bordereaux, l'ajout de lignes/nouveaux bordereaux/chèques selon le tableau, l'import grand livre pour les tableaux compatibles, l'état des modifications et le bouton d'enregistrement.
- L'ancien panneau de répartition, les commandes d'ajout/import et la commande d'enregistrement sous la grille sont retirés. Les indications de souche et de saisie sont placées avant la grille; les notes restent après la grille.
- Pour les utilisateurs clients autorisés à éditer, « Enregistrer et vérifier » persiste la saisie, puis ouvre `?tab=recap` (sans transmission implicite). Le récap inclut la synthèse de vérification et une action « Transmettre au cabinet » visible dès le haut de cette vue. L'ancien lien `?tab=verification` reste rendu pour compatibilité, mais ne figure plus dans la navigation principale.
- Les chemins individuels de transmission, ainsi que la validation cabinet, sont conservés pour préserver les contrats et les circuits métier existants.

## Code concerné

- `src/pages/collectes/CollecteEditorPage.tsx`
- `src/pages/collectes/CollecteGrid.tsx`
- `src/pages/collectes/CollecteClientVerification.tsx`
- `src/pages/collectes/CollecteEditorPage.test.tsx`

## Vérification

- Analyse syntaxique TSX via TypeScript : réussie pour les quatre fichiers ci-dessus.
- Contrôles statiques de placement : bandeau bleu, boutons globaux visibles, répartition et barre de saisie avant la grille, action client menant au récap : réussis.
- Suite Vitest, contrôle de types intégral, build Vite et validation navigateur : **non exécutés** dans cet environnement ; `npm ci` n'a pas pu terminer l'installation des dépendances.
- Sur un poste de développement : `npm ci`, `npm run lint`, `npm test -- --run`, `npm run build` et contrôle manuel à 1440 / 768 / 375 px avec compte client et compte cabinet.

## Points d'attention à valider manuellement

- Comportement de la barre sticky dans le conteneur de défilement de l'application pour des tableaux de plus de 100 lignes, ainsi qu'en présence de plusieurs bordereaux.
- Transition `Enregistrer et vérifier` → `Récap` (l'écriture doit réussir avant la navigation ; un échec doit laisser le tableau et les modifications disponibles).
- Action finale de transmission : aucune modification de statut ne doit être effectuée par le seul bouton d'enregistrement.
- Les actions de transfert par tableau et de gestion globale sont volontairement conservées afin de maintenir les permissions et les circuits indépendants.
