# Checkpoint Apurement — 17 octobre 2026

## Simplification supplémentaire — 18 octobre 2026

- Bandeau bleu et typographie `SignatureLedgerBanner` rétablis ; tableaux
  `LedgerTable` partagés, avec pagination serveur unique. Aucun changement de
  style imposé aux autres pages ; l’option de masquage du pied est facultative.
- Parcours courant : **Mon trimestre → Factures → À compléter → Déclaration**.
  Références et réglages dans **Dossier…**. Accueil à trois actions, aide en
  langage courant et [guide sans prérequis](GUIDE_UTILISATION.md).
- Saisie depuis zéro dans une seule fiche : fournisseur, autorisation et BC
  peuvent être créés avec la facture. Service `intake.js`, API `POST /achats`,
  validateurs et audit existants réutilisés ; verrou société et transaction
  uniques. Tout est annulé en cas d’erreur. Identifiant de soumission audité :
  nouvelle tentative identique sans doublon, contenu différent refusé en 409.
  Aucune vérification fiscale implicite du fournisseur.
- Après création, fiche maintenue ouverte sur les pièces. Listes de preuves
  actualisées après upload, sans bouton d’actualisation à manipuler.
- Liens de démonstration et action BCD de test retirés des écrans courants.
  Modèle Excel vierge sans données d’exemple disponible. Tests techniques,
  archives, véritables statuts de brouillon et verrous fiscaux B1/B2 conservés.
  Aucun export non vérifié renommé en export officiel.

Vérification : lint/build réussis ; suite globale **1373 tests réussis, 42 ignorés
préexistants**, 159 fichiers réussis et un ignoré. Après ajout du modèle vierge,
30 tests ciblés réussis (24 scénarios PostgreSQL, imports/interface et fichiers),
dont création combinée, répétition idempotente, refus des droits/sociétés et
rollback sans référence ni audit partiel. Migration et restauration réelles
réexécutées dans la base temporaire. Chrome : dix parcours complets réussis,
création des quatre entités puis upload comprise, et 28 contrôles de largeur sur
sept surfaces à 375/768/1024/1440 px. Deux passes visuelles ; navigation mobile
corrigée. Aucun débordement global ni erreur JavaScript au passage final.

Fichiers principaux : `server/apurement/intake.js`, route et store Apurement,
formulaire, page, documents et déclaration, table partagée (option compatible),
tour version 3, guide/publications statiques et générateur du modèle vierge.
Journaux `%TEMP%/apurement-simple-*.log`. Une dépendance déjà déclarée manquante
(`fast-xml-parser`) a été réinstallée localement ; manifests et lockfile inchangés.
Aucune migration supplémentaire, base ou publication de production modifiée.

---

## Mise à jour du 18 octobre 2026 — ergonomie et recette

Demande traitée : clarifier le refus 422 d’import, réorganiser les parcours pour
les comptables et fournir une recette complète avec fichiers fictifs.

- Le 422 de la capture correspond à la garde existante `IMPORT_REVUE_SOURCE` :
  écart de pied et identité déclarant différents sans justification. La garde
  serveur est conservée. L’interface indique maintenant les exigences avant
  envoi et interdit la confirmation tant qu’elles manquent. L’identité différente
  nécessite aussi une confirmation explicite dans l’interface ; jamais de choix
  automatique ni de correction silencieuse des montants.
- En-tête compact, parcours du trimestre guidé, Achats avec saisie/import,
  références Fournisseurs/Autorisations/BC, contrôles identifiés par numéro de
  facture et fournisseur, déclarations structurées, profil et rappels en Réglages.
  Champs de correction TVA conditionnels ; exceptions de date et période repliées.
  Import en trois étapes, résumés et messages lisibles, rendu mobile paginé.
- Correction du profil fiscal neuf : champs facultatifs initialisés en chaînes
  vides et exigences raison sociale/MF/référence visibles. Les champs non touchés
  ne provoquent plus de rejet de validation pour valeur absente.
- [MANUEL_RECETTE.md](MANUEL_RECETTE.md) : T01–T25, valeurs à copier, totaux
  attendus, approbation et dépôts simulés, Stock/Collecte, droits, conflits,
  rappels, responsive et restauration. Kit public synthétique dans
  `public/apurement-demo/` ; XLS/XLSX, BCD cohérent et écart +13, PDF fictifs.
  Générateur sans accès base : `server/scripts/generate-apurement-demo.mjs`.
  Manuel téléchargeable depuis Mode d’emploi et modèle depuis l’import.

Fichiers principaux : `src/pages/apurement/{ApurementPage,ImportPanel,EntitySheet,
DeclarationPanel,ProfilePanel}.tsx`, `src/lib/apurementImport.ts`, DTO contrôles
et `server/apurement/controls.js`, tour version 2, manuel/kit et runbook.

