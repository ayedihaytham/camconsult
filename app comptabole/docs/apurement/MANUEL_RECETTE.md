# Apurement TVA — manuel de recette complet

Pour l’utilisation courante, commencez par le [guide simple](GUIDE_UTILISATION.md).
Ce document reste un manuel de recette avancée. Les actions de démonstration et
BCD de test ont été retirées des écrans courants ; le scénario technique T08
reste vérifiable par l’API de recette, sans déblocage de l’export officiel.

Version du 18 octobre 2026. Interface française. Tests exclusivement fictifs,
à réaliser dans un environnement de recette et avec des sociétés dédiées.
Ne jamais utiliser les preuves simulées pour un dossier réel ou un dépôt fiscal.
Les matricules ci-dessous sont des identifiants synthétiques au format du
parseur de test ; ils ne constituent pas des identités fiscales vérifiées.

## 1. Préparer la recette

Prévoir un administrateur, un responsable, un collaborateur affecté au dossier,
un collaborateur non affecté et un compte société. Utiliser des comptes de test
créés par l’administrateur ; ce manuel ne contient aucun identifiant de connexion.

Créer les sociétés suivantes dans **Sociétés**, sans modifier un client réel :

| Usage | Raison sociale | Code indicatif | MF / TVA |
| --- | --- | --- | --- |
| Parcours manuel et déclaration | SOCIETE DEMO APUREMENT | APM-DEMO | 1111111AB000 |
| Imports isolés | SOCIETE DEMO IMPORTS | APM-IMP | 1111111AB000 |
| Exceptions isolées | SOCIETE DEMO EXCEPTIONS | APM-EX | 1111111AB000 |
| Contrôle inter-sociétés | SOCIETE DEMO AUTRE | APM-AUTRE | 9999999AB000 |

Si ces codes existent, ajouter un suffixe de session. Les sociétés restent
distinctes même lorsque leur MF fictif est identique. Ne pas mélanger les
parcours : leurs totaux attendus sont différents.

Ouvrir **Comptabilité → Apurement TVA**, choisir le dossier et **2026 / T3**.
Toutes les sommes saisies dans l’interface sont en **TND**, avec au plus trois
décimales. Saisir `19` pour 19 %, jamais `1900` ni `0.19`.
Les dates ci-dessous sont affichées au format français ; le sélecteur navigateur
peut attendre `2026-07-15` plutôt que `15/07/2026`.

### Fichiers prêts à utiliser

Depuis le module : **Mode d’emploi → Télécharger le manuel**, ou le lien de
modèle dans **Achats → Importer**. Tous les fichiers se trouvent sous
`public/apurement-demo/` dans le dépôt et `/apurement-demo/` sur l’application.

| Fichier | Usage / attendu |
| --- | --- |
| achats-valides.xlsx / achats-valides.xls | Trois factures, deux fournisseurs, deux BC, une autorisation |
| achats-mise-a-jour.xlsx | Corrige DEMO-IMP-001 de 1000.000 à 1100.000 TND |
| achats-exceptions.xlsx | Date mensuelle, TVA source corrigée, précision monétaire invalide |
| BCD_TEST_NON_OFFICIEL_T3_2026.txt | Trois détails au profil observé, totaux cohérents |
| BCD_TEST_ECART_013.txt | Même contenu avec pied TVA supérieur de 0.013 TND |
| preuve-autorisation.pdf / preuve-bc.pdf / preuve-facture.pdf | Pièces fictives pour les trois types de fiches |
| decision-arrondi-TEST.pdf | Simulation d’une décision interne, valable pour cette recette uniquement |
| preuve-depot-TEST.pdf / preuve-acceptation-TEST.pdf / preuve-rejet-TEST.pdf | Simulation du suivi manuel |

Pour régénérer ces fichiers après modification du manuel, depuis `app comptabole` :

```text
node server/scripts/generate-apurement-demo.mjs
```

Ce script n’accède à aucune base. Aucun fichier ne contient de données client.

## 2. Parcours manuel depuis zéro

### T01 — profil déclarant

Dans **SOCIETE DEMO APUREMENT → Réglages**, copier :

