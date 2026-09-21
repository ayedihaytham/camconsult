# Conventions

## Language

User-facing copy remains French unless the existing feature intentionally uses
another language. Preserve domain vocabulary and accents.

## TypeScript

- Reuse domain types from `app comptabole/src/types/index.ts`.
- Avoid `any`; narrow unknown API/input data deliberately.
- Do not invent fields or statuses to satisfy a visual concept.
- Keep pure domain calculations testable outside React components.

## React

- Prefer focused components with explicit ownership.
- Keep business derivation out of JSX; use selectors, hooks or `lib/` functions.
- Preserve stable provider/layout boundaries.
- Avoid effects for values that can be derived during render or with `useMemo`.

## State and API

- Reuse existing Zustand stores and actions.
- Do not create duplicate stores for the same server domain.
- Follow the existing UI → store → API → server → state-update flow.
- Keep authorization and scope enforcement on the backend.
- Avoid N+1 fetching, especially one request per society.

## Routing

- Use React Router SPA navigation (`Link`, `NavLink`, `navigate`).
- Avoid full-page reloads for internal routes.
- Preserve the guard hierarchy in `src/App.tsx`.
- Route visibility does not replace server authorization.

## Components

Reuse installed shadcn primitives and existing CamConsult shared components.
Before creating a new table, sidebar, messenger, modal, dashboard primitive or
status renderer, search for the existing equivalent.

The shared generic table is `src/components/common/DataTable.tsx`. Domain pages
may provide a purpose-built compact mobile renderer; they should not fork a new
generic table system.

## Responsive behavior

- Use `w-full` and `min-w-0` through nested flex/grid layouts.
- Do not force desktop tables into page-level mobile horizontal scrolling.
- For meaningful UI work, validate representative widths: 375, 768, 1024 and
  1440 px.
- The authenticated Sidebar intentionally switches to mobile below 1024 px.

## Scope and edits

- Inspect relevant files only; preserve unrelated worktree changes.
- Do not modify Sidebar, Topbar, routing, authentication or permissions as a
  side effect of page work.
- Prefer small compatible changes over parallel implementations.
- Keep comments for non-obvious invariants, not restatements of code.

## Validation

- Focused UI change: `npm run build`.
- Larger behavior/refactor: `npm run lint`, `npm run test`, `npm run build`.
- Changed files: `git diff --check` before handoff.
- Documentation-only edits do not require the application build.

## Commits

When a commit is requested, use a concise conventional-style French message
that describes the user-visible or architectural change.
