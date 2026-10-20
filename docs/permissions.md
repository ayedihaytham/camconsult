# Permissions

## Sources of truth

- Frontend context: `app comptabole/src/hooks/usePermissions.ts`.
- Route guards: `app comptabole/src/components/auth/`.
- Session scope: `app comptabole/server/auth.js`.
- Default flags: `app comptabole/server/permissions.js` and the mirrored defaults
  in `app comptabole/src/store/data.ts`.
- Each backend domain route remains responsible for authorization and scope.

## Effective account contexts

### Admin

- `session.role === "admin"`.
- Cabinet-wide society scope (`societeIds: null`).
- `isAdmin`, `isCollaborateur` and all `can(key)` checks are true.
- `lectureSeule` is false.
- May enter routes nested under `RequireAdmin`.

### Collaborateur

- Employee session with `poste === "collaborateur"`.
- Internal cabinet user; `isCollaborateur` is true.
- Society scope is the union produced by the server from assigned societies and
  societies referenced by tasks assigned to the employee.
- Capabilities come from role defaults plus stored permission overrides.
- Dashboard/bootstrap task data is scoped to assigned tasks.

### `societe_employe`

- Product scope, for now: the sidebar only offers Dashboard and Collecte de pièces
  (`visibleNavigation({ espaceCollecteSeul })`), and `DataBoundary` redirects any
  other address to `/collectes` (`cheminAutoriseClient`). This is a UI scope; backend
  authorization is unchanged. Inside a collecte the client sees only the Récap and the
  tables the cabinet asked for (sent through the Récap, or returned for correction —
  `estDemande`) plus those already transmitted or validated (consultation). A table
  of the collecte that the cabinet has not sent is invisible to the client; there is no
  global « Transmettre » button for the client, each table is transferred on its own.
  No Checklist, Documents, history, exports or cabinet-only tables.

- Company-side employee with `poste === "societe_employe"`.
- `lectureSeule` is true and `isCollaborateur` is false.
- `societeIds` contains its company ID when assigned.
- Fixed permissions allow dossier consultation and messaging, while the `deposerFichiers`,
  society modification and deletion flags are false. Exception (Structuration): the
  responsable/délégué of a society may **add files** to existing folders of **their own
  society** (`POST /api/noeuds`, `type = fichier`, parent folder required, same society,
  never a `cabinet_only` folder). Creating folders, renaming, moving, duplicating and
  deleting stay refused (403). The UI shows « Ajouter un fichier » (FileTree `canAddFile`)
  but no folder creation.
- Internal-team routes and navigation are unavailable.

## Sessions et authentification

- **Jeton** (JWT HS256, 12 h) : l'algorithme est imposé à la vérification (`server/auth.js`). Il porte `role`, `employeId` et `v`, la **version
  des sessions** du compte (`employes.session_version`, `app_meta.session_version`). Un jeton sans `v` vaut 0 (comptes jamais modifiés).
- **Révocation** : un changement de mot de passe (activation ou réinitialisation par lien, `POST /auth/change-password`,
  `PATCH /auth/credentials` avec nouveau mot de passe) incrémente la version : tous les anciens jetons (autres appareils, session volée)
  sont refusés (401) ; la réponse porte un jeton neuf qui garde l'appareil courant connecté. Un compte désactivé perd l'accès
  immédiatement (la session est relue en base à chaque requête).
- **Appareils connectés** (`server/sessions.js`, table `sessions_connexion`) : chaque connexion ouvre une session (appareil lu dans le User-Agent,
  adresse, dates) et le jeton porte son `sid`. `GET /auth/sessions` liste les appareils du compte (la courante marquée) ; `POST
  /auth/sessions/:id/revoquer` en ferme un seul (refusé aussitôt : « Cette session a été fermée ») ; « Se déconnecter » ferme la session courante ;
  l'administrateur voit et ferme celles d'un employé (`GET /employes/:id/sessions`, `POST /employes/:id/sessions/:sid/revoquer`, `…/revoquer-toutes`).
  Interface : menu du compte › « Mes appareils connectés » (tous les rôles), liste des comptes › « Appareils connectés » (administrateur). Un jeton
  sans `sid` (émis avant la liste) reste valable et rejoint la liste à son renouvellement ; la version des sessions du compte ferme toujours tout d'un coup
  (changement de mot de passe, « déconnecter mes autres appareils »).
- **Déconnecter mes autres appareils** : `POST /auth/deconnecter-autres` (menu du compte, tous les rôles) incrémente la version des sessions du
  compte ; toutes les autres sessions sont refusées, un jeton neuf garde l'appareil courant. Inscrit au journal.
