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

- Company-side employee with `poste === "societe_employe"`.
- `lectureSeule` is true and `isCollaborateur` is false.
- `societeIds` contains its company ID when assigned.
- Fixed permissions currently allow dossier consultation and messaging, while
  file deposit, society modification and deletion are false.
- Internal-team routes and navigation are unavailable.

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