Vérification finale : lint et build réussis ; **1332 tests réussis, 41 tests
préexistants ignorés**, dans 155 fichiers réussis et un fichier ignoré. Six
nouveaux tests vérifient la garde de revue dans l’interface, la conservation
après conflit, le profil neuf et tous les modèles fournis. Aucun nouveau test
ignoré. PostgreSQL jetable utilisé, migration/restauration réelle incluses.
Chrome : huit parcours interface→API→SQL réussis, dont le scénario +0.013 / MF
différent, ainsi que 28 contrôles de largeur sur sept surfaces à
375/768/1024/1440 px ; aucune erreur JavaScript ni débordement global.
Deux passes visuelles bornées ; correction de l’empiètement du résumé sur mobile.
`git diff --check` réussi. Journaux locaux `%TEMP%/apurement-ux-*.log`.

Aucune dépendance ou configuration de paquet modifiée. Une dépendance déjà
déclarée (`qrcode-generator@1.4.4`) manquait dans `node_modules` et a été installée
localement pour exécuter les vérifications existantes. Aucun déploiement ou accès
production, aucune migration supplémentaire. Verrous officiels B1/B2 inchangés.

---

Implémentation livrée dans `app comptabole` uniquement. Phases techniques 0–8
réalisées avec verrous fiscaux maintenus. Recette métier et mise en production
restent à effectuer. Aucune base de production ni aucun fichier du site public
modifié. Aucune certification de conformité fiscale revendiquée.

## Phase 0 — inspection terminée

Spécification entièrement lue ; dépôt existant réutilisé. Archive projet inspectée
sans duplication. Instructions, architecture, permissions, Stock, Fournisseurs,
Collecte, composants et tests pertinents vérifiés. Contrats :
[domaine](decisions.md), [synchronisation](sync-contract.md),
[verrous](export-gates.md). Worktree initial propre.

Lint initial réussi ; build/tests initialement bloqués par `require` dans la
configuration Tailwind ESM, corrigé par un import ESM minimal.

## Phase 1 — fondations terminées

Schéma additif, FK composées par société, montants bigint millimes, taux bps,
versions attendues et audit en ajout seul. Immuabilité SQL des preuves,
déclarations approuvées, exports, issues finales et imports validés. Calcul pur
exact, arrondi provisoire demi supérieur par facture. Migration rejouée sur
PostgreSQL 17 isolé ; contraintes et cinq tests de domaine validés.

Fichiers : `server/apurement/{schema.sql,amounts.js,domain.js,permissions.js,audit.js}`,
`server/ensureSchema.js` et tests associés.

## Phase 2 — métier et interface terminés

Profil fiscal, fournisseurs, autorisations multi-BC, BC mono-fournisseur,
factures autonomes ou affectées ; contrôles, dérogations motivées et revue manager.
Registres SQL paginés, filtres, synthèse société/trimestre, détail BC et historique.
Routes, menu, tour et contexte société intégrés ; comptes société exclus côté
serveur et interface. Relations inter-sociétés et concurrence vérifiées.

Fichiers : `server/routes/apurement.js`, `server/apurement/{repository,controls}.js`,
`src/pages/apurement/`, `src/{types,store,lib}/apurement.*`, navigation et routes.

## Phase 3 — synchronisation terminée avec restriction B5

Persistance Stock partagée, transactions et verrou société communs. Suggestions
et rapprochement explicites, empreintes et conflits ; suppression liée interdite,
snapshots approuvés préservés et TVA manuelle conservée. Révisions Stock périmées
refusées via `apurementRevision` ; aucun formulaire ouvert écrasé.

Correction monétaire inverse uniquement après confirmation, pour une ligne achat
quantité 1 / TND / cours 1. Cas complexes à corriger dans Stock ; aucune allocation
ou modification de cours inventée. Les imports utilisent ce même service sans
confirmer implicitement de correction monétaire Stock. Tests des deux sens,
révisions périmées, fournisseur rapproché avec BC et rollback réussis.

Fichiers : `server/stock/stockService.js`, `server/apurement/stockLinkService.js`,
routes/mappers Stock, formulaire/page Stock et `StockLinkPanel.tsx`.

## Phase 4 — preuves, Collecte et rappels terminés

Réutilisation Collecte/noeuds/Stock, copies immuables SHA-256, upload borné avec
signature PDF/PNG/JPEG vérifiée et téléchargement protégé. Suivi des pièces
manquantes et validation interne. Demande Collecte neutre facultative, de même
société et explicitement confirmée, sans information fiscale au client.

Notifications internes, SSE après commit et rappels dédupliqués durablement.
Notifications historiques filtrées après changement de rôle ou de périmètre.
Conservation après suppression de source, destinataires, absence d’envoi après
rollback et reprise des rappels vérifiés.

