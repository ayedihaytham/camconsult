# Final candidate — Daily Workspace

Design refinement only, prepared 1 October 2026. Demo records remain pinned to
**30 September 2026**, so initial and final B use the same structural data.
No production code, backend, permissions or existing product documentation changed.

`direction-b-final.html` is built directly from `direction-b.html`. It preserves
B’s daily identity, navy/gold/warm-paper language, operational rows and work-first
composition. A and C remain references, not replacement architectures.

## Final work desk

The page answers **“What should I work on now?”** Compact greeting/date, integrated
navigation metrics and role-aware scope lead into Reprendre. Collection
transmissions, remaining in-progress work and tasks to begin follow. Corrections
and communication are secondary. Tâches, À traiter, Échéances, admin Équipe and
Activité remain separate keyboard-operable views.

Reprendre uses a real `en_cours` task: title, society, state, assigned employee
for admin, and destination `/taches`. No “last worked” claim or invented priority.
Remaining in-progress rows exclude that same task to avoid duplication. The
fixture’s first task is an example, not a recommendation algorithm; production
should choose an explicit stable order.

The date strip sits inside **Transmissions de collecte** and filters collection
deadlines only. It never filters/schedules tasks. Empty days still show the next
dates. A transmitted collection says **Déjà transmis · à examiner**, rather than
pretending its transmission is still awaited. Validated/archived collections are
excluded, following the existing source rules.

## Adopted from A / C

- A: semantic attention groups — Échéances dépassées, Corrections, À examiner,
  Communication, Autres éléments. No urgency scoring. Attention stays secondary.
- C: compact navigable admin metrics. No large management rail or executive
  analytics. A small secondary link opens task-count distribution.

## Roles

**Collaborator is the reference version:** Reprendre mon travail, assigned
tasks and collections within accessible societies. No cabinet switch, team,
journal or admin shortcut. Production must preserve accessible company-origin
tasks and their read-only semantics instead of claiming they are personal assigned
work or discarding them.

**Admin:** Tout le cabinet / Collaborateur, then employee selection, filters
assigned tasks and followed societies. It does not impersonate that employee.
Account identity, greeting, messages and unread counts stay those of the admin.
Équipe shows only À faire, En cours, Terminées and Ouvertes; no performance scores.

The separate company-employee Dashboard remains outside this internal-workspace
artifact. `responsable_collaborateurs` must retain its current effective Dashboard
role and scope; it is not implicitly promoted to admin.

## Mobile

DOM and keyboard order: compact context → Reprendre → Today/transmission strip
→ remaining in-progress tasks → tasks to begin → corrections → communication
→ small admin summary. The desktop supporting rail becomes a compact ledger
after the work. Only date/tab rails scroll horizontally. No squeezed desktop
table, task dates or page-level scroller.

Product controls retain 44px targets, labels, visible gold focus, text statuses
and reduced-motion support. Mobile Aide stays in the topbar; Actions is beside
scope. Desktop help is in the footer and covers no content.

## Representative states

Use the external scenario selector to demonstrate:

- Data complete.
- Nothing to resume: no `en_cours` task; tasks to begin remain available.
- No deadline today: upcoming dates remain visible.
- No open task: completed tasks remain accessible from Tâches → Terminées.
- No unread message: explicit quiet empty state and messaging destination.
- Scope with no open work.
- Loading: announced skeletons, unknown metric values; no verified zeroes.
- Partial collection failure: deadline metrics are **— / unavailable**; tasks
  and messages continue working. Collection areas offer retry; attention results
  are labelled partial. Failure never looks like “Tout est à jour.”

Retry only restores the structural fixture. No API is called. Navigation shows
destination previews; no entity is created, saved, sent, archived or approved.
All records are labelled **DEMO STRUCTURAL DATA**.

## Production mapping

| Area | Existing components / data to reuse |
| --- | --- |
| Composition / roles | DashboardPage, useAuth, usePermissions |
| Greeting / metrics | DashboardHeader, current KPI and deadline derivations |
| Views / URL state | DashboardTabs, Radix/shadcn Tabs, `?tab=` |
| Reprendre / task groups | Scoped useTaches, `assigneId`, `societeId`, `statut`; dashboardData.ts |
| Transmissions | useDashboardData, useCollectes, deadline/closed-collection rules, DeadlinesTab |
| Attention | AttentionTab, AttentionList, DashboardAttentionItem and source grouping |
| Messages | useConversations, current `nonLus` and preview data |
| Team | TeamTab and task counts from dashboardData.ts |
| Bounded activity | ActivityTab, FilesActivity, MessagesActivity, admin journal input |
| Actions / status | DashboardQuickActions, existing routes/permissions, Skeleton/Button and alert patterns |
| Help | TourProvider, TourHelpButton, tourRegistry and stable data-tour convention |

No backend work is required for the visible design. Continuation, employee
filtering, next dates and remaining-task lists are local derivations of existing
scoped inputs. Preserve the current collection-list and admin journal/bordereaux
list requests. No company-detail fetch loop or new messaging store.

The existing `collectesLoading`, `collectesError`, `retryCollectes` must accompany
collection-derived counts, not disappear into an empty array. Gate bootstrap
task/message states on shared hydration. Admin journal/bordereaux failure can
gain local orchestration feedback if needed, without a new backend endpoint.
Complete historical activity, trends, capacity and large-cabinet aggregation are
outside the final design.

## Future guided-tour targets

No new tour engine is implemented. Stable anchors prepare a roughly seven-step
tour with the existing engine:

| Step | Target |
| --- | --- |
| Overview | `dashboard-summary` |
| Scope | `dashboard-scope` |
| Reprendre | `dashboard-resume` |
| Collection dates | `dashboard-deadline-strip` / `dashboard-transmissions` |
| Task statuses | `dashboard-tasks` |
| Attention | `dashboard-attention-lens` / `dashboard-attention` |
| Quick actions | `dashboard-quick-actions` on alternate visible desktop/mobile controls |

`dashboard-tabs` and `dashboard-work` retain current Dashboard navigation
anchors. `dashboard-communication` is available if needed. Skip unavailable or
hidden targets with the existing engine; wait for readiness when appropriate.
Tours never activate the highlighted business actions.

## Documentation after implementation

- `docs/dashboard.md`: composition, continuation, scope and partial-data rules.
- `DESIGN.md`, `docs/design-system.md`: adopted Daily Workspace archetype/mobile.
- `docs/data-flow.md`: only if orchestration/status ownership actually changes.
- `docs/conventions.md`: only if tour target guidance needs updating.
- `PRODUCT.md`: only if approved capabilities change, not just layout.

Existing product Markdown files are unchanged during this design refinement.