| Champ | Valeur |
| --- | --- |
| Raison sociale déclarant | SOCIETE DEMO APUREMENT |
| Matricule fiscal déclarant | 1111111AB000 |
| Activité | RECETTE FICTIVE |
| Ville | TUNIS |
| Rue | RUE DE LA RECETTE |
| Numéro | 1 |
| Code postal | 1000 |
| Référence de vérification | DEMO-PROFIL-2026-001 |

L’admin/responsable choisit **Confirmer la vérification du profil**.
Attendu : profil vérifié après actualisation. Un simple enregistrement ultérieur
retire cette vérification : le responsable doit confirmer à nouveau.
Le profil est indépendant de la fiche Société ; un import ne l’écrase pas.

### T02 — deux fournisseurs

Dans **Fournisseurs & BC → Fournisseurs → Ajouter un fournisseur** :

| Champ | Fournisseur A | Fournisseur B |
| --- | --- | --- |
| Raison sociale | FOURNISSEUR ALPHA DEMO | FOURNISSEUR BETA DEMO |
| Matricule fiscal source | 2222222ABC000 | 3333333ABC000 |
| Matricule vérifié | 2222222ABC000 | 3333333ABC000 |
| Autres noms Stock | ALPHA DEMO STOCK | BETA DEMO STOCK |

Dans cette recette seulement, la vérification est simulée. Pour un dossier
réel, ne renseigner le matricule vérifié qu’après contrôle des justificatifs.

### T03 — une autorisation, deux BC

Dans **Autorisations → Ajouter une autorisation** :

```text
Numéro : DEMO-AUT-2026
Début : 2026-01-01
Fin : 2026-12-31
État interne : Active
Plafond HT : 10000.000
Plafond TVA : 1900.000
```

Enregistrer, rouvrir la fiche, joindre `preuve-autorisation.pdf` dans
**Justificatifs → Ajouter un justificatif**. Fermer la fiche.

Créer dans **Bons de commande** :

| Champ | BC A | BC B |
| --- | --- | --- |
| Numéro | 000101 | 000102 |
| Autorisation | DEMO-AUT-2026 | DEMO-AUT-2026 |
| Fournisseur | FOURNISSEUR ALPHA DEMO | FOURNISSEUR BETA DEMO |
| Date BC | 2026-07-01 | 2026-07-01 |
| Description | Achat fictif ALPHA | Achat fictif BETA |
| Plafond HT | 5000.000 | 5000.000 |

Enregistrer puis joindre `preuve-bc.pdf` à chaque BC. Attendu : les deux BC
sont visibles depuis l’autorisation, chacun conserve son fournisseur.
Les plafonds sont des valeurs d’essai, pas une règle légale présumée.

### T04 — deux factures avec TVA automatique

Dans **Achats → Ajouter une facture** :

| Champ | Facture A | Facture B |
| --- | --- | --- |
| Numéro | DEMO-FAC-001 | DEMO-FAC-002 |
| BC | 000101 | 000102 |
| Date complète | 2026-07-15 | 2026-08-17 |
| HT (TND) | 1000.000 | 1234.567 |
| Taux TVA (%) | 19 | 19 |
| Calcul TVA | Automatique | Automatique |
| Objet | Achat fictif ALPHA | Achat fictif BETA |

Ne pas renseigner de correction manuelle. Enregistrer puis rouvrir chaque
facture et joindre `preuve-facture.pdf`.

Attendu pour ce dossier, sans autre facture :

| Indicateur | Résultat |
| --- | --- |
| Factures | 2 |
| HT | 2234.567 TND |
| TVA facture A | 190.000 TND |
| TVA facture B | 234.568 TND |
| TVA détaillée | 424.568 TND |
| TVA calculée sur HT global | 424.568 TND |
| Écart détaillé/global | 0.000 TND |

Les calculs restent provisoires tant que la décision interne n’est pas documentée.

### T05 — contrôles, documents et historique

Ouvrir **Contrôles**. Après saisie des preuves, dates et identités, les blocages
doivent être résolus. Les avertissements sont à faire revoir individuellement
par admin/responsable avec un motif explicite, par exemple :