Fichiers : `server/apurement/{documents,notifications,reminders}.js`, routes
`notifications.js`/`data.js`, `DocumentsPanel.tsx`, `RemindersPanel.tsx`.

## Phase 5 — imports terminés pour les modèles observés

BCD EF/DF/TF 220/521/198 ; Excel XLS/XLSX isolé en worker borné, signatures et
archives contrôlées. Aperçu sans mutation métier, valeurs originales, dates
mensuelles conservées, sélection/exclusion, rapprochement BC, création ou mise
à jour explicite d’une correspondance avec motif et version attendue. Commit
atomique/idempotent, rapport, comparaison d’identité du déclarant et nouvelle
recherche de doublons sous verrou. Réimport, cible non revue et conflit testés.

Échantillons privés analysés en mémoire : 206 DF BCD, HT 13950327387 millimes,
TVA détail 2650562191, pied 2650562204 ; écart +13 détecté. Excel : plage 143
lignes, 46 cellules, trois lignes candidates dont une invalide. Aucune fixture
confidentielle copiée dans Git ; tests synthétiques permanents.

Fichiers : `server/apurement/{imports,importWorker,bcd}.js`, `ImportPanel.tsx`.
Tout autre modèle Excel exige une adaptation explicite des colonnes.

## Phase 6 — déclarations et rapports terminés

Brouillon, revue, approbation manager avec empreinte de contrôle attendue,
versions rectificatives, snapshots et octets d’export immuables. Dépôt manuel et
preuves distincts de la génération ; acceptation/rejet explicites. Validation
financière bloquée sans décision d’arrondi interne documentée et preuve (B2).

Excel/PDF internes disponibles comme brouillons marqués, puis depuis le snapshot
approuvé. Octets stables après modification des données. Tests de rôle, aperçu
périmé, preuves, rejet et rectificative réussis.

Fichiers : `server/apurement/{declarations,reports}.js`, `DeclarationPanel.tsx`,
`ProfilePanel.tsx`, `RecordHistory.tsx`.

## Phase 7 — sortie provisoire terminée ; officielle bloquée

BCD `TEST_NON_OFFICIEL`, validation largeurs, dates, séquences et sommes.
Tests synthétiques 206 DF et écart +13 réussis. Aucun dépôt automatique.
`APUREMENT_OFFICIAL_BCD_ENABLED=true` ne contourne jamais l’absence de profil
légal signé : export officiel toujours refusé (B1/B2).

## Phase 8 — vérification technique terminée ; exploitation à valider

- `npm run lint` et `npm run build` : réussis.
- `npm run test`, PostgreSQL jetable et `PG_BIN` fournis : 139 fichiers réussis,
  1177 tests réussis, 33 tests existants ignorés. Les 37 tests Apurement tournent,
  dont 22 scénarios PostgreSQL ; aucun test Apurement ignoré.
- Régression dédiée `npm run test:integration` : 56 tests dans quatre fichiers
  réussis ; le dernier passage global inclut aussi ces fichiers.
- Migration rejouée sur données figées ; véritable `pg_dump`/`pg_restore` vers
  une base neuve, redémarrage et empreintes preuves/snapshots identiques.
- Pagination de 10000 factures synthétiques et contrôles bornés vérifiée
  (environ 0,6 s localement, sans promesse de latence production).
- Chrome headless : fournisseur, facture autonome/TVA exacte, import puis mise
  à jour explicite, création de déclaration, interface→API→SQL. Registres,
  formulaires et synthèse à 375/768/1024/1440 px, sans débordement horizontal
  global ni erreur JavaScript. Captures synthétiques hors dépôt.
- `git diff --check` et vérification du périmètre limité à `app comptabole`.

Journaux locaux : `%TEMP%/apurement-final-*.log`. Serveur PostgreSQL temporaire
arrêté en fin de vérification. Aucune dépendance ajoutée au produit.

## Actions humaines restantes et reprise

Le code ne présente aucun travail technique restant connu avant recette.
Voir le [runbook](operator-runbook.md) et le [contrat API](api.md).

1. Recette comptable sur dossiers et habilitations réelles ; fournir dates,
   identités vérifiées, plafonds applicables et preuves (B3/B4/B6).
2. Faire signer la règle interne d’arrondi prise en charge avant approbation
   financière (B2). Si elle diffère, conserver le verrou et adapter le calcul.
3. Obtenir format, arrondis officiels et fixtures acceptées avant tout futur
   déblocage BCD (B1/B2). Aucun export officiel livré activable.
4. Valider rétention, stockage/sauvegardes, restauration sur infrastructure cible
   et cadence réelle des rappels (B7/B8).
5. Planifier sauvegarde, migration et déploiement conjoint serveur/frontend ;
   répéter recette et retour arrière. Aucun déploiement de production effectué.
