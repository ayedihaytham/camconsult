# Collecte de pièces — invariants métier

Référence de maintenance pour `src/pages/collectes`, `src/lib/collecte`, `src/store/collectes.ts` et `server/routes/collectes.js`. Les API et contrôles serveur restent la source d’autorisation.

## Données et cycle

- Statuts persistés d’une collecte et d’une section : `brouillon`, `transmis`, `a_corriger`, `valide`, `archive`. Un tableau suit son propre circuit; le statut global ne remplace jamais les statuts de section.
- La demande de récap est distincte (`none`, `envoye`, `repondu`). Une demande envoyée rouvre visuellement les cases ciblées d’un tableau transmis ou validé. Le client ne voit que les récaps qui lui sont envoyés.
- Le client peut transmettre un tableau ouvert même incomplet après avertissement; il est alors verrouillé jusqu’à décision du cabinet. Un renvoi doit comporter un motif. Un tableau archivé est en lecture seule pour tous.
- Le client peut modifier les seuls tableaux ouverts de sa société, y compris si sa session est globalement en lecture seule. Les en-têtes de bordereaux déjà enregistrés et les lignes existantes ne sont pas supprimables par le client.
- L’agrégat recalculé archive si tous les tableaux non réservés au cabinet sont archivés; sinon valide si tous sont validés/archivés; sinon transmis si au moins un est transmis; sinon à corriger si au moins un est à corriger; sinon brouillon. Une collecte déjà archivée et une collecte sans section gardent leur statut. Les opérations globales ont leurs propres règles de synchronisation.

## Tableaux et calculs

Les 14 clés persistées sont définies dans `src/lib/collecte/tabs.ts` :

| Famille | Tableaux |
| --- | --- |
| Chèques | Souche de chèques; État des chèques émis; Bordereaux remise de chèques |
| Virements | Virements reçus; Virements émis; Virement multiple (salaires) |
| Traites | Bordereaux traites reçues; État des traites émises; Traites escomptées |
| Autres | Chiffre d'affaires; Détail des achats; État de caisse; État clients; État fournisseurs |

- « État des chèques émis » est tenu par le cabinet : le client peut le consulter, pas le saisir ni le transmettre; il est exclu de sa checklist et de son récap.
- Les souches génèrent une ligne par numéro fourni. Les bordereaux répartissent un montant d’en-tête sur leurs chèques/traites, préremplissent les lignes du groupe et signalent une somme incomplète. Un en-tête reçu du cabinet reste protégé côté client.
- Les colonnes calculées et les règles de dérivation de HT/TVA/TTC, soldes, anciennetés, agios nets et caisse restent dans les définitions et helpers de `src/lib/collecte/tabs.ts`; l’interface ne recalcule pas ces valeurs séparément.
- `computeManques` est un signal de cases ciblées, pas un validateur comptable universel. Les colonnes calculées/ignorées, fichiers joints et règles particulières de groupe restent prises en compte; une transmission ouverte peut rester incomplète.
- Checklist : réception manuelle ou dérivée de lignes; totaux calculés quand des lignes existent, sinon total manuel; date/commentaire de suivi persistés séparément.
- Correction documentée : les dates de suivi `AAAA-MM-JJ` sont maintenant interprétées comme des dates civiles locales. L’ancien `new Date(iso)` pouvait les afficher la veille selon le fuseau du navigateur.

## Récap, pièces et import/export

- Le cabinet envoie et clôt le récap tableau par tableau. Le client répond à toutes les demandes en attente avec l’action existante; des cases demandées dans un tableau fermé doivent être enregistrées avant réponse. Si une transmission globale et un récap attendent tous deux, le même geste client traite les deux.
- Les pièces peuvent être jointes à la collecte ou à une ligne, prévisualisées, téléchargées ou supprimées selon les droits existants. Import/export Excel/PDF et impression réutilisent les helpers du domaine.
- L’import PDF du grand livre accepte les PDF Sage 100 à texte sélectionnable, dans les six tableaux configurés par le parseur. Un PDF image n’est pas reconnu; l’extraction se fait dans le navigateur, l’utilisateur vérifie/sélectionne les lignes avant ajout au tableau non enregistré.
- Les rappels automatiques existants restent côté serveur : échéance, cadence, rappel pré-échéance unique et rappel d’échéance dépassée. Le rappel manuel reste réservé aux responsables autorisés.

## Matrice d’accès

| Acteur | Portée et actions dans la collecte |
| --- | --- |
| Administrateur | Toutes sociétés; création, configuration, revue, actions globales, archivage, rappel manuel et suppression. La suppression de collecte est admin seulement. Une collecte archivée reste en lecture seule, y compris pour l’admin. |
| Responsable des collaborateurs | Toutes sociétés; gestion de collecte, actions globales autorisées, archivage/désarchivage de tableau et rappel manuel. N’hérite pas des actions admin-only hors collecte. |
| Collaborateur affecté | Sociétés affectées; création, saisie cabinet, revue et validation/renvoi de chaque tableau, notes et récap. Pas d’actions de gestion globale réservées au responsable/admin. |
| Employé de société cliente (responsable ou délégué) | Société autorisée seulement; remplit/corrige les tableaux ouverts, coche le suivi permis, ajoute des pièces et transmet. Ne supprime pas les lignes déjà enregistrées, ne modifie pas les tableaux cabinet-seul et ne voit que les récaps envoyés. |

L’interface utilise `usePermissions()` et `src/store/collectes.ts`; les routes Express refont les contrôles de session, société et état. Ne pas ajouter de faux état métier ni de contrat API parallèle.