- **Renouvellement** : une session active n'est pas coupée en pleine journée. Au-delà de 3 h d'âge, la réponse porte l'en-tête
  `X-Token-Renouvele` (jeton neuf de 12 h, même version) que `src/lib/api.ts` enregistre. Inactive plus de 12 h, la session expire.
- **Mot de passe provisoire** : tant que `doitChangerMotDePasse` est vrai, `requireAuth` ne laisse passer que `/api/auth/*`
  (403 `CHANGER_MOT_DE_PASSE` ailleurs) : le changement forcé ne repose pas seulement sur l'écran.
- **Double authentification de l'administrateur** (TOTP, RFC 6238 ; `server/totp.js`, `POST /auth/2fa*`, Paramètres › Sécurité) : activation
  avec une application d'authentification (QR code, puis confirmation par un code), dix codes de secours à usage unique montrés une seule fois,
  secret chiffré en base (AES-256-GCM, clé dérivée de `AUTH_2FA_SECRET`, à défaut `JWT_SECRET`). Connexion en deux étapes : le mot de passe
  donne un **ticket de 5 minutes sans aucun droit** (`typ: "2fa"`, refusé par `requireAuth`), le code ouvre la session. Un code ne sert jamais
  deux fois (dernier pas enregistré, mise à jour atomique) ; les mauvais codes comptent dans le blocage de l'administrateur. Activer ou
  désactiver ferme les autres sessions. Désactiver, ou régénérer les codes, exige le mot de passe ET un code. Téléphone perdu et codes
  épuisés : `node server/scripts/reset-2fa-admin.js` sur le serveur (`docker exec -it app-comptable …`, simulation par défaut, `--apply
  --confirmer-cible=…` pour écrire). Changer `AUTH_2FA_SECRET`/`JWT_SECRET` rend les secrets TOTP illisibles : même script. Les autres rôles
  ne sont pas concernés pour le moment.
- **Politique de mot de passe** : `motDePasseAcceptable` (8 caractères, pas l'identifiant) pour les employés **et** l'administrateur.
- **Force brute** : `server/loginGuard.js`, **persistante** (table `tentatives_connexion`, PostgreSQL) : 8 échecs par compte et adresse,
  30 par identifiant (toutes adresses), 100 par adresse, sur 15 minutes ; le blocage survit au redémarrage du serveur. Un **nouvel accès
  demandé par la personne** lève son blocage : lien de réinitialisation émis par le cabinet (`POST /employes/:id/envoyer-acces`) ou utilisé
  (`POST /auth/activate`) — `leverBlocage`, jamais pour l'administrateur (son blocage ne se lève qu'avec le temps) ni pour le blocage
  d'une adresse. L'événement est inscrit au journal.
- **Chargement de la page** (`useAuth.restore`) : seul un refus du serveur (401/403) met fin à la session. Une panne passagère
  (redémarrage, réseau coupé) conserve le jeton et affiche « Serveur momentanément indisponible » avec un bouton Réessayer.
- **Sans session**, `usePermissions` ne donne aucun droit (jamais le contexte administrateur).
- **Tests** : `server/integration/routesProtegees` (toute route relevée dans le code refuse l'absence de jeton, hors santé / connexion /
  activation ; jetons forgés ou expirés), `server/integration/sessions` (jetons, révocation, mot de passe provisoire, matrice des rôles,
  société étrangère), `src/store/auth.test.ts`, `src/hooks/usePermissions.test.tsx`.
- **Politique d'accès par société figée par les tests** : l'administrateur et le responsable des collaborateurs accèdent à toutes les
  sociétés (collectes, état SWIFT, stock, banque, fournisseurs, états financiers, suivi devise) ; le collaborateur à ses sociétés
  assignées ; les comptes de société à leur seule société, sans les outils internes. L'état client (honoraires) reste à l'administrateur
  et aux comptes de la société concernée. Le menu du responsable des collaborateurs et l'API disent la même chose (plus de page
  visible qui répond « accès non autorisé »).

## Frontend concepts

- `RequireAuth`: restores/protects the authenticated shell; unauthenticated users
  are redirected to login.
- `RequireEquipe`: permits admin or `isCollaborateur`; company employees are
  redirected to the Dashboard.
- `RequireAdmin`: permits admin only; other authenticated accounts are redirected.
- `can(key)`: checks `PermissionKey` flags (`consulterDossiers`,
  `deposerFichiers`, `modifierSocietes`, `supprimer`, `messagerie`).
- `societeIds`: `null` means all for admin; an array is the employee scope.
- `canSeeSociete(id)`: true for admin/all scope, null model records, or IDs in the
  employee scope.
