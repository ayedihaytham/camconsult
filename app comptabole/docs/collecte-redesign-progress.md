# Collecte de pièces — avancement

- [x] Source d’origine et invariants métier/permissions consignés.
- [x] Registre cabinet orienté « À examiner »; première table en attente ouverte à l’arrivée dans un dossier.
- [x] Navigation de travail refaite : tables directes, séparation par famille, 14 définitions accessibles.
- [x] Espace client priorisé sur son premier tableau ouvert ou récap; curseur placé sur la case demandée, ligne vierge préparée si le tableau est vide.
- [x] Brouillon enregistré sur changement volontaire de section, état visible et saisie conservée en cas d’échec.
- [x] Pièces liées consultables depuis la table active; checklist, récap, documents, imports/exports, historique et opérations existants conservés.
- [x] Parcours avant/après comptés depuis les contrôles de l’interface, avec hypothèses notées dans `collecte-parcours-avant-apres.md`.
- [x] Suite de tests ciblés : 80 réussis; vérification TypeScript : réussie.
- [x] Build de production Vite réussi; archive du projet reconstruite après les derniers changements.
- [ ] Validation navigateur : le runner disponible ne peut pas joindre le serveur Vite local et aucun navigateur local n'est installé; à relancer dans un environnement navigateur connecté.

Défaut existant corrigé dans la première phase : les dates civiles de checklist pouvaient s’afficher la veille selon le fuseau du navigateur. Aucun contrat API ni statut métier ajouté.

État de livraison : l'implémentation, les tests ciblés, le build et l'archive sont terminés. La seule vérification restante est un parcours navigateur interactif dans un environnement qui peut joindre le serveur local.
