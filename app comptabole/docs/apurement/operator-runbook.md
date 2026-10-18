# Apurement — exploitation et utilisation

## Périmètre et accès

Menu **Comptabilité → Apurement TVA** (`/apurement`). Achats seulement.
L’équipe prépare sur son périmètre ; administrateur et responsable des
collaborateurs revoient les anomalies, valident et enregistrent les dépôts.
Les comptes société n’ont aucun accès, y compris aux téléchargements.

Pour tester depuis zéro : [manuel de recette complet](MANUEL_RECETTE.md),
26 scénarios avec valeurs à copier et résultats attendus, conservés pour la
recette technique. Le kit est dans `public/apurement-demo/`, sans lien de
démonstration dans le parcours courant.

**Parcours courant simplifié :** consulter le [guide sans prérequis comptables](GUIDE_UTILISATION.md).
Le bandeau bleu et les tables Ledger sont rétablis. L’accueil propose trois
actions : ajouter des factures, compléter les informations, faire vérifier la
déclaration. Les références et réglages passent par **Dossier…**.
La première facture peut créer fournisseur, autorisation et BC dans une seule
transaction. Après enregistrement, la fiche reste ouverte sur les justificatifs.
Les sélecteurs de preuve se mettent à jour après upload, sans actualisation manuelle.
Les liens de démonstration et l’action d’export BCD de test ne sont plus présentés
dans le parcours courant ; les archives et garde-fous fiscaux sont conservés.

Organisation : **Mon trimestre**, **Factures**, **À compléter**, **Déclaration**.
Le menu **Dossier…** contient les références, le profil fiscal et les rappels.
Les preuves se joignent aux fiches ; **Comment ça marche ?** donne accès au guide.

### Justificatifs et Structuration

**Associer une pièce existante** ouvre un sélecteur avec chargement, recherche,
état vide et erreurs explicites. Le dossier par défaut est
`Société / Apurement TVA / Année / Trimestre / Factures|Déclarations|Dépôts` ;
les autorisations et BC sont dans `Apurement TVA / Autorisations|Bons de commande`.
**Tous les documents de la société** permet aussi de réutiliser les autres
pièces de Structuration, Collecte et Stock. PDF/PNG/JPEG uniquement, 8 Mo maximum.
Le lien vers Structuration ouvre le dossier exact dans l'onglet Documents.
Après un import dans cet onglet, revenir au sélecteur et choisir **Actualiser**.

Les nouveaux uploads Apurement sont aussi enregistrés dans `noeuds`, dans ce
dossier. Les originaux existants ne sont ni déplacés ni écrasés ; chaque liaison
conserve sa preuve immuable. Les anciens uploads demeurent téléchargeables via
leurs preuves ; aucun reclassement massif des archives n'est exécuté.

Le schéma ajoute seulement `noeuds.cabinet_only`, faux par défaut pour les
éléments existants. Les dossiers Apurement créés et les fichiers déposés dedans
sont internes. Cette restriction est héritée lors d'un dépôt et conservée après
déplacement ou duplication ; listes, bootstrap et téléchargement la vérifient.
Elle est conservée dans la sauvegarde/restauration. Les signaux Structuration
des nouveaux uploads Apurement partent après validation de la transaction.

Un `304 Not Modified` dans les outils réseau signifie normalement une
revalidation du cache HTTP : le navigateur réutilise le contenu déjà reçu.
L'ancien bouton masquait le résultat quand la liste était vide. Le sélecteur
affiche désormais cet état ; sa réponse de liste porte `Cache-Control: private,
no-store`. Un refus d'association est affiché et ne ferme pas la fenêtre.

1. Choisir société, année et trimestre. Le contexte société de la barre supérieure
   reste partagé avec les autres modules.
2. Vérifier les fournisseurs et leurs identités fiscales, puis créer une
   autorisation et ses BC. Un fournisseur par BC, un BC par facture.
3. Saisir une facture autonome ou partir de Stock : **Lier à un BC en suspension**.
   Confirmer ensuite la source et la résolution ; une suggestion n’est pas une
   preuve d’éligibilité. Les alias fournisseur se confirment explicitement.
4. Associer les pièces depuis Collecte, Structuration ou Stock, ou déposer un
   PDF/PNG/JPEG (8 Mo). Les pièces associées ont une copie immuable avec SHA-256.
5. Utiliser **Importer** pour le modèle Factures XLS/XLSX ou le BCD observé.
   Le taux est renseigné explicitement ; sélectionner les lignes et justifier les
   écarts. Aucune facture n’est créée par l’aperçu. Une validation de lot est
   atomique ; une erreur annule tout le lot. Rapport JSON et originaux conservés.
   En présence de correspondances, choisir explicitement **Mettre à jour** et
   justifier ; l’ancien HT/TVA et la version sont affichés. Une révision devenue
   périmée impose un nouvel aperçu. L’import ne confirme aucune modification
   monétaire Stock ; corriger et rapprocher la source avant de réessayer.
6. Dans **Contrôles**, compléter les blocages et faire revoir individuellement
   les avertissements. Les acquittements sont liés à l’empreinte des données.