```text
RECETTE : identité et justificatif fictifs vérifiés dans le scénario T05.
```

Ouvrir une facture depuis la liste des anomalies pour corriger la fiche. Pour
une anomalie de BC/autorisation/fournisseur, ouvrir la référence correspondante
dans **Fournisseurs & BC**, puis relancer les contrôles.
Attendu : historique avec création/modification et acteur ; aucune suppression
de l’historique. Un blocage ne peut pas être effacé par une simple justification.

### T06 — brouillon et rapports internes

Dans **Déclarations**, cliquer **Préparer une déclaration**, ouvrir la version 1.
Télécharger **Excel brouillon non validé** et **PDF brouillon non validé**.
Attendu : statut brouillon lisible dans le fichier, deux lignes et totaux de T04.
La génération ne crée aucun dépôt. Une seconde préparation rouvre le brouillon
existant ; elle ne doit pas créer deux versions éditables concurrentes.

### T07 — règle interne et approbation simulée

Dans **Justificatifs de cette déclaration**, joindre `decision-arrondi-TEST.pdf`.
Le sélecteur de preuve se met à jour automatiquement après l’ajout.
Ouvrir **Règle d’arrondi**, saisir :

```text
Référence : DEMO-ARRONDI-2026-001 — SIMULATION DE RECETTE
Preuve : decision-arrondi-TEST.pdf
```

Admin/responsable confirme la règle documentée. Cette action simule une
approbation interne sur les seules données de recette ; elle ne valide jamais
les règles fiscales ni le format BCD officiel.

Soumettre à validation, puis **Valider et figer cette version** en admin/responsable.
Un collaborateur peut préparer/soumettre, mais ne peut pas approuver.
Attendu : version 1 validée et figée ; empreinte consultable ; Excel/PDF internes
avec les totaux T04. Sans règle documentée, la validation doit rester bloquée.
Si un contrôle a changé entre aperçu et validation, recharger et vérifier avant
de réessayer : ne pas chercher à contourner le conflit.

### T08 — génération BCD de test et verrou officiel

Ce scénario est réservé à l’API technique : POST `/api/apurement/declarations/:id/exports`
avec `{"type":"bcd-test"}`, dans une session interne autorisée de recette.
Il n’existe plus de bouton de test dans le parcours courant.
Attendu dans le fichier : deux DF, EF/DF/TF de largeurs
220/521/198 et sommes T04. Tous les BC doivent être numériques, les dates
complètes et les MF conformes au profil observé ; le modèle de T02/T03 le permet.
Attendu : nom TEST_NON_OFFICIEL, aucun dépôt créé. Le bouton officiel reste
indisponible. L’activation isolée d’un indicateur serveur ne le rend pas légalement
utilisable et le serveur continue à le refuser.

### T09 — dépôt manuel puis acceptation

Joindre `preuve-depot-TEST.pdf` à **cette déclaration** ; le sélecteur se met
à jour automatiquement. Dans **Registre des dépôts manuels** :

```text
Date de dépôt : 2026-10-18
Référence : DEMO-DEPOT-001
Preuve : preuve-depot-TEST.pdf
```

Cliquer **Enregistrer « déposé » avec preuve**. Attendu : déposé, pas accepté.
Joindre ensuite `preuve-acceptation-TEST.pdf`, actualiser, la choisir et saisir :

```text
Acceptation simulée de recette, sans dépôt réel auprès d’une administration.
```

Cliquer **Enregistrer l’acceptation avec preuve**. Attendu : accepté ; issue finale
immuable. Une pièce d’une autre déclaration/société doit être refusée.

### T10 — rectificative, rejet et conservation

Depuis la version 1 validée, préparer une rectificative. Attendu : version 2
brouillon liée à la version 1, qui reste intacte. Modifier DEMO-FAC-001 à
`1100.000` HT, TVA auto `209.000`, et rouvrir la version 2 pour actualiser.
Attendu courant : HT `2334.567`, TVA `443.568`. Version 1 et ses exports
restent à `2234.567` / `424.568` ; télécharger à nouveau pour comparer.

