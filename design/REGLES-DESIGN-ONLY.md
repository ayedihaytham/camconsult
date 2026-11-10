# Refonte design : règles non négociables

Référence absolue : les maquettes de `design/maquettes/` (01 site, 02 connexion, 03 plateforme). Ce qu'elles montrent est ce que l'on veut obtenir.

Mission : changer l'apparence uniquement (couleurs, typographie, espacements, composition, composants visuels, animations CSS). Aucune modification de fonctionnalité ni de logique métier.

INTERDIT
- Modifier server/, shared/, stores, hooks, lib (API, auth, permissions), types, routes et gardes, appels réseau, validations.
- Changer la logique d'un composant (état, effets, handlers, conditions de rôle/permission, calculs, formats de données).
- Masquer, supprimer ou renommer un composant, champ, colonne, bouton, lien ou permission qui existe dans le projet, même si la maquette ne le montre pas : on l'habille dans le style de la maquette.
- Modifier un test pour le faire passer.
- Ajouter une dépendance sans demander. Copier du code entre camconsult/ et app comptabole/.

AUTORISÉ
- className, Tailwind, index.css, tailwind.config.js, globals.css, apparence de src/components/ui/.
- Réorganiser le JSX de présentation tant que props, handlers, conditions et textes fonctionnels restent identiques.
- Si la maquette montre un bouton/élément que le code n'a pas : l'ajouter en présentation uniquement quand il est rattaché à une fonction existante ; sinon le signaler.
- Les éléments de démo des maquettes (sélecteur Ordinateur/Mobile, rôles et états simulés, données fictives) ne sont jamais repris.

MÉTHODE : un lot à la fois ; typecheck + tests + build ; diff résumé ; commit seulement après aperçu et « go ».