7. Dans **Dossier… → Profil fiscal et rappels**, vérifier le profil déclarant et configurer
   l’échéance interne. Aucune date limite légale n’est présumée.
8. Préparer une déclaration, contrôler son aperçu puis soumettre à validation.
   Le validateur doit disposer d’une décision d’arrondi interne documentée et
   de sa preuve. Seul le calcul par facture au millime, demi supérieur, est pris
   en charge ; si cette règle n’est pas celle approuvée, conserver le verrou B2.
   La confirmation de cette règle ne valide pas le format BCD officiel.
9. Valider et figer. Un aperçu périmé provoque 409 : recharger et vérifier les
   montants. Excel et PDF internes utilisent le snapshot ; leurs octets sont
   conservés, indépendamment des modifications ultérieures.
   Avant validation, Excel et PDF sont disponibles comme **brouillons non
   validés**, avec ce statut dans le fichier et son nom. Leur génération
   n’approuve jamais les données ni le calcul fiscal.
10. Enregistrer manuellement le dépôt et sa preuve, puis son acceptation ou
    rejet avec preuve et motif. Généré ≠ déposé ≠ accepté. Un rejet prépare une
    nouvelle version ; les versions et fichiers antérieurs restent consultables.

## Conflits Stock

- Les dates, numéros et noms vérifiés se synchronisent dans une transaction
  commune. La TVA manuelle reste dans Apurement, avec son motif.
- Une correction monétaire inverse exige une confirmation explicite et exactement
  une ligne d’achat, quantité 1, devise TND, cours 1. Prix et deux montants sont
  alors mis à jour exactement, sans toucher aux marchandises ni aux ventes.
- Tout autre cas exige une correction des lignes dans Stock (B5). Aucune
  répartition proportionnelle ou modification implicite du cours n’est effectuée.
- Le mouvement lié ne se supprime pas. Un brouillon peut être explicitement délié ;
  une facture utilisée dans une version figée conserve son lien.
- Une modification Stock après validation crée un conflit et une notification
  interne. Le snapshot reste intact ; revoir puis préparer une rectificative.
- Les formulaires ouverts ne sont pas réécrits lors d’une actualisation au retour
  sur la fenêtre. Une version devenue périmée est refusée à l’enregistrement.

## Pièces manquantes et rappels

Une pièce manquante est d’abord interne. L’utilisateur peut choisir une collecte
de la même société et **confirmer** une demande neutre au client. Le message ne
contient ni montant fiscal ni mention d’Apurement. Le reste des notifications
Apurement reste exclusivement interne. Le validateur confirme les pièces vérifiées.
Les rappels ont une cadence et une date configurées, avec déduplication durable
par destinataire et fenêtre. Les signaux SSE partent après commit.

## Verrous et limites

Voir [export-gates.md](export-gates.md). L’export officiel est refusé même avec
`APUREMENT_OFFICIAL_BCD_ENABLED=true`, car aucun profil officiel signé n’est livré.
Le fichier de test porte `TEST_NON_OFFICIEL` ; ne pas le déposer comme officiel.
Les dates mensuelles ne deviennent jamais artificiellement des dates complètes.
Les avoirs, ventes, imputations multi-BC et soumissions automatiques sont exclus.

Les imports sont limités à 10 Mo / 2000 lignes. Excel est lu dans un worker
limité à 128 Mo et 10 secondes, deux lectures simultanées par processus.
La bibliothèque XLS historique du produit reste ancienne : cette isolation
réduit les risques, elle ne vaut pas certification de sécurité du parseur.
Seul le modèle Excel observé est reconnu ; un autre modèle doit être adapté
explicitement avant utilisation. Aucun document client n’est stocké dans Git.

## Déploiement et retour arrière

1. Obtenir validation métier, politique de rétention et sauvegardes (B7), puis
   configurer les échéances (B8). Vérifier les habilitations réelles.
2. Sauvegarder la base avec `pg_dump -Fc` et conserver une copie hors serveur.
   Tester la restauration sur une base neuve, jamais sur la production en place.
3. Arrêter les écritures pendant la migration prévue. `ensureSchema` applique
   d’abord le schéma existant, puis `server/apurement/schema.sql` ; aucune donnée
   métier existante n’est supprimée. Prévoir une fenêtre pour les verrous DDL.
4. Déployer frontend et serveur ensemble. Garder le BCD officiel bloqué.
   Rejouer une saisie, une liaison Stock, un conflit, une revue et un téléchargement
   avec des utilisateurs de recette. Vérifier l’absence d’accès société.
5. Pour revenir au code précédent : arrêter le nouveau serveur, déployer le
   précédent, conserver les tables Apurement. Ne pas lancer de migration inverse
   supprimant des données fiscales. Conserver une copie du build de cette version
   pour consulter les archives. Restaurer une sauvegarde uniquement vers une base
   neuve, après analyse des écritures intervenues depuis la sauvegarde.

Une restauration réelle `pg_dump`/`pg_restore` avec preuves et snapshots
synthétiques est automatisée dans le test d’intégration Apurement quand `PG_BIN`
est fourni. Cela ne remplace pas la répétition sur l’infrastructure de production.
