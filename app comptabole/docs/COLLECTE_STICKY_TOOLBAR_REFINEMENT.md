# Collecte de pièces — barre sticky : ajustement UX

## Modifications

- Suppression de l'action explicite « Nouveau bordereau » (chèques et traites). Aucun appel à un nouveau groupe vide depuis la barre.
- Pour un bordereau déjà présent, l'ajout de chèque/traite reste lié à son propre récapitulatif.
- La touche Entrée dans la dernière case poursuit ce bordereau et recopie les champs de groupe, même si le montant annoncé n'a pas encore été saisi ; elle ne démarre plus un nouveau bordereau vide.
- Un seul bordereau occupe la largeur disponible sans carte intérieure inutile. Plusieurs bordereaux restent consultables dans un rail horizontal compact, sans agrandir la hauteur sticky.
- Importer, exporter en Excel/PDF, imprimer, enregistrer et l'indication d'état sont regroupés au bas de la même barre.
- Conservation des groupes déjà enregistrés, des lignes importées et de l'agrégation financière. Le reste de l'application et les appels backend sont inchangés.

## Validation

- Analyse syntaxique TypeScript/TSX des fichiers modifiés : OK.
- Tests d'interactions existants adaptés à la suppression de « Nouveau bordereau » ; **non exécutés** dans cet environnement.
- `npm ci` n'a pas abouti (erreur du gestionnaire npm « Exit handler never called »), donc build, Vitest et vérification navigateur non confirmés.

À valider localement : `npm ci && npm run lint && npm test && npm run build`, puis test d'un bordereau long, de plusieurs bordereaux importés, d'un compte cabinet et d'un compte client.
