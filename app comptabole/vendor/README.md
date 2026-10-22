# Dépendances copiées dans le dépôt (vendoring)

## xlsx-0.20.3.tgz — SheetJS (bibliothèque Excel)

| Élément | Valeur |
| --- | --- |
| Source officielle | `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` (documentation SheetJS, installation Node.js) |
| Taille | 2 409 319 octets |
| SHA-256 | `8dc73fc3b00203e72d176e85b50938627c7b086e607c682e8d3c22c02bb99fe8` |
| Intégrité (verrou npm) | `sha512-oLDq3jw7AcLqKWH2AhCpVTZl8mf6X2YReP+Neh0SJUzV/BdZYjth94tG5toiMB1PPrYtxOCfaoUCkvtuH+3AJA==` |
| Licence | Apache-2.0 |
| Pourquoi | La copie npm est figée en 0.18.5 et porte deux avis de sécurité sans correctif (pollution de prototype GHSA-4r6h-8v6p-xvw6, ReDoS GHSA-5pgg-2g8v-p4x9). Le fournisseur diffuse la 0.20.3 uniquement sur son CDN et recommande d'en garder une copie locale. |

**Ce que ce hachage prouve, et ne prouve pas.** Il a été relevé le 15 octobre 2026 (évaluation isolée) puis **retrouvé identique le 22 octobre 2026** à partir du même CDN : l'archive n'a pas changé entre les deux. Le fournisseur ne publie aucune somme de contrôle ni signature : ce hachage détecte une modification ultérieure, il ne démontre pas l'authenticité de l'archive à la source.

Contenu inspecté (15 octobre) : aucun chemin absolu ni `..`, aucun script d'installation, aucune dépendance, aucun appel réseau, `eval`, `new Function` ni `child_process` dans `xlsx.mjs`. Un seul fichier exécutable (`bin/xlsx.njs`, outil en ligne de commande non utilisé).

Installation : `npm install "xlsx@file:vendor/xlsx-0.20.3.tgz" --ignore-scripts`. Le Dockerfile copie `vendor/` avant `npm ci`.

Pour vérifier la copie : `sha256sum vendor/xlsx-0.20.3.tgz` doit afficher la valeur ci-dessus. Pour monter de version un jour : télécharger la nouvelle archive dans un dossier isolé, relever son hachage, relire le journal des modifications, installer avec `--ignore-scripts`, lancer toute la suite (`npm run test:all`), puis mettre ce fichier à jour.

Changements de comportement de 0.18.5 à 0.20.3 à connaître (relevés par l'évaluation du 15 octobre) : CSV à dates ISO en texte lu avec `cellDates` à minuit local (et non UTC) ; une cellule CSV `=1+1` est lue comme texte ; NaN et infini s'exportent en `#NUM!` / `#DIV/0!`. Le test `src/lib/classeurXlsx.test.ts` garde les valeurs lues d'un vrai classeur (montants au millime, texte numérique, formules, fusions, dates).

## Comparaison sur de vrais classeurs (22 octobre 2026)

Les six classeurs réels du dossier local `samples/` (non versionné : balances, états fournisseurs, relevés, suivi devise, apurement) ont été lus avec les deux versions côte à côte, mêmes options que les écrans d'import (`header: 1`, `raw: true`, `defval`, avec et sans `cellDates`), poste réglé sur le fuseau de la Tunisie : **80 lectures de feuille, 352 924 cellules comparées, aucune différence de montant, de décimale, de texte numérique ni de fusion de cellules.** Seules 17 différences, toutes dans un même classeur, de deux sortes (aucune valeur de cellule n'est reproduite ici) :

- **13 cellules de « date zéro »** (numéro de série 0, affiché « 1/0/00 », c'est-à-dire une case vide formatée en date) : 0.18.5 les lit au 30/12/1899 (minuit local), 0.20.3 au 31/12/1899. Ce ne sont pas de vraies dates. `src/lib/importCells.ts` les convertirait en « 1899-12-30 » avec l'ancienne version et « 1899-12-31 » avec la nouvelle : deux valeurs absurdes dans les deux cas, donc sans effet réel tant qu'un écran ignore les dates d'avant 1982 ; **non vérifié écran par écran** : si un import sort un jour une date de 1899, c'est une case « date zéro » du classeur source.
- **2 textes contenant un saut de ligne Windows** (retour chariot + saut de ligne) : 0.20.3 ne garde que le saut de ligne. Sans effet sur les montants ; à connaître si un écran compare un libellé exact contenant un saut de ligne.