- `lectureSeule`: company-side/read-oriented behavior.
- `isCollaborateur`: internal team shortcut (admin or collaborator).

Navigation also applies `adminOnly`, `hideForSocieteEmploye` and permission-key
filters in `src/components/layout/sidebar/navigation.ts`.

## Backend enforcement

`requireAuth` verifies the bearer token and reconstructs a fresh session from
PostgreSQL. `requireAdmin` enforces admin-only routes. `can(session, key)` checks
flags and `canSeeSociete(session, id)` checks society scope. Domain routes add
operation-specific checks.

**Frontend visibility does not replace backend authorization.** Hiding a button,
route or navigation item is UX only; the matching API must reject unauthorized
requests and out-of-scope society IDs.

## Suivi fournisseur

- Lecture : admin, responsable des collaborateurs (toutes les sociétés), collaborateurs de la société et responsable ou délégué de la société cliente
  (mêmes accès pour les deux). Écriture : admin, responsable des collaborateurs et collaborateurs de la société — `server/routes/fournisseurs.js`
  (`canRead` / `canWrite`). Le menu et la route (`RequireSuiviFournisseur`) ne font que refléter ces règles.
- Un règlement ne peut couvrir que des factures de la même société, du même fournisseur et de la
  même devise, sans dépasser le solde de chaque facture.

## Suivi bancaire

- Mêmes règles que le suivi fournisseur : lecture pour l'admin, le responsable des collaborateurs, les collaborateurs de la société et
  le responsable ou le délégué de la société cliente, écriture pour l'admin, le responsable des collaborateurs et les
  collaborateurs — `server/routes/banque.js`.
- Un règlement fournisseur ne peut être rapproché que d'un mouvement bancaire de sa société, et un
  mouvement ne règle qu'un seul règlement.

## État client (honoraires)

- Écriture (lignes, pièces jointes, import, envoi par la messagerie) : admin
  uniquement — `server/routes/honoraires.js`, `requireAdmin` sur chaque route
  d'écriture.
- Lecture seule (liste + téléchargement des pièces jointes) : admin, et le
  **responsable ou délégué de la société concernée** (`poste === "societe_employe"`,
  jamais une autre société — `canRead` côté serveur,
  `RequireEtatClient` + redirection vers sa société côté client).
- Le contenu d'une pièce jointe n'est jamais dans les listes : chargé à la
  demande via `GET /honoraires/:id/piece` (même contrôle d'accès).

## État de souche de chèques

- Admin uniquement, lecture comme écriture : `server/routes/soucheCheques.js`
  (`requireAuth` + `requireAdmin` sur tout le routeur), routes client sous
  `RequireAdmin` (`/souche-cheques`, `/souche-cheques/:societeId`) et entrée de
  menu `adminOnly`. Aucun accès collaborateur, responsable ou société.

## Délégué de société et gestion de stock

- Le délégué de société a exactement les mêmes accès et les mêmes vues que le responsable de société (`isResponsableSociete` côté client, `isSocieteSide` côté serveur) ; seul son libellé change.
- Gestion de stock : admin et responsable des collaborateurs (toutes les sociétés), collaborateurs sur leurs sociétés — `canAccess` dans `server/routes/stock.js`. Jamais le client.

## Souche de chèques de la société

- Le responsable ou délégué de société remplit la souche depuis son menu « Souche de chèques » (`/ma-souche`, `SoucheClientPage`) : le même tableau que celui de la collecte, une souche par période. Elle n'apparaît plus dans ses collectes (`tableauxVisiblesClient`).
- Données : les lignes du tableau `souche_cheques` de chaque collecte de la société ; `GET /collectes/souche?societeId=` ne renvoie que ce tableau, et le client transmet au cabinet par le circuit habituel du tableau.
- Le cabinet (admin, responsable des collaborateurs, collaborateurs) consulte la souche en lecture seule dans la collecte (le serveur refuse son écriture) ; s'il manque des informations, il les complète dans « État des chèques émis » et le renvoie au client par le Récap. Le registre admin `/souche-cheques` ne change pas.

## Mots de passe et liens d'accès

- Aucune réponse de l'API ne contient de mot de passe ni d'empreinte (`employeDto` : seulement `accesActive`). Identifiant et mot de passe d'une société ne sont plus renvoyés.
- Création d'un compte : pas de mot de passe ; le lien d'activation à usage unique est renvoyé une fois à l'administrateur ou au responsable des collaborateurs
  (et envoyé par email si le SMTP est configuré). Même contrôle de rôle que la création : un responsable des collaborateurs ne gère que les comptes collaborateur et société.
- Le journal d'activité n'est plus effaçable ; la réinitialisation des données est réservée à l'administrateur et désactivée en production par défaut.