Valider la version 2 après contrôle. Enregistrer un dépôt DEMO-DEPOT-002,
joindre `preuve-rejet-TEST.pdf`, saisir `Rejet fictif pour exercice de correction`,
puis **Enregistrer le rejet et préparer une rectificative**. Attendu : dépôt
rejeté, preuves conservées et nouvelle version éditable liée à la précédente.
Ne pas enregistrer une acceptation et un rejet pour la même issue finale.

## 3. Imports : utiliser SOCIETE DEMO IMPORTS

### T11 — Excel valide et montants exacts

Configurer le profil comme T01, en conservant le MF `1111111AB000` et le nom
du dossier d’import. Dans **Achats → Importer**, choisir `achats-valides.xlsx`,
taux `19`, **Prévisualiser**. Attendu : trois lignes, aucune écriture créée.
Sélectionner les lignes valides, puis confirmer. Les BC et fournisseurs peuvent
être créés par l’import ; leurs matricules restent à vérifier manuellement.

Attendu dans ce dossier initialement vide : une autorisation, deux BC,
deux fournisseurs, trois factures ; HT `2734.567`, TVA `519.568` TND.
Télécharger le rapport d’import. Réimporter exactement le même fichier :
message « déjà importé », aucun doublon. Tester `.xls` dans une autre société
de recette vide : mêmes montants et identifiants avec zéros initiaux.

### T12 — mise à jour explicite et concurrence

Prévisualiser `achats-mise-a-jour.xlsx`. DEMO-IMP-001 doit être signalée comme
correspondance/doublon. Choisir **Mettre à jour**, et non créer une facture distincte.
L’ancien HT et la version sont affichés. Sélectionner la ligne, copier :

```text
RECETTE : correction confirmée sur la pièce fictive, HT 1100.000 et TVA 209.000.
```

Attendu : même facture, version incrémentée, toujours trois factures, HT total
`2834.567`, TVA `538.568`. Répéter : aucune modification supplémentaire.

Pour le conflit, modifier le fichier à `1200.000 / 228.000`, prévisualiser, puis
modifier cette facture dans un autre onglet avant confirmation. Attendu : 409,
lot non validé, aucun écrasement de l’autre onglet ; relancer l’aperçu.

### T13 — dates partielles, TVA manuelle et ligne invalide

Dans **SOCIETE DEMO EXCEPTIONS**, importer `achats-exceptions.xlsx`, taux `19`.
Attendu : ligne 2 date `07/2026`, ligne 3 TVA source `190.001` différente de
`190.000`, ligne 4 invalide car HT à quatre décimales. La ligne invalide est
non sélectionnable. Ne sélectionner que lignes 2 et 3. La confirmation reste
indisponible sans justification de ligne 3. Copier :

```text
RECETTE : conservation de la TVA source fictive 190.001 ; écart de 0.001 revu.
```

Confirmer. Attendu : deux factures, HT `1050.000`, TVA `199.501`, aucune
facture DEMO-INVALIDE-001. Date mensuelle conservée sans jour inventé.
Dans la fiche DEMO-MOIS-001, renseigner `2026-07-20` pour lever le blocage date.
La facture TVA manuelle doit garder son montant et son motif ; sa revue reste
nécessaire avant approbation. Tester aussi un faux `.xlsx` contenant du texte :
rejet de signature/format, aucune écriture.

### T14 — BCD valide, écart +0.013 et identité différente

Sur un dossier vierge de recette avec MF `1111111AB000`, importer
`BCD_TEST_NON_OFFICIEL_T3_2026.txt`, taux `19`. Attendu : trois DF, aucun écart
de pied, HT `2734.567`, TVA `519.568`. Un BCD reste un modèle observé, non officiel.

Sur un autre dossier vierge, choisir `BCD_TEST_ECART_013.txt`. Attendu : écart
TVA `0.013`. Le bouton de confirmation reste désactivé tant que la justification
du fichier n’est pas renseignée. Copier uniquement dans cette recette :

```text
RECETTE : écart synthétique de 0.013 identifié dans le pied ; détails conservés,
aucune correction implicite du fichier ni des factures.
```

