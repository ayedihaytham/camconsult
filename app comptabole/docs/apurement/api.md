# Contrat d’API livré

Base `/api/apurement`, authentification existante + garde cabinet + périmètre SQL.
Requêtes JSON en camelCase, erreurs `{error: string, code, fields?}` compatibles
avec `src/lib/api.ts`. Montants : chaînes d’entiers millimes ; taux entier bps.

Les registres `autorisations`, `fournisseurs`, `bcs`, `factures` proposent GET/POST,
GET/PATCH `/:id`, avec `societeId`, `q`, `page`, `size` (maximum 100).
Factures : filtres BC, année et trimestre ; BC : filtre autorisation.
Réponse `{items,page,size,total,hasMore}`. PATCH exige `expectedVersion`.
La société d’une entité ne peut pas être réaffectée.

`POST /achats` simplifie une première saisie : `{societeId,requestId,fournisseur,
bc,facture}`. Fournisseur = UUID existant ou nouvel objet (nom/MF source, aucune
vérification implicite). BC = UUID, null, ou `{numero,dateBc,autorisation}` ;
autorisation = UUID ou nouvel objet. Les validateurs métier existants s’appliquent
à chaque entité dans une seule transaction sous verrou société. Une erreur
annule toutes les créations. `requestId` UUID rend une répétition identique
idempotente ; réutilisation avec contenu différent : 409. Les documents sont
associés aux fiches enregistrées via le service existant.

| Ressource | Fonction |
| --- | --- |
| GET `/synthese?annee=&trimestre=` | Synthèse groupée des sociétés autorisées |
| GET/PUT `/societes/:id/profil` | Profil fiscal ; version attendue ; vérification manager |
| GET `/bcs/:id/rapprochement` | Totaux par période et états déclaration/dépôt |
| POST `/stock/suggestions` | Achats non liés, pagination et recherche |
| GET `/stock/:id` | En-tête achat et total des seules lignes achat, empreinte |
| POST `/factures/:id/lier-stock`, `/synchroniser` | `expectedVersion,stockId,stockHash,resolution,confirmer:true` |
| GET `/factures/:id/stock` | Comparaison avec la source liée |
| POST `/factures/:id/delier-stock` | Version et motif ; interdit si usage figé |
| GET `/pieces/sources?societeId=` | Sources autorisées sans contenu |
| GET/POST `/pieces` | Parent typé, société et référence/upload vérifiés |
| GET `/pieces/:id/telecharger` | Octets conservés, accès vérifié |
| GET/POST `/pieces-manquantes` | Suivi interne ; filtre parent possible |
| PATCH `/pieces-manquantes/:id` | Version et statut ; manager pour valider |
| POST `/pieces-manquantes/:id/demander-collecte` | Collecte de même société et confirmation explicite |
| GET `/controles?societeId=&annee=&trimestre=&page=&size=` | Contrôles triés/paginés, total et sommes exactes |
| POST `/controles/:factureId/ack` | Code, empreinte, motif ; manager seulement |
| POST `/imports/preview` | Fichier base64, nom, société/période et taux explicite |
| POST `/imports/:id/commit` | `previewHash`, lignes choisies, BC optionnel, motifs et revue du pied ; mise à jour optionnelle avec `updateFactureId,expectedVersion` issus des `matches` de l’aperçu |
| GET `/imports/:id/rapport` | Résultats et revue ; originaux conservés côté serveur |
| GET/POST `/declarations` | Période et versions ; une seule version éditable |
| GET `/declarations/:id` | Snapshot ou aperçu courant + `controlHash`, exports, dépôts |
| POST `/declarations/:id/soumettre-validation` | Contrôles et pièces complets, notification interne |
| POST `/declarations/:id/valider` | Manager, règle documentée, `expectedControlHash`, `motifEcart` |
| POST `/declarations/:id/rectifier` | Nouvelle version liée à une version figée |
| POST `/declarations/:id/exports` | `type`: excel, pdf, bcd-test ; bcd-officiel toujours bloqué |
| GET `/exports/:id/telecharger` | Octets immuables et en-tête SHA-256 |
| POST `/declarations/:id/depots` | Manager, date, référence et preuve liée à cette déclaration |
| PATCH `/depots/:id` | Issue avec version, preuve et motif ; issue finale immuable |
| GET/PUT `/politique-calcul` | Règle interne documentée ; manager à l’écriture |
| GET/PUT `/rappels` | Date/cadence explicites ; manager à l’écriture |
| GET `/audit?societeId=&entityId=&page=` | Historique transactionnel en ajout seul |

Pour une facture Stock, PATCH accepte `confirmerMontantStock:true` uniquement
comme confirmation de la correction monétaire non ambiguë décrite dans le
[runbook](operator-runbook.md). Les cas complexes renvoient 409 et annulent
l’ensemble de la transaction.

Un PATCH Stock lié exige `apurementRevision` (chaîne renvoyée dans le DTO Stock).
Révision absente ou périmée : 409. La comparaison Stock accepte un `bcId`
optionnel pour revoir explicitement le fournisseur ; une modification générique
de fournisseur lié est refusée. Les imports n’autorisent aucune correction
monétaire Stock implicite. Une mise à jour d’import exige une justification,
conserve l’identifiant et incrémente la version ; toute erreur annule le lot.

Excel/PDF avant approbation portent `BROUILLON_NON_VALIDE` ; après approbation,
ils proviennent exclusivement du snapshot. Les fichiers sont conservés par
empreinte de source ; redemander le même export rend les mêmes octets.

Codes HTTP : 400 entrée invalide, 401 session, 403 rôle/périmètre,
404 objet absent ou non divulgué, 409 conflit/version, 422 contrôle métier,
423 verrou fiscal, 429 limite de lectures Excel concurrentes.
