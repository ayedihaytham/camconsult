# Task workspace — Kanban, Liste and Gantt

The authenticated `/taches` workspace has three views over the same scoped task
data. This extension preserves the existing CamConsult design system,
navigation and task permissions. It adds optional planned dates authorized for
the Gantt; task activity timestamps retain their existing meaning.

## Shared workspace

- Kanban is the initial view at 1024px and above; Liste is the initial view
  below 1024px. All three views remain selectable at every width. The selection
  is local component state, not a saved account preference.
- Search matches title, description, company and assignee. Company, assignee
  and status filters retain their existing permission rules. Switching views
  preserves search and filters.
- The active company scopes the task set before these filters. Banner counts
  describe that scoped set; the view toolbar count describes filtered results.
- Creation, editing, status changes and deletion reuse the existing task form,
  store actions and authorization checks. Pending status changes prevent repeat
  submissions; failed changes restore the prior visual status.
- Empty task data and an empty filter result have distinct messages.

The page orchestration lives in
[TachesPage.tsx](../src/pages/taches/TachesPage.tsx); the shared views and search
composition live in
[kanban-board-shadcnui.tsx](../src/components/uitripled/kanban-board-shadcnui.tsx).

## Kanban and Liste

Kanban retains the three real statuses: `a_faire`, `en_cours`, `termine`.
Cards show company, title, optional description, assignee, optional planned
interval, textual status, authorized next action and activity metadata.
The title opens editing only when permitted. Status movement uses a separate
drag handle, with pointer and keyboard support; menus and next actions provide
equivalent status controls without dragging. Moving a card changes its status,
not a persisted ordering.

Desktop presents three columns. Below 1024px, status controls select one column
and show its filtered count. An empty column is disabled, and filtering falls
back to a populated column when available. Liste reuses the existing paginated
table and compact responsive renderer in
[TaskTableView.tsx](../src/components/tasks/TaskTableView.tsx).

## Planned dates and Gantt

The existing form adds **Début prévu** and **Fin prévue**. Both may be empty,
or both must contain valid civil dates with finish on or after start. A task
can occupy a single day. **Effacer les dates** clears the pair. Validation is
shared by frontend and server through
[taskPlanning.js](../shared/taskPlanning.js); the form presents linked field
errors and preserves input on a failed save.

[TaskGanttView.tsx](../src/components/tasks/TaskGanttView.tsx) displays only these
planned intervals. Semaine uses Monday through Sunday; Mois uses the calendar
month. Previous/next controls move by one period and Aujourd’hui returns to the
current date. Scheduled tasks are sorted by planned start and then title.

The date grid scrolls locally, with a sticky identity column showing company,
assignee, full planned dates, textual status and available actions. Weekends
have a quiet surface treatment; today's date has a gold marker. Bars cover both
start and finish days and clip at period boundaries with square continuation
edges. A task outside the displayed period keeps its identity and an
**Afficher sa période** action there, reachable on phones without scrolling
across the timeline. That action navigates to its planned start.

An editable bar opens the existing task form. Read-only bars retain date and
status information. Tasks with no valid plan remain in **Non planifiées** below
the grid, with **Planifier** only for authorized editors; they also remain in
Kanban and Liste. The Gantt does not implement drag rescheduling. Calendar
derivation and inclusive bar positioning live in
[taskGantt.ts](../src/lib/taskGantt.ts), independently of creation, update and
actual completion timestamps. Planned dates do not define overdue status,
deadlines, dependencies, priority or percentage progress.

## Design and responsive behavior

[DESIGN.md](../../DESIGN.md) and the existing
[design-system.md](../../docs/design-system.md) remain authoritative. The scoped
[tasks-views.css](../src/components/tasks/tasks-views.css) reuses semantic navy,
warm neutral, card, border, success and gold focus tokens. It introduces no
global palette, font or design-system change.

Working sans carries titles and metadata. Kanban titles use 14px/600 with a
1.5 line height; Gantt identity and metadata use 12px and 11px. Fine rules and
restrained 5–8px corners separate working regions. Todo bars are neutral,
in-progress bars navy and completed bars pale success; text conveys the status.
Gold marks today and focus, rather than task warning state.

Gantt identities are 280px wide, reducing to 172px below 640px. Month cells have
a 34px minimum width and week cells 96px; overflow belongs to the timeline.
Phone controls and planning inputs have 44px targets where defined in this
extension. Unscheduled rows wrap on phones. The existing mobile create action,
filter overlay and list renderer retain their permission and shell behavior.

## Data and authorization integration

Tasks remain in the shared bootstrap-backed
[useData store](../src/store/data.ts). No second task store, per-company fetch
loop or Gantt endpoint is added. Existing create/update actions send
`debutPrevu` and `finPrevue` as `YYYY-MM-DD` strings or `null`; omitted patch
fields preserve stored dates, while clearing sends both as `null`.

[taches.js](../server/routes/taches.js) validates the complete resulting pair
before inserting or updating. [mappers.js](../server/mappers.js) returns civil
date strings without shifting PostgreSQL local dates to the preceding day.
[data.js](../server/routes/data.js) carries dates through scoped bootstrap,
backup and restore; old backups without planning remain unplanned.

Planning follows the existing edit permission, not permission to advance a
status. Admin and the cabinet team manager edit cabinet-origin tasks. The
company-origin circuit remains managed by its own company responsible account;
cabinet users see those tasks read-only, with the existing admin cleanup
exception for deleting completed company tasks. An assignee can submit only an
authorized forward status transition, never a planning or content edit.
Backend session, origin and scope checks remain authoritative. This extension
does not expand company-side route or navigation access; see
[permissions.md](../../docs/permissions.md) for the existing client boundary.

[schema.sql](../server/schema.sql) adds nullable `debut_prevu` and `fin_prevue`
PostgreSQL `date` columns using additive, idempotent statements, plus
`taches_planification_check` requiring an empty pair or an ordered complete pair.
Existing task rows remain unplanned. Server startup calls
[ensureSchema.js](../server/ensureSchema.js) before listening.

## Finish evidence and remaining checks

The independent finish review disposition is **ship**, after moving the
out-of-period action into the sticky task identity and verifying it at 375px
and 768px. Kanban, Liste and Gantt were previewed at 375, 768, 1024 and 1440px;
the planning form at 375 and 1440px. Review screenshots under
`.impeccable/review/tasks-workspace/` are ignored, labeled synthetic preview
evidence, not shipped UI assets or live production data. No shipping raster
asset was introduced.

Lint, build and 20 scoped tests passed. The full suite recorded 852 passing and
11 skipped tests, with two suites failing because their Excel fixtures are
missing. These failures do not establish a passing full suite.

The schema was not exercised against a live database: project connection
configuration was unavailable and the default local PostgreSQL port 5439 was
not listening. Before release, start against the configured database, verify
the additive schema, and save/reload/clear planned dates through the real API
under manager and assignee accounts. This remains a deployment check, not
evidence supplied by the synthetic preview or mocked route tests.
