# Note de conception : lecture de classeurs dans un travailleur isolé

Statut : **proposition, rien n'est implémenté** (phase 10). À réaliser dans une phase distincte, après décision du propriétaire.

## Pourquoi
Les essais de la phase 10 montrent qu'un fichier de **8,9 Mo** (sous la limite de 10 Mio) contenant 3 millions de cellules fait échouer la lecture avec un tas de 512 Mo, et demande 17 s (0.18.5) à 23 s (0.20.3) et 1,4 Go avec un tas de 4 Go, dans les deux versions de `xlsx`. Une limite de taille ne borne ni la mémoire ni la durée. Un travailleur isolé permet d'interrompre la lecture et de confiner d'éventuelles pollutions de prototype hors de la page.

## Conception
- **Où** : un module `src/lib/classeurWorker.ts` (travailleur de module Vite : `new Worker(new URL("./classeurWorker.ts", import.meta.url), { type: "module" })`) qui importe `xlsx` dynamiquement, lit le tampon et renvoie un résultat réduit. Les huit écrans continuent d'appeler `lireTamponClasseur` (contrôle) puis une fonction unique `lireFeuillesIsolees(tampon, options)`.
- **Entrée** : `ArrayBuffer` transféré (`postMessage(msg, [tampon])`, sans copie), options sérialisables (`cellDates`, plage).
- **Sortie** : uniquement des **données simples** : `{ nom, rows: (string | number | boolean | null | { date: "AAAA-MM-JJ" })[][], fusions: {ligne1, ligne2, colonne}[] }`. Les `Date` sont converties dans le travailleur en valeurs explicites (le clonage structuré les accepte, mais la conversion explicite supprime l'ambiguïté de fuseau, voir ci-dessous). Ne jamais renvoyer l'objet classeur, ni de fonction, ni d'objet issu de la bibliothèque. Côté page, recopier dans des objets créés localement avec `Object.create(null)` ou des `Map` pour toute clé venant du fichier (noms de feuille, en-têtes) afin de ne jamais écrire une clé `__proto__` sur un objet ordinaire.
- **Délai et arrêt** : minuterie (par exemple 20 s, à régler) ; à l'expiration `worker.terminate()`, message « Lecture interrompue : le fichier est trop complexe ». Un travailleur par lecture (créé puis terminé), ce qui libère la mémoire ; verrou de lecture unique (une promesse en cours à la fois par écran).
- **Mémoire** : un travailleur épuisé par la mémoire se termine seul (événement `error`/`messageerror`) ; traiter comme un échec contrôlé. La mémoire autorisée est celle du navigateur ; on ne peut pas la plafonner finement : le contrôle préalable ci-dessous est donc nécessaire.
- **Contrôle préalable de décompression** : lire le répertoire central du zip (fin de fichier, sans décompresser) et refuser si la somme des tailles décompressées dépasse un seuil (par exemple 100 Mo) ou si le rapport de compression est aberrant. Complète la limite de 10 Mio.
- **Erreurs** : le travailleur renvoie `{ erreur: "code" }` ; la page le traduit en message français via `ClasseurRefuse` (déjà utilisé par les écrans). Aucune donnée du classeur dans les journaux.
- **Annulation** : si l'utilisateur ferme la boîte de dialogue pendant la lecture, `terminate()` et ignorer le résultat.

## Compatibilité des navigateurs
Les travailleurs de module sont pris en charge par les navigateurs récents (Chrome/Edge 80+, Safari 15+, Firefox 114+). Pour des navigateurs plus anciens, repli à lecture directe **avec** les contrôles de la phase 8. Le jeu de navigateurs réellement utilisé par le cabinet est à confirmer.

## CSP
La politique actuelle (en rapport seul) admet les travailleurs de même origine (déjà utilisés pour `pdf.js`). Prévoir `worker-src 'self'` explicitement au passage en CSP bloquante ; éviter `blob:` pour les travailleurs si le paquet de Vite peut émettre un fichier de même origine. Vérifier que le travailleur n'a besoin d'aucun `unsafe-eval` (`xlsx` n'en utilise pas dans les essais ; `pdf.js` et `exceljs` contiennent `new Function`, à confirmer au navigateur).

## Fuseaux horaires et dates (à traiter dans la même phase)
Les écrans d'import lisent les dates avec les accesseurs **locaux** (`getFullYear`...) sauf `ImportBiensDialog`, qui utilise `toISOString()` (UTC) : dans un fuseau à l'est de UTC comme la Tunisie, une date minuit locale donne la **veille**. Constat des essais : déjà vrai en 0.18.5 pour les dates d'un classeur `.xlsx`, et aggravé en 0.20.3 pour les dates en texte d'un CSV. Convertir les dates **dans le travailleur** en chaîne « AAAA-MM-JJ » à partir de la valeur affichée de la cellule, ou à partir du numéro de série, supprime la dépendance au fuseau.

## Tests à prévoir
Travailleur simulé en test unitaire (réponse, erreur, délai avec minuteries factices, annulation) ; essais avec fichiers synthétiques volumineux et malformés sous délai ; vérification qu'aucune clé `__proto__` ne peut être affectée ; vérification manuelle dans les navigateurs ciblés.
