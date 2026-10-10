# Collecte de pièces — barre de saisie compacte (10/10/2026)

Ce lot est limité à l'interface du tableau et ne modifie ni les endpoints, ni les calculs, ni les droits.

- Les exports Excel, PDF et Imprimer de **ce tableau** sont rendus dans la barre sticky de `CollecteGrid`, via la prop `exportActions` alimentée par le composant existant `SectionExport` : aucun nouveau moteur d'export.
- L'ancien indicateur de modifications dans `SectionHeader` est retiré; l'état (« Non enregistré », « Enregistré » ou erreur) apparaît uniquement près de l'action d'enregistrement dans la barre sticky.
- Les bordereaux disposent d'un suivi en temps réel (montant réparti/attendu, nombre de lignes, complétude). Chaque bordereau a son action contextuelle « Ajouter un chèque/une traite » directement dans sa fiche.
- « Nouveau bordereau » demeure accessible dans cette zone de suivi mais n'est plus dupliqué avec un bouton générique « Ajouter un chèque » sous le suivi. Les tableaux non groupés conservent « Ajouter une ligne ».
- « Importer un document » et « Enregistrer » restent dans la même barre au-dessus du tableau. Pour un client, « Enregistrer et vérifier » conserve la navigation vers le Récap; la transmission reste une action distincte.
- Aucun bouton de saisie/export/enregistrement n'est ajouté sous le tableau : les notes de l'onglet suivent directement la grille.

## Validation

- Analyse syntaxique TypeScript/TSX via `typescript.createSourceFile` : OK pour les composants et tests modifiés.
- Suite Vitest / build TypeScript complet / navigateur : **non exécutés**. Les modules npm ne sont pas installables hors ligne dans cet environnement (`ENOTCACHED`), et les dépendances existantes ne sont que des répertoires vides.
- Tester la barre sticky dans un vrai navigateur avec de longs tableaux, plusieurs bordereaux, et les rôles cabinet/client avant production.
