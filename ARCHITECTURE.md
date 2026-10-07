# CamConsult Architecture

## Repository applications

| Path | Purpose | Stack |
| --- | --- | --- |
| `app comptabole/` | Authenticated cabinet-management product | React/Vite frontend, Express/PostgreSQL backend |
| `camconsult/` | Public marketing website | Next.js application |

Authenticated product tasks must not modify `camconsult/` unless explicitly
requested. Each sibling has its own package manager metadata and UI conventions.

## Authenticated application

The main frontend lives in `app comptabole/src/`:

- `pages/`: route-level screens.
- `components/`: shared UI, layout, navigation and domain components.
- `hooks/`: permission and domain orchestration hooks.
- `store/`: Zustand session, bootstrap and specialized domain stores.
- `lib/`: API client, pure domain derivation and utilities.
- `types/`: shared frontend domain types.

The backend lives in `app comptabole/server/`:

- `index.js`: Express composition, API mounts, production static serving.
- `routes/`: REST endpoints by domain.
- `auth.js` and `permissions.js`: session reconstruction, guards and scope.
- `db.js`, `schema.sql`, `ensureSchema.js`, `migrate.js`: PostgreSQL access and schema.
- `mappers.js`, `notifications.js`, `journal.js`: DTO and cross-domain helpers.
- `relances.js`, `mailer.js`, `ocr.js`: scheduled and specialized services.

## Routing

`app comptabole/src/App.tsx` defines lazy React Router routes.

- Public: `/login`.
- Authenticated shell: `/`, `/societes`, `/collectes`, `/collectes/:id`,
  `/structuration`, `/messagerie`.
- Internal team (`RequireEquipe`): `/taches`, `/stock`, `/stock/:societeId`,
  `/etats-financiers`, `/etats-financiers/:societeId`, its print route and
  balance editor route.
- Suivi fournisseur (`RequireSuiviFournisseur`): `/fournisseurs`, `/fournisseurs/:societeId` —
  the team writes, a société responsable reads only their own société (never a délégué).
  Purchase invoices are the achat side of `stock_mouvements`; only règlements
  (`fournisseur_reglements` + `fournisseur_affectations`) and proforma/chargement notes
  (`fournisseur_suivi`) are stored. API: `server/routes/fournisseurs.js`.
- Suivi bancaire (same guard): `/banque`, `/banque/:societeId` — bank accounts and their statement
  lines (`comptes_bancaires`, `mouvements_bancaires`; debit/credit are the bank's, the "vue société"
  swaps them at display). A supplier payment is matched to one `fournisseur_reglements` row through
  `mouvement_bancaire_id`. API: `server/routes/banque.js`.
- Admin (`RequireAdmin`): `/bordereaux`, `/facturation`, `/employes`, `/parametres`, `/journal`,
  `/grille-affectat`.
- `*` renders the authenticated not-found page.

## Active société

The top bar (`SocieteActiveSelect`) sets the société the user works on
(`store/societeActive.ts`, in memory only: every session starts on "Toutes les
sociétés"). It is limited to the sociétés the user can see (`canSeeSociete`) and
hidden for company-side accounts. `/stock`, `/fournisseurs`, `/banque`, `/etats-financiers`, `/honoraires`,
`/souche-cheques` and `/suivi-devise` open on the active société's page (menu links
rewritten by `ciblerNavigation`), a `/<module>/:societeId` URL makes that société
active, and the Dashboard (`useDashboardData`) and Facturation are scoped to it.
The pure rules live in `src/lib/societeContext.ts`. Bordereaux and the journal are
not tied to a société and are left out of a scoped Dashboard.

Route guards are nested around groups; page-level actions still use permission
flags, and every protected backend route must enforce its own authorization.

## Application shell

`src/components/layout/AppLayout.tsx` owns the stable authenticated shell:

```text
SidebarProvider
├─ AppSidebar (official shadcn Sidebar composition)
└─ SidebarInset
   ├─ Topbar (trigger, breadcrumbs, notifications, user menu)
   └─ Outlet
```

Desktop collapse is persisted in `src/store/ui.ts`. Mobile/off-canvas state is
owned by the Sidebar provider, with the intentional 1024 px breakpoint in
`src/hooks/use-mobile.tsx`. Navigation declarations and visibility filters live
under `src/components/layout/sidebar/`.

The shell also mounts one `src/components/tour/TourProvider.tsx`. Its shared
registry maps authenticated routes to short walkthroughs. Pages and shared
components expose stable `data-tour` targets; the provider owns spotlight
positioning, navigation, focus, and versioned per-account completion in local
storage. Tour state is not sent to the backend.

## Main frontend data flow

```text
auth restore/login
→ RequireAuth
→ DataBoundary
→ GET /api/data/bootstrap
→ useData hydration
→ selectors/hooks
→ pages and components
```

`DataBoundary` clears and rehydrates shared data when the authenticated account
changes. See [docs/data-flow.md](./docs/data-flow.md) for entity and mutation
details.

## Domain stores

- `auth.ts`: token-backed session, login, restore, logout and credentials.
- `data.ts`: bootstrap entities and shared society/employee/tree/message/task/
  notification actions and selectors.
- `collectes.ts`: collection lists, editors, notes, files and reminders.
- `stock.ts`: stock movements and document extraction.
- `balances.ts`: balances, AFFECTAT and financial-statement inputs.
- `immobilisations.ts`, `notes.ts`: financial-statement supporting domains.
- `bordereaux.ts`, `journal.ts`: admin banking registry and audit journal.
- `facturation.ts`: admin fee invoices (totals computed server-side; no delete, invoices are cancelled).
- `ui.ts`: persisted desktop sidebar preference only.

## Backend communication

The common mutation path is:

```text
UI event → Zustand action → src/lib/api.ts → Express route → PostgreSQL
         ← local store update ← mapped JSON response ←─────────────────
```

The API client prefixes `/api`, sends the bearer token and clears it after a
401. In development Vite proxies the API; in production Express can serve the
compiled SPA from `dist/`.

## Permissions

Frontend permission context comes from `src/hooks/usePermissions.ts`; backend
authority comes from the reconstructed session in `server/auth.js`, route guards
and route-level scope checks. See [docs/permissions.md](./docs/permissions.md).

## Focused references

- [Dashboard](./docs/dashboard.md)
- [Design system](./docs/design-system.md)
- [Permissions](./docs/permissions.md)
- [Data flow](./docs/data-flow.md)
- [Conventions](./docs/conventions.md)
