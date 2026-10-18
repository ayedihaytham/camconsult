# Apurement TVA — le guide simple

## À quoi sert ce dossier ?

Votre société peut avoir des achats pour lesquels elle ne paie pas immédiatement
la TVA au fournisseur, dans le cadre d’une autorisation. Ce module rassemble
ces achats, leurs factures et les documents qui justifient cette suspension.
Il prépare ensuite un récapitulatif par trimestre pour le responsable comptable.

Vous n’avez pas besoin de maîtriser les calculs pour recopier une facture.
Le responsable détermine quels achats sont concernés et vérifie le traitement
comptable. Ne choisissez pas vous-même une suspension ou un taux si vous ne
savez pas lequel s’applique.

## Les quatre mots utiles

| Mot à l’écran | Signification |
| --- | --- |
| Fournisseur | L’entreprise qui vous a vendu le produit ou le service |
| HT | Le prix avant TVA |
| BC / bon de commande | Le document de commande auquel rattacher la facture |
| Autorisation | Le document qui permet de justifier l’achat en suspension |

Une autorisation peut couvrir plusieurs bons de commande. Une facture est
rattachée à un seul bon. Le montant de TVA suivi n’est pas une somme à déduire
ou à payer automatiquement : le module ne réalise aucun paiement.

## Votre parcours : trois actions

### 1. Ajouter une facture

1. Ouvrez **Apurement TVA** et choisissez la société.
2. Choisissez l’année et le trimestre. T1 = janvier–mars ; T2 = avril–juin ;
   T3 = juillet–septembre ; T4 = octobre–décembre.
3. Cliquez **Ajouter une facture**.
4. Recopiez son numéro, sa date complète, son montant HT et son taux de TVA.
   Pour un taux de 19 %, saisissez `19`. Pour un montant de mille dinars,
   saisissez `1000.000`. Utilisez les valeurs de votre document.
5. Sélectionnez le bon de commande s’il existe déjà. Le fournisseur est alors
   celui du bon ; il n’est pas nécessaire de le choisir une deuxième fois.
6. Si le bon n’existe pas encore, choisissez **+ Créer un bon de commande ici**.
   Recopiez son numéro et sa date ; choisissez son autorisation ou créez-la ici
   avec son numéro. Choisissez le fournisseur ou **+ Créer un fournisseur ici**.
7. Cliquez **Enregistrer et ajouter les pièces**. La facture et les références
   nouvelles sont enregistrées ensemble. Si une donnée est refusée, rien de
   cette nouvelle saisie n’est enregistré : corrigez le champ indiqué.
8. Dans **Justificatifs**, joignez la facture PDF/image ou associez une pièce
   déjà présente dans Collecte ou Stock. Fermez la fiche une fois terminé.

Si vous ne connaissez pas encore le bon de commande, laissez **À affecter
(brouillon)** et choisissez le fournisseur. La facture est enregistrée pour être
complétée ; elle ne peut pas être approuvée telle quelle. Si le jour est inconnu,
la section « Je connais seulement le mois » permet aussi de conserver la saisie.
Ne remplissez jamais un numéro ou un jour au hasard.

Les documents du bon et de l’autorisation se joignent à leurs propres fiches,
dans le menu **Dossier… → Bons de commande / Autorisations**. Ils restent
réutilisables pour les autres factures concernées : pas de copie à chaque achat.

**Exemple de lecture :** pour HT `1000.000` et taux `19`, la TVA calculée est
`190.000`. C’est un exemple arithmétique, pas un taux à appliquer à tous les achats.
Laissez le calcul automatique ; une correction manuelle est une exception à faire
valider par le responsable.

### 2. Compléter ce qui manque

Ouvrez **À compléter**. Chaque ligne indique la facture concernée et l’action
attendue : ajouter un document, compléter une date, rattacher un bon, etc.

- **À corriger** : une information manque ou est incohérente. Ouvrez la fiche
  et corrigez-la. Une explication seule ne supprime pas un blocage.
- **À faire revoir** : une situation particulière doit être examinée et motivée
  par le responsable. Vous n’avez pas à inventer une justification comptable.
- **Revu** : le responsable a déjà examiné cet avertissement pour ces données.

Le matricule fiscal est l’identifiant de l’entreprise figurant sur ses documents.
Lorsqu’un fournisseur vient d’être créé, son identité reste à vérifier par le
cabinet. Saisir un matricule source ne le rend pas automatiquement « vérifié ».

Le menu **Dossier…** contient les fournisseurs, les bons, les autorisations,
le profil fiscal de la société et les rappels. Ces réglages ne sont pas à refaire
pour chaque facture. Si une modification concurrente est signalée, rechargez et
comparez les informations avant de réenregistrer.

### 3. Faire vérifier puis suivre le dépôt

1. Ouvrez **Déclaration → Préparer une déclaration**.
2. Vérifiez les totaux. Excel/PDF permettent de consulter le récapitulatif.
   Un brouillon est indiqué comme tel ; télécharger ne signifie pas déposer.
3. Cliquez **Soumettre à validation**. Le responsable doit vérifier les pièces,
   les identités et la règle d’arrondi documentée avant de valider.
4. Après validation, la version est figée : elle constitue l’archive approuvée.
5. Le dépôt auprès du destinataire compétent est effectué séparément.
   Le responsable enregistre ensuite sa date, sa référence et sa preuve ici.
6. Il indique **accepté** ou **rejeté** seulement lorsqu’il possède la preuve
   correspondante. Un rejet conduit à une nouvelle version pour corriger le dossier.

Vous n’avez pas à écrire « acceptation » pour terminer une simple saisie de facture.
Ce statut concerne le dépôt final, et nécessite une réponse effectivement reçue.
Une correction ultérieure ne réécrit jamais l’archive approuvée.

## Si vous avez déjà beaucoup de factures

Dans **Mon trimestre → Importer un fichier d’achats**, choisissez le classeur au
modèle reconnu, confirmez le taux utilisé pour le contrôle et prévisualisez.
Le lien **Télécharger le modèle Excel vierge** fournit les bonnes colonnes,
sans données d’exemple. Remplissez une ligne par facture dans sa feuille Factures.
Sélectionnez les lignes voulues, vérifiez les messages, puis confirmez l’import.
L’aperçu seul n’enregistre aucune facture. Un même fichier validé ne se réimporte
pas en double.

Si le nom/matricule du déclarant ne correspond pas à la société choisie, commencez
par vérifier le dossier. Ne confirmez pas simplement pour faire disparaître le
message. Si le total du fichier diffère du détail des lignes, demandez au
responsable de revoir l’écart et de justifier la décision. Le logiciel ne le
corrige pas silencieusement.

Si les factures sont déjà dans **Stock**, utilisez leur rapprochement existant.
Ne les ressaisissez pas pour obtenir une deuxième facture. Les changements
monétaires complexes se font dans Stock, puis se rapprochent explicitement.

## Ce que vous faites, ce que le responsable fait

| Vous préparez | Le responsable vérifie et décide |
| --- | --- |
| Recopier factures et références | Éligibilité de l’achat et traitement comptable |
| Joindre les documents | Identités et justificatifs |
| Compléter les informations connues | Exceptions et arrondis |
| Soumettre le dossier | Validation et suivi du dépôt réel |

Le module ne dépose rien automatiquement. Le format BCD officiel reste verrouillé
jusqu’à vérification de son format et de ses règles d’arrondi ; Excel/PDF restent
des rapports internes. Aucune option de démonstration n’est nécessaire pour
utiliser la saisie et le suivi courants.
