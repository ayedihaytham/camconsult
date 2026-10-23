# Simulation de paie

Écran `/simulation-paie` (menu Organisation, masqué aux comptes `societe_employe`) : estime le net à payer à partir du salaire de base, ou retrouve le salaire de base à partir d'un net souhaité.
Tout est calculé dans le navigateur ; aucune donnée n'est envoyée ni enregistrée. Le résultat est **indicatif**.

## Code

- `app comptabole/src/lib/paie/baremes.ts` : barèmes 2022 à 2026 (CNSS, CSS, frais professionnels, déductions, tranches d'IRPP), en millimes et en points de base ; `baremeApplicable(mois)`.
- `app comptabole/src/lib/paie/calcul.ts` : `calculerSimulation` (brut → net) et `etapesCalcul` (le déroulé affiché avec les chiffres saisis).
- `app comptabole/src/lib/paie/inverse.ts` : `salaireDepuisNet` (net → brut).
- `app comptabole/src/lib/paie/saisie.ts` : saisie en dinars → millimes, affichage `1 077,847`.
- `app comptabole/src/pages/SimulationPaiePage.tsx` : écran. Tests : `src/lib/paie/paie.test.ts` (chiffres de référence ci-dessous) et `src/pages/SimulationPaiePage.test.tsx`.

## Règles de calcul

Montants en millimes entiers (1 DT = 1 000), taux en points de base (968 = 9,68 %), arrondi au millime le plus proche.

1. Brut = base + transport + primes + panier.
2. CNSS salarié = brut × taux (9,18 % jusqu'en 2025, 9,68 % en 2026).
3. Brut imposable = brut − panier (le panier est soumis à la CNSS mais pas à l'impôt).
4. Net imposable du mois = brut imposable − CNSS ; annualisé ×12 (sans cumul ni régularisation).
5. Frais professionnels = 10 % de l'annuel, au plus 2 000 DT.
6. Déductions = 300 DT (chef de famille) + 100 DT par enfant, 4 enfants au plus.
7. Revenu imposable = annuel − frais − déductions, jamais négatif.
8. Impôt annuel = somme de l'impôt de chaque tranche (bornes basses incluses, hautes exclues), arrondie une seule fois ; IRPP du mois = impôt / 12.
9. CSS = revenu imposable / 12 × taux (1 % en 2022, 0,5 % ensuite) ; **exonérée en bloc** si le revenu imposable annuel est ≤ 5 000 DT (2023 et après).
10. Net = brut − CNSS − IRPP − CSS ; net à payer = net − retenues (avances, prêts).
11. Charges patronales affichées = CNSS patronale seule (16,57 % puis 17,07 % en 2026).

Le barème d'un mois est celui dont la date d'effet est la plus récente, au plus tard le dernier jour du mois ; aucun avant 2022.

## Du net au brut

Pas de formule inverse (impôt progressif, arrondis) : dichotomie sur des millimes entiers (0 à 10 millions de DT) pour le plus petit salaire dont le net à payer atteint la cible, puis,
parmi les 50 millimes suivants donnant exactement le même net, le montant le plus rond. À l'exonération de la CSS le net n'est pas strictement croissant : la recherche reste exacte mais peut
renvoyer un salaire plus élevé que nécessaire.

## Chiffres de référence (barème 2026 sauf mention)

| Cas | Entrée | Résultat |
| --- | --- | --- |
| A | base 1 000, transport 77,847 | brut 1 077,847 ; CNSS 104,336 ; IRPP 73,207 ; CSS 4,381 ; net 895,923 |
| B | base 2 500, transport 77,847, primes 200, panier 60, retenue 150, chef de famille, 2 enfants | net 2 092,393 ; net à payer 1 942,393 |
| C | base 500 | CSS exonérée ; net 451,600 |
| D | cas A en barème 2022 | IRPP 120,730 ; CSS 8,810 ; net 849,361 |
| E | base 9 000 | IRPP 2 580,687 ; CSS 39,811 ; net 5 508,302 |
| Inverse | net 1 500 (cas A) | base 1 871,474 ; brut 1 949,321 |
| Inverse | net 2 000 (cas B) | base 2 591,770 |
| Falaise | net 462,963 | base 515,261 (512,581 donne 462,963, 512,582 donne 460,881) |

## Limites

- Barèmes codés en dur : une loi de finances demande de modifier `baremes.ts` et d'ajouter une année.
- Pas de cumul annuel, de régularisation de fin d'année, d'heures supplémentaires, de congés ni de régimes particuliers.
- Taxe accident du travail, TFP, FOPROLOS et fonds de 0,5 % ne sont pas inclus dans les charges patronales ; déductions et taux patronal à faire valider par le cabinet avant tout usage contractuel.