Le total importé reste `519.568`, pas `519.581`. Le fichier brut est conservé.

Refaire un aperçu depuis **SOCIETE DEMO AUTRE**, MF `9999999AB000` : avertissement
d’identité. Dans la pratique, revenir au bon dossier. Pour tester uniquement la
barrière, constater que justification ET confirmation de l’identité sont requises.
Ne pas confirmer une identité fausse dans un dossier réel. Cela explique le 422
de la capture utilisateur : revue source non renseignée, pas une panne du parseur.

### T15 — rapprochement de BC et doublons

Modifier une copie Excel : conserver le MF fournisseur mais changer numéro de
BC/autorisation source. Dans **BC et valeurs originales**, sélectionner un BC
existant de ce fournisseur, puis justifier la différence. Attendu : BC réutilisé,
valeurs source conservées. Choisir un BC de l’autre fournisseur : refus métier,
aucune mutation du lot. Un doublon choisi pour création distincte exige un motif ;
il reste signalé aux contrôles, sans déduplication silencieuse.

## 4. Stock et Collecte

Utiliser SOCIETE DEMO EXCEPTIONS, avant toute approbation de son trimestre.

### T16 — suggestion, liaison et deux sens

Dans Stock, créer un achat et sa ligne, avec :

```text
Fournisseur : ALPHA DEMO STOCK
Numéro facture : DEMO-STOCK-001
Date achat : 2026-07-21
Devise : TND
Cours : 1
Quantité : 1
Prix unitaire : 200.000
Montant devise / TND : 200.000
```

Créer la marchandise et les autres références obligatoires demandées par le
formulaire Stock. Ne pas ajouter de vente. Les champs de ligne existants restent
la source de vérité ; aucun taux de change ne doit être supposé.

Dans la fiche Stock enregistrée et sans modification non sauvegardée, cliquer
**Lier à un BC en suspension**, créer/enregistrer la facture préremplie (taux 19,
BC du fournisseur ALPHA), puis ouvrir son rapprochement et confirmer la source.
L’alias ALPHA DEMO STOCK doit être explicitement confirmé sur le fournisseur.
Attendu : HT `200.000`, TVA `38.000`, un seul lien, ventes jamais proposées.

Modifier dans Stock le numéro en `DEMO-STOCK-001-B` et la date `2026-07-22` :
attendu dans Apurement sans double facture. Modifier ensuite le numéro dans
Apurement en `DEMO-STOCK-001-C` : attendu dans Stock ; nom/alias conservé.

### T17 — correction monétaire sûre et cas complexe

Dans la facture liée, modifier HT en `210.000` sans cocher la confirmation Stock :
attendu 409 et aucun changement des deux côtés. Refaire avec la confirmation
explicite : pour cette seule ligne quantité 1 / TND / cours 1, prix et montants
devise/TND deviennent `210.000`, TVA auto `39.900`.

Ajouter une deuxième ligne achat dans Stock, puis tenter une correction monétaire
inverse : refus. Modifier les lignes dans Stock ; aucune répartition automatique.
Essayer suppression du mouvement lié : refus. Essayer déliaison explicite avant
usage figé : autorisée et auditée. Après usage dans une déclaration figée : refus.

### T18 — onglets périmés, conflit et snapshot

Ouvrir le même Stock dans deux onglets, charger son formulaire dans les deux.
Enregistrer dans A puis enregistrer l’ancien B : 409, pas d’écrasement.
Même exercice sur une facture Apurement : version périmée refusée.
Une actualisation au retour sur la fenêtre ne doit pas écraser une saisie ouverte.

Après approbation d’un trimestre de recette complet, modifier un Stock lié :
notification interne et conflit courant ; la déclaration et ses fichiers antérieurs
restent identiques. Comparer, résoudre explicitement puis préparer une rectificative.
Un changement de fournisseur exige correction dans Stock puis choix du BC
correspondant dans la comparaison ; une modification générique liée est refusée.

### T19 — réutilisation Collecte et preuve conservée

