# Authenticated CamConsult Application

These instructions apply to everything under `app comptabole/`.

## Scope

- This is the authenticated accounting/cabinet-management application.
- Do not edit sibling `../camconsult/` for work scoped here.
- Preserve authentication, authorization, routes and data scope unless the user
  explicitly requests a behavior change.
- Read the root guidance and focused `/docs` files before broad discovery.

## Current stack

Frontend: React 18, Vite 6, TypeScript, React Router 6, Zustand, Tailwind CSS 3,
shadcn/Radix primitives, TanStack Table and Vitest.

Backend: Node.js, Express 4, PostgreSQL (`pg`) and REST endpoints under `/api`.

## Important paths

- Routes/bootstrap boundary: `src/App.tsx`
- Authentication: `src/store/auth.ts`
- Shared bootstrap data: `src/store/data.ts`
- Permissions: `src/hooks/usePermissions.ts`
- Domain types: `src/types/index.ts`
- API client: `src/lib/api.ts`
- Layout: `src/components/layout/AppLayout.tsx`
- Sidebar/navigation: `src/components/layout/sidebar/`
- Shared table: `src/components/common/DataTable.tsx`
- Collectes: `src/store/collectes.ts`
- Balances/AFFECTAT: `src/store/balances.ts`
- Stock: `src/store/stock.ts`
- Bordereaux: `src/store/bordereaux.ts`
- Journal: `src/store/journal.ts`
- Notes/immobilisations: `src/store/notes.ts`, `src/store/immobilisations.ts`
- Backend composition/routes: `server/index.js`, `server/routes/`
- Backend authorization: `server/auth.js`, `server/permissions.js`

## Routes

- `/login`: public login.
- `/`: Dashboard.
- `/societes`: societies.
- `/taches`: internal team only.
- `/collectes`, `/collectes/:id`: collection list/editor.
- `/stock`, `/stock/:societeId`: internal team only.
- `/etats-financiers` and `/etats-financiers/:societeId...`: internal team only.
- `/structuration`, `/messagerie`: authenticated.
- `/bordereaux`, `/employes`, `/parametres`, `/journal`, `/grille-affectat`:
  admin only.

Use React Router navigation. Keep guards in `src/components/auth/` and do not
weaken backend route protection to match a client-only UI decision.

## Domain invariants

### Tâches

Real statuses are only `a_faire`, `en_cours`, `termine`.

Do not invent review status, priority, percentage progress or a deadline field.
Task timestamps are creation/update/completion timestamps, not due dates.

### Collectes

Real statuses are `brouillon`, `transmis`, `valide`, `a_corriger`, `archive`.
Deadline/reminder fields include `echeance`, `derniereRelanceLe` and
`relanceCadenceJours`. Reuse the collection store and server rules.

### Messaging

`src/store/data.ts` is authoritative for conversations, unread totals, presence,
message refresh, mark-read and message status. Reuse `useConversations` and the
existing message/conversation endpoints. Do not create a second messaging store
or calculate an incompatible unread count.

### Tables

Reuse `src/components/common/DataTable.tsx`, existing table primitives and the
page's established mobile renderer. Do not add another generic table abstraction.
Desktop tables should remain dense; mobile views should not force page-level
horizontal scrolling.

### Navigation

Do not modify Sidebar or Topbar unless explicitly requested. Navigation data,
permission filtering, active-route behavior and badges live in
`src/components/layout/sidebar/`. Preserve the 1024 px mobile breakpoint.

### Performance

Avoid N+1 requests. Never populate the Dashboard by requesting specialized data
once per société. Prefer scoped bootstrap data, existing list endpoints and
single-domain fetches.

## Dashboard

The final Dashboard is documented in `../docs/dashboard.md`. Its derived view
model is centralized in `src/lib/dashboard/dashboardData.ts`; keep derivation out
of page JSX and test pure rule changes there.

## Permissions

Use `usePermissions()` for client visibility and behavior. Respect `isAdmin`,
`can()`, `societeIds`, `canSeeSociete()`, `poste`, `lectureSeule` and
`isCollaborateur`. See `../docs/permissions.md` before changing scoped behavior.

## UI

- UI copy remains French unless the feature intentionally differs.
- Reuse existing shadcn and CamConsult shared components.
- Use semantic tokens rather than ad-hoc colors.
- Keep the compact spacing and full-width/min-width rules in
  `../docs/design-system.md`.
- Keep business derivation in hooks or pure library functions, not dense JSX.

## State and API

Reuse the existing Zustand domain store. Store actions call `src/lib/api.ts`,
then update local state from the server response. Do not duplicate server data in
a new store without a concrete ownership reason.

Frontend visibility is not authorization. Express routes must keep `requireAuth`,
`requireAdmin`, `can()`, `canSeeSociete()` or equivalent scoped checks.

## Validation

Run from this directory:

- Focused UI change: `npm run build`.
- Larger refactor: `npm run lint`, `npm run test`, `npm run build`.
- Always use `git diff --check` before handoff when files changed.
- For responsive work, manually check representative widths: 375, 768, 1024
  and 1440 px.
- Documentation-only edits do not require an application build.
