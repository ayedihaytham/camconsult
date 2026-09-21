# CamConsult Repository Instructions

## Repository applications

- `app comptabole/` is the authenticated cabinet-management product: Dashboard,
  Sociétés, Collaborateurs, Tâches, Collectes, Stock, États financiers,
  AFFECTAT, Bordereaux, Structuration, Messagerie, Journal and Paramètres.
- `camconsult/` is the public-facing Next.js website.
- For authenticated product work, operate inside `app comptabole/` only unless
  the user explicitly requests the public site.
- Do not copy code, dependencies or conventions between the sibling apps without
  checking that the target app actually uses them.

## Working strategy

1. Read this file and the focused document relevant to the request.
2. Inspect only the files needed to confirm current behavior.
3. Check the closest nested `AGENTS.md` before editing.
4. Reuse existing routes, stores, hooks, types and shared components.
5. Prefer a focused change over a parallel implementation or broad rewrite.
6. Preserve unrelated user changes in a dirty worktree.
7. Keep final reports concise: outcome, files changed, validation and remaining
   manual checks.

Do not recursively read the entire repository as a default discovery step.
Search by symbol or path first. Do not add a new abstraction until the existing
implementation has been checked for an equivalent.

## Existing architecture

Read [ARCHITECTURE.md](./ARCHITECTURE.md) for the repository map, routes,
application shell, stores and backend boundaries.

## Permissions

The authenticated product has three effective contexts:

- Admin
- Collaborateur (internal cabinet user)
- `societe_employe` (company-side, scoped/read-oriented account)

Read [docs/permissions.md](./docs/permissions.md) before changing visibility,
routes, mutations, navigation or data scope. Client-side hiding never replaces
backend authorization.

## Dashboard

Read [docs/dashboard.md](./docs/dashboard.md) before changing the authenticated
Dashboard. It records the current role-specific tabs, KPI definitions,
attention/deadline rules and data pipeline.

## UI and design

Read [docs/design-system.md](./docs/design-system.md). Preserve the compact
professional density, semantic colors, responsive renderers and existing
shadcn/shared primitives.

## Data flow

Read [docs/data-flow.md](./docs/data-flow.md) before adding fetching, stores or
mutations. Avoid duplicate domain state and N+1 requests.

## Conventions

Read [docs/conventions.md](./docs/conventions.md) for TypeScript, React, routing,
responsive, copy and component-reuse rules.

## Validation

Run commands from `app comptabole/` for authenticated application work.

Small focused UI change:

```text
npm run build
```

Larger refactor or behavior change:

```text
npm run lint
npm run test
npm run build
git diff --check
```

For documentation-only work, `git diff --check` plus link/scope verification is
sufficient. Do not run the full suite merely for a trivial Markdown or CSS-only
change unless risk or the user requires it.

## Context and token efficiency

- Use these documents before rediscovering architecture from source.
- Do not inspect unrelated directories or run broad searches without need.
- Do not restate unchanged architecture in commentary or final answers.
- Reference source paths; do not paste large source files into documentation.
- Keep changes and explanations proportional to the task.
- Avoid speculative features, fake domain fields and unnecessary abstractions.
- If documentation and code differ, current code is the source of truth; update
  the documentation as part of an authorized documentation task.