Créer une Collecte de test dans la même société avec une pièce PDF fictive,
puis dans une facture Apurement choisir **Associer une pièce existante**.
  Dans **Emplacement**, choisir **Tous les documents de la société**, sélectionner
  cette source et confirmer. Attendu : téléchargement identique à l’original.
Supprimer uniquement la source fictive de Collecte : la copie Apurement reste
téléchargeable et affiche « Original supprimé ; copie conservée ».
Une pièce d’une autre société ne doit jamais être proposée ni accessible.

### T20 — pièce manquante et demande facultative au client

Dans une facture, ouvrir **Une pièce manque ?**, puis saisir :

```text
Copie lisible de la facture fictive DEMO-STOCK-001
```

Cliquer **Signaler la pièce manquante**. Attendu : suivi interne, notification
équipe, pas de demande au client à ce stade. Choisir une Collecte de la même
société puis **Confirmer la demande via Collecte**. Attendu : demande client
neutre, aucun montant fiscal ni mention d’Apurement ; pas de duplication en
répétant la confirmation. Collaborateur marque fournie ; responsable valide.

## 5. Exceptions, permissions et exploitation

### T21 — TVA manuelle, période exceptionnelle et plafonds

Créer une facture de test dans SOCIETE DEMO EXCEPTIONS, HT `100.000`, taux `19`,
choisir calcul manuel, TVA `19.001`. Sans motif : ne pas autoriser l’enregistrement.
Avec `RECETTE : correction source fictive +0.001`, conserver le montant et l’audit.

Saisir une date `2026-10-01` dans T3 : blocage hors période tant que la section
« Facture affectée à un autre trimestre » ne contient pas de justification.
Après motif `RECETTE : allocation exceptionnelle simulée`, avertissement à revoir.
Une date avant le BC déclenche un avertissement. Ne pas inventer le traitement réel.

Baisser temporairement le plafond BC sous son total réel de recette : blocage.
Rétablir le plafond. Tester de même l’autorisation HT/TVA et son état annulé.
Modifier une identité vérifiée : nouvelle revue exigée ; un ancien acquittement
ne doit pas être réutilisé après modification des données.

### T22 — droits et séparation des sociétés

| Compte | Attendu |
| --- | --- |
| Admin/responsable | Préparer, revoir avertissements, approuver, suivre dépôts |
| Collaborateur affecté | Préparer/importer/joindre/soumettre, sans approbation ni décision d’arrondi |
| Collaborateur non affecté | Aucun accès au dossier ou téléchargement |
| Compte société | Pas d’accès Apurement ni notification fiscale |

Tester aussi une URL copiée directement, un téléchargement, une facture/BC et
une source d’une autre société. L’interface masquée ne suffit pas : le serveur
doit refuser. Modifier un compte interne de recette en compte société puis
vérifier que ses anciennes notifications Apurement ne sont plus consultables.

### T23 — rappels internes

Dans Réglages, admin/responsable renseigne une échéance de recette déjà passée
(exemple `2026-10-17` pour une session le 18 octobre 2026), cadence `1`, actif.
Attendre le passage du planificateur serveur (horaire), puis vérifier les
notifications internes. Deux passages dans la même fenêtre ne doivent pas créer
de doublon par destinataire. Aucun compte société destinataire. Désactiver le
rappel après test. Ne pas modifier l’horloge d’une machine de production.

### T24 — responsive et utilisation clavier

À 375, 768, 1024 et 1440 px : dossier, registres, formulaire facture, import avec
anomalies, contrôles et déclaration. Attendu : pas de défilement horizontal global,
actions lisibles, lignes mobiles paginées et décisions accessibles. Clavier :
Tab/Shift+Tab, sélection fichier, choix BC, champs de justification, fermeture
du formulaire ; focus visible, aucune opération comptable déclenchée par navigation.

### T25 — sauvegarde et reprise (exploitant)

Sur infrastructure de recette, sauvegarder avec `pg_dump -Fc`, restaurer dans une
base neuve et démarrer le serveur sur cette base. Vérifier les déclarations,
preuves et exports, ainsi que leurs empreintes, sans régénération différente.
Ne jamais restaurer par-dessus la production. Les tests automatisés exécutent
ce scénario lorsque PostgreSQL et `PG_BIN` sont disponibles. Voir le runbook
pour migration additive et retour au code précédent sans suppression des archives.

