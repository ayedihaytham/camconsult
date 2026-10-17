# Verrous de conformité et exploitation

| Verrou | État / comportement sûr |
| --- | --- |
| B1 format BCD officiel 2026 | Non fourni : export officiel interdit |
| B2 arrondi et agrégation | Non approuvé : calcul provisoire, validation financière finale bloquée |
| B3 dates partielles | Conservation brute, blocage strict par ligne |
| B4 plafonds / validité | Nullables, aucun plafond ou taux supposé |
| B5 lignes Stock | Correction inverse confirmée seulement pour une ligne quantité 1/TND/cours 1 ; autres cas à corriger dans Stock |
| B6 preuve d'acceptation | Saisie humaine et preuve obligatoires, aucune acceptation automatique |
| B7 rétention / sauvegarde | Preuves immuables bornées ; procédure de rétention à approuver |
| B8 échéances | Configuration explicite, aucune date légale prédéfinie |

L'indicateur `APUREMENT_OFFICIAL_BCD_ENABLED` est faux par défaut. Le définir
ne doit jamais suffire sans profil officiel et fixtures acceptées. Aucun profil
officiel n'est livré en l'absence de B1/B2. Test BCD explicitement non officiel.

Les sources privées ne deviennent jamais des fixtures Git. Les tests permanents
emploient des identités et montants synthétiques ; les écarts +13 millimes sont
des anomalies à montrer, jamais des corrections implicites.
