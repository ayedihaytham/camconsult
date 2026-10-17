# Data Flow

## Authentication

On application start, `useAuth.restore()` reads the saved bearer token and calls
`GET /api/auth/me`. Login stores the returned token/session; logout calls the API,
clears both and resets access to authenticated routes.

```text
session restore/login → RequireAuth → authenticated route access
```

The server reconstructs employee scope and permissions from current database
records rather than trusting client state.

## Shared bootstrap

`DataBoundary` in `app comptabole/src/App.tsx` reacts to account identity changes,
clears shared state and calls `useData.hydrate()`.

```text
DataBoundary → GET /api/data/bootstrap → Zustand useData → selectors/components
```

The scoped bootstrap response currently contains:

- societies (`societes`)
- employees (`employes`)
- tree nodes/files (`noeuds`)
- messages (`messages`)
- group conversations (`groupConversations`)
- tasks (`taches`)
- notifications (`notifications`)

The backend filters these entities by the reconstructed session. Admin receives
cabinet-wide data; employee payloads are restricted by role and society/task
scope.

## Specialized stores

- `collectes.ts`: collection list/detail, notes, files, recap and reminders.
- `stock.ts`: stock movements and extraction.
- `banque.ts`: bank accounts and statement lines of one société (import deduplicated server-side).
- `fournisseurs.ts`: supplier invoices (from stock), règlements and proforma notes of one société.
- `balances.ts`: balances, AFFECTAT and manual financial inputs.
- `immobilisations.ts`: categories and assets.
- `notes.ts`: note models, company sheet and exercise notes.
- `bordereaux.ts`: bank remittance registry.
- `honoraires.ts`: client account (état client) per société, plus the all-clients recap (`GET /api/honoraires/recap`, one grouped query).
- `facturation.ts`: admin fee invoices (`/api/facturation`); e-invoice actions `conformite`, `preparer` and `telechargerXml` call `/api/facturation/:id/einvoice[...]` (TEIF XML, stored in `facture_einvoice`); TTN actions `fetchTtn`, `enregistrerTtn`, `testerTtn`, `deposer`, `actualiser`, `actualiserTout`, `rouvrir` call `/api/facturation/ttn[...]` and `/:id/einvoice/{deposer,actualiser,rouvrir}` (access stored encrypted in `ttn_connexion`); signature actions `fetchSignature`, `chargerCertificat`, `deverrouiller`, `verrouiller`, `supprimerCertificat` and `signer` call `/api/facturation/signature[...]` and `/:id/einvoice/signer` (the certificate is stored encrypted in `signature_certificat`; the password is never stored).
- `journal.ts`: admin audit entries.
- `ui.ts`: persisted desktop sidebar collapse preference, not domain data.

These stores fetch their domain only when the relevant screen or orchestration
hook needs it. Do not duplicate their server state in a new store.

The Grille AFFECTAT register searches, filters and paginates its already loaded
cabinet-wide codes in the client. Its attached-account count uses global
associations only. Société-specific account-to-code overrides are stored
separately and take precedence for that société; a code rename updates both
global and société associations. Changing a global poste affects financial
statement presentation, while removing a code leaves raw balance lines but
their amounts appear as unassigned until a poste is available again. The UI
keeps confirmation and impact copy for these report-affecting operations.

## Mutation pattern

```text
UI
→ existing store action
→ src/lib/api.ts
→ /api Express route
→ PostgreSQL
→ mapped response
→ local Zustand update
```

The API client supplies the bearer token, parses errors and removes an invalid
token after a 401.

## Messaging

Bootstrap supplies messages and group conversations. `useConversations()` in
`src/store/data.ts` derives direct/group conversation rows, latest message,
unread counts and presence for the current viewer. The same store owns refresh,
send and mark-read actions. Notification state is separately supplied by
bootstrap/refreshed through `/notifications`.

## Dashboard

`src/hooks/dashboard/useDashboardData.ts` combines:

- scoped bootstrap selectors for societies, collaborators, nodes, tasks,
  conversations and notifications;
- one scoped collection-list request;
- admin-only bordereaux and journal list requests.

`src/lib/dashboard/dashboardData.ts` converts those inputs into a role-specific,
memoized view model. There is currently no dashboard-summary endpoint.

The Daily Workspace collaborator lens, task continuation order and collection
date strip are pure local derivations of those inputs; changing scope/day adds
no request. Viewer conversations and unread counts do not change with the Admin
employee filter. Bootstrap hydration still gates the page. Collection failures
mask retained stale list data; journal exposes a fetch-error flag, and Admin
source readiness/errors allow partial data with retries through existing list
actions. No new endpoint or persistence subsystem is introduced.

## Performance rule

Never loop through all companies and issue one specialized request per company
to populate the Dashboard. Use already-scoped bootstrap entities, existing list
endpoints or a purpose-built aggregate endpoint if the model genuinely requires
one. This prevents N+1 latency and permission inconsistencies.

## Live signals

`src/lib/liveEvents.ts` keeps one server-sent-event stream per session
(`GET /api/events`). The server only pushes a *signal*, never business data; the
client then repeats its usual REST read. Signals: `message`, `notification`,
`collecte` (one collection changed) and `noeuds` (the Structuration tree changed:
upload, folder, move, rename, duplicate or delete, sent to everyone who sees the
société, the author included). `useData.refreshNoeuds()` re-reads `GET /api/noeuds`,
coalescing simultaneous calls; it also runs on tab return and on the 30 s safety
resync. UI actions that create nodes must await the store action and announce
success only after the server answered.