## 6. Lire les erreurs sans contourner les contrôles

| Réponse / situation | Sens | Action |
| --- | --- | --- |
| 422 revue source | Écart de pied ou identité non justifié | Vérifier le bon dossier, compléter Revue du fichier ; ne pas recopier un motif fictif dans un dossier réel |
| Confirmation import désactivée | Choix/justification manquante | Lire « Avant de confirmer », sélectionner les lignes et renseigner les champs indiqués |
| 422 fournisseur / BC | Identité source incompatible | Choisir le BC du bon fournisseur, corriger le rapprochement |
| 422 format / date | Fichier non reconnu, données non représentables | Utiliser le modèle, corriger dates ou colonnes ; aucune écriture attendue |
| 409 version / aperçu expiré | Autre modification ou aperçu de plus de 30 min | Relancer l’aperçu ou recharger la fiche, comparer puis recommencer |
| 409 Stock | Empreinte périmée ou correction de lignes ambiguë | Comparer les versions et corriger explicitement dans Stock |
| 400 profil | Champ requis absent | Compléter raison sociale, matricule et référence, ainsi que champs affichés |
| 403/404 | Droit ou périmètre absent | Vérifier compte/société, ne pas contourner par un autre identifiant |
| 423 export officiel | Verrou de conformité maintenu | Utiliser rapports internes / test ; obtenir une validation officielle avant évolution du code |

### T26 — Structuration, sélection et classement automatique

Utiliser une facture ou un brouillon de déclaration de **SOCIETE DEMO MANUELLE**.

1. Dans **Justificatifs**, cliquer **Associer une pièce existante**. Attendu :
   fenêtre centrée, chemin de la société affiché ; si le dossier est vide,
   message **Aucun document compatible trouvé**, jamais une zone silencieuse.
2. Choisir **Ouvrir ce dossier dans Structuration**. Attendu : nouvel onglet,
   vue **Documents**, dossier exact ouvert pour la société de recette.
3. Y déposer `preuve-facture.pdf` du kit. Revenir à Apurement et choisir
   **Actualiser**, rechercher `preuve-facture`, cocher le fichier et cliquer
   **Associer le document**. Attendu : la fenêtre se ferme après réussite,
   le document reste visible dans les justificatifs ; téléchargement identique.
4. Importer `preuve-depot-TEST.pdf` directement dans les justificatifs Apurement.
   Attendu : le fichier existe aussi dans le même dossier Structuration, sans
   déplacer ni remplacer le fichier ajouté à l'étape 3.
5. Dans le sélecteur, changer **Emplacement** vers **Tous les documents de la
   société** : les autres pièces de Structuration/Collecte/Stock sont proposées,
   avec leur chemin. Une pièce d'une autre société n'apparaît jamais.
6. Vérifier avec un compte société que les nouveaux dossiers et fichiers internes
   Apurement sont absents du bootstrap et de la liste des documents ; leur
   téléchargement par identifiant est refusé. Après déplacement ou duplication
   par l'admin, cette restriction demeure.
7. Supprimer uniquement l'original fictif d'une pièce déjà associée. Attendu :
   la preuve conservée dans Apurement reste téléchargeable ; aucune modification
   de la déclaration figée. Ne supprimer aucune donnée réelle.

Chemin des factures/déclarations :
`Société / Apurement TVA / Année / Trimestre / Factures|Déclarations`.
Autorisations et BC : dossiers de références sous `Apurement TVA`.

## 7. Fiche de résultat à copier

```text
Session de recette :
Version / build :
Testeur et rôle :
Société(s) de test :
Scénario Txx :
Étapes et valeurs utilisées :
Résultat attendu :
Résultat obtenu :
Réussi / anomalie :
Heure, URL, capture et code d’erreur (sans secret) :
```

La recette est complète lorsque T01–T26 sont renseignés, avec les restrictions
attendues confirmées. Une recette réussie ne débloque pas B1/B2 officiels :
format légal, arrondis, rétention, preuves et échéances réelles restent à valider.
