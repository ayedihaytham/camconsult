# Collecte de pièces — invariants métier

Référence de maintenance pour `src/pages/collectes`, `src/lib/collecte`, `src/store/collectes.ts` et `server/routes/collectes.js`. Les API et contrôles serveur restent la source d’autorisation.

## Données et cycle

- Statuts persistés d’une collecte et d’une section : `brouillon`, `transmis`, `a_corriger`, `valide`, `archive`. Un tableau suit son propre circuit; le statut global ne remplace jamais les statuts de section.
- La demande de récap est distincte (`none`, `envoye`, `repondu`). Son envoi rouvre un tableau transmis ou validé pour correction. Le Récap est réservé à l’administrateur ; le client accède directement aux tableaux demandés et à leurs cases signalées.
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

- « État des chèques émis » est tenu par le cabinet : il est exclu du parcours client, des demandes de récap et de l’avancement client.
- Les souches génèrent une ligne par numéro fourni. Les bordereaux répartissent un montant d’en-tête sur leurs chèques/traites, préremplissent les lignes du groupe et signalent une somme incomplète. Un en-tête reçu du cabinet reste protégé côté client.
- Les colonnes calculées et les règles de dérivation de HT/TVA/TTC, soldes, anciennetés, agios nets et caisse restent dans les définitions et helpers de `src/lib/collecte/tabs.ts`; l’interface ne recalcule pas ces valeurs séparément.
- `computeManques` est un signal de cases ciblées, pas un validateur comptable universel. Les colonnes calculées/ignorées, fichiers joints et règles particulières de groupe restent prises en compte; une transmission ouverte peut rester incomplète.
- Checklist : réception manuelle ou dérivée de lignes; totaux calculés quand des lignes existent, sinon total manuel; date/commentaire de suivi persistés séparément.
- Correction documentée : les dates de suivi `AAAA-MM-JJ` sont maintenant interprétées comme des dates civiles locales. L’ancien `new Date(iso)` pouvait les afficher la veille selon le fuseau du navigateur.

## Récap, pièces et import/export

- Seul l’administrateur envoie et clôt les demandes, tableau par tableau. Ces actions sont visibles directement sur les lignes du Récap ; le détail des cases reste facultatif. L’enregistrement explicite d’un tableau par l’administrateur ouvre le Récap après succès ; l’auto-enregistrement lors d’un changement de section respecte la destination choisie. Un échec conserve le tableau et sa saisie.
- Le client enregistre dans le tableau, puis utilise « Enregistrer et transférer au cabinet » dans la même barre fixe. Cette transmission marque aussi la demande du tableau `repondu`, sans répondre aux autres tableaux. La clôture du Récap efface seulement la demande : elle ne valide ni n’archive le tableau. Les archives bloquent l’envoi et la clôture côté interface et serveur.
- Les pièces peuvent être jointes à la collecte ou à une ligne, prévisualisées, téléchargées ou supprimées selon les droits existants. Import/export Excel/PDF et impression réutilisent les helpers du domaine.
- L’import PDF du grand livre accepte les PDF Sage 100 à texte sélectionnable, dans les six tableaux configurés par le parseur. Un PDF image n’est pas reconnu; l’extraction se fait dans le navigateur, l’utilisateur vérifie/sélectionne les lignes avant ajout au tableau non enregistré.
- Les rappels automatiques existants restent côté serveur : échéance, cadence, rappel pré-échéance unique et rappel d’échéance dépassée. Le rappel manuel reste réservé aux responsables autorisés.

## Matrice d’accès

| Acteur | Portée et actions dans la collecte |
| --- | --- |
| Administrateur | Toutes sociétés; création, configuration, revue, Récap (envoi/clôture), actions globales, archivage, rappel manuel et suppression. Une collecte archivée reste en lecture seule, y compris pour l’admin. |
| Responsable des collaborateurs | Toutes sociétés; gestion de collecte, actions globales autorisées, archivage/désarchivage de tableau et rappel manuel. Aucun accès au Récap ni à son envoi/clôture. |
| Collaborateur affecté | Sociétés affectées; création, saisie cabinet, revue et validation/renvoi de chaque tableau, notes. Aucun accès au Récap ni à son envoi/clôture. Pas d’actions de gestion globale réservées au responsable/admin. |
| Employé de société cliente (responsable ou délégué) | Société autorisée seulement; remplit/corrige les tableaux demandés, ajoute des pièces et transmet chaque tableau. Ne supprime pas les lignes déjà enregistrées. Aucun Récap, Checklist, Documents, historique, export ou tableau cabinet-seul, y compris par lien direct. |

L’interface utilise `usePermissions()` et `src/store/collectes.ts`; les routes Express refont les contrôles de session, société et état. Ne pas ajouter de faux état métier ni de contrat API parallèle.
