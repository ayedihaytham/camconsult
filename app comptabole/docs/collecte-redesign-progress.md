# Collecte de pièces — avancement

- [x] Source d’origine et invariants métier/permissions consignés.
- [x] Registre cabinet orienté « À examiner »; première table en attente ouverte à l’arrivée dans un dossier.
- [x] Navigation de travail refaite : tables directes, séparation par famille, 14 définitions accessibles.
- [x] Espace client priorisé sur son premier tableau ouvert ou récap; curseur placé sur la case demandée, ligne vierge préparée si le tableau est vide.
- [x] Brouillon enregistré sur changement volontaire de section, état visible et saisie conservée en cas d’échec.
- [x] Pièces liées consultables depuis la table active; checklist, récap, documents, imports/exports, historique et opérations existants conservés.
- [x] Parcours avant/après comptés depuis les contrôles de l’interface, avec hypothèses notées dans `collecte-parcours-avant-apres.md`.
- [x] Suite ciblée du module : 72 tests réussis; `npm run lint` et le build de production TypeScript/Vite réussis.
- [x] Suite globale : 703 tests réussis et 11 ignorés; deux suites de classeurs ne s’exécutent pas car les fichiers Excel privés cités par ces tests sont absents du projet fourni.
- [x] Archive du projet reconstruite et contrôlée (`unzip -t`).
- [ ] Validation navigateur bloquée par l’environnement : le serveur Vite ne peut pas écouter sur localhost (`EPERM` sur le port 4173).

Défaut existant corrigé dans la première phase : les dates civiles de checklist pouvaient s’afficher la veille selon le fuseau du navigateur. Aucun contrat API ni statut métier ajouté.

État de livraison : l’implémentation, le contrôle TypeScript, les tests ciblés, le build et l’archive sont terminés. Restent la validation navigateur dans un environnement connecté au serveur local et le lancement de l’image Docker (CLI indisponible ici).

Correction du build Docker signalé : la commande de build TypeScript/Vite utilise `tsconfig.build.json`, qui type-checke l’application sans compiler les fichiers de test Vitest. Dans le projet fourni, `npm run lint` type-checke aussi l’ensemble du code et réussit. Docker n’est pas disponible dans cet environnement pour valider l’image elle-même.
