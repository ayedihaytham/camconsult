# Dashboard exploration — source findings and design rationale

Design artifacts only. Source inspected on 30 September 2026. All HTML records,
names, counts, dates and events are **DEMO STRUCTURAL DATA**, pinned to
30 September 2026. The artifacts do not connect to the application or an API.
They work independently, offline, without external scripts or fonts.

## Evidence inspected

- `app comptabole/src/pages/DashboardPage.tsx`: greeting, date, permission-aware
  actions and Dashboard orchestration.
- `src/components/dashboard/DashboardHeader.tsx`, `DashboardTabs.tsx`,
  `DashboardQuickActions.tsx`: metrics, role-specific tabs, current shortcuts.
- `src/components/dashboard/tabs/OverviewTab.tsx`, `ActivityTab.tsx`,
  `TeamTab.tsx`: attention summary, merged activity, real task distribution.
- `src/hooks/dashboard/useDashboardData.ts`: scoped bootstrap selectors, one
  collection list fetch; existing admin bordereaux and journal list fetches.
- `src/lib/dashboard/dashboardData.ts`: counts, deadline grouping, attention
  precedence, workload and activity derivations.
- `src/types/index.ts`: society statuses, employee assignments, task fields,
  collection fields. Tasks have no deadline or priority field.
- `src/store/collectes.ts`, `bordereaux.ts`, `journal.ts`: list API ownership.
- `server/routes/data.js`, `taches.js`: server bootstrap and task scope.
- `src/components/layout/sidebar/navigation.ts`: real module names and role
  visibility; `src/components/tour/TourHelpButton.tsx`: existing Aide integration.
- Root `PRODUCT.md`, `DESIGN.md`, `ARCHITECTURE.md`, `docs/dashboard.md`,
  `docs/design-system.md`, `docs/permissions.md`, `docs/data-flow.md`; root and
  application `AGENTS.md`. Existing documentation is unchanged.

All `src/` and `server/` references above are relative to `app comptabole/`.

## Real product rules carried into the designs

| Concept | Source-supported rule |
| --- | --- |
| Clients actifs | Admin societies with `statut === actif`. Collaborator label is Mes sociétés, counting its allowed scope. |
| Tâches ouvertes | `a_faire + en_cours`; completed tasks shown separately. No overdue task, deadline, urgency score or progress percentage. |
| Collectes | `brouillon`, `transmis`, `a_corriger`, `valide`, `archive`. Only non-closed collections contribute deadlines. |
| Attention | Overdue collection takes precedence over correction/transmission. Other real signals: pending society, unread conversation, notifications, admin unpointed bordereaux aggregate. |
| Échéances | Collection `echeance`, date-only, grouped as past / today / next 7 days / later. A past transmission deadline on a transmitted collection still follows the current source rule; it is not a task deadline. |
| Messages | Sum of the current viewer’s `nonLus`, not all messages across the cabinet. |
| Équipe | Real task assignment via `assigneId`. Counts by status, without capacity or performance claims. Admin view only in the current Dashboard. |
| Activité | Latest accessible file updates, conversation previews, and admin journal events. Not a full event history. |
| Actions rapides | Current navigation shortcuts. Creations remain in their modules; no hypothetical create permission is exposed. |
| Aide | Existing shared guided-tour subsystem. The prototype help explains the proposal; production would reuse the existing engine and target anchors. |

The attention designs add open task rows to the currently collection/message/
notification-based queue. This is a proposed inexpensive derivation from already
loaded tasks, not an existing `DashboardAttentionItem` type. Source currently
supports each row’s title, society, assignment and status. Items are grouped by
meaning, not ranked with an invented urgency score. The prototypes omit generic
notifications from fixtures to keep representative work focused; those existing
signals would remain under “Autres éléments.”

## Roles and scope

- **Admin:** cabinet-wide societies/tasks/collections; own unread conversations;
  team distribution and journal available. “Tout le cabinet / [collaborator]” is
  a proposed local filter of dossiers and assigned tasks, not a permission change.
  Messages remain personal even when a collaborator filter is selected.
- **Internal collaborator:** only accessible societies and assigned work in the
  demonstration; no cabinet switch, journal, team members or admin actions.
  Current server task visibility can also include company-origin tasks in
  accessible societies (`tachesVisibles`); implementation must preserve that
  distinction. “Mon travail” must explicitly filter `assigneId`, while broader
  accessible company work should retain its source and read-only semantics.
- **Company employee:** materially different current Dashboard: collection,
  document and permitted messaging views, without cabinet team/journal data.
  Intentionally not included in these internal command-center comps. Its client
  workspace should remain a separate role composition if a direction is chosen.
- Source also has `responsable_collaborateurs`. The current Dashboard model maps
  internal non-admin employees to `collaborateur`; team managers may receive
  wider server scope but do not automatically gain the admin Team/Journal tab.
  A future implementation must keep that behavior rather than equating them to
  admin based on their available task data.

Demo: 7 societies (6 active, 1 pending), 12 tasks (4 to do, 4 in progress,
4 completed), 6 open collections, 2 past deadlines. Lina has 3 societies and
5 assigned tasks (2 to do, 1 in progress, 2 completed). Unread messages: admin
5 in 2 conversations; Lina 3 in 2 conversations. Counts are derived from
fixtures instead of independently invented metric labels.

## Three different information architectures

### A — Command Center

Dominant grouped action ledger. Personal greeting stays secondary. Four compact
navigable metrics lead into an attention surface; Today and upcoming transmissions
are supporting context. Open tasks follow rather than displacing deadline and
correction signals. The complete attention view unifies tasks and communication.

Mobile replaces the desktop rail with compact rows: attention first, then Today
and upcoming deadlines, then ongoing work. No desktop table is squeezed into a
phone. Trade-off: many kinds of work need explicit group labels and restrained
filters to avoid turning a queue into another inbox.

### B — Daily Workspace

A date-led daily docket. “Reprendre” leads, then expected transmissions, work in
progress, and tasks to begin. A six-day strip only selects real collection dates;
it never schedules tasks. Corrections and unread communication live alongside the
work, while admin can view cabinet work or filter by collaborator. Default demo
role is Lina to demonstrate this direction’s personal emphasis.

Mobile uses ordered work bands and a compact horizontally scrollable day strip;
messages and corrective follow-up come after the daily work. Trade-off: corrections
are secondary to continuation, so their existence must remain visible in the
summary and À traiter lens. Tasks displayed under the daily workspace retain
status-based grouping and are not promised as “due today.”

### C — Hybrid Command Ledger

Compact management metrics inside the navy command banner. A dense attention
register fills the main column, while Today and upcoming transmission dates form
a secondary working rail. Latest changes and unscored team distribution close
the first overview. This permits oversight and action in the same workspace.

Mobile recomposes the register into action rows; Today comes next, then changes
and personal/admin workload. The desktop workload rail is suppressed where it
would duplicate the lower summary. Trade-off: more sections to scan than A or B;
implementation needs disciplined limits rather than unlimited preview lists.

## Feature feasibility and performance

| Proposed feature | A | B | C | Data / cost |
| --- | --- | --- | --- | --- |
| Unified queue including tasks | Main | Separate lens | Register + lens | Existing task/collection/conversation inputs. Extend pure view model; no request. |
| Today and collection date groups | Supporting rail | Main daily docket | Supporting rail | Existing deadlines; inexpensive date filtering. |
| Assigned-work / collaborator filter | Available | Central | Available | Existing `assigneId` and `societesAssignees`. Admin-only wider scope; local filtering. |
| Navigable metrics | Separate strip | Compact summary / messages | Banner strip | Existing KPI data plus overdue count; navigation only. |
| Recent source activity | Dedicated lens | Dedicated lens | Overview preview + lens | Existing bounded source arrays; local chronological merge. No additional fetch. |
| Task distribution | Dedicated lens | Dedicated lens | Overview preview + lens | Existing tasks; count map by employee/status. No capacity model. |
| Quick actions / guided help | Shared entry | Shared entry | Shared entry | Existing navigation, permissions and tour engine. No new subsystem. |
| Complete unified historical feed | Not proposed | Not proposed | Not proposed | Needs one scoped, cursor-paginated aggregate endpoint if later requested. Current source lists are snapshots and admin journal is bounded. |
| Very large cabinet summary | Not required | Not required | Not required | May eventually justify one scoped aggregate endpoint; no endpoint needed for the current dataset. |

**Ready with existing data:** all visible proposals, including local task-row
extension, Today derivation, day-strip grouping, workload counts, navigation and
role-scoped filters. Preserve loading/error/retry states for collection data;
do not show a temporary zero as a verified count. The mocks focus on populated
role/state comparisons and include a searchable empty queue and empty day state.

**Requires small backend support only if added later:** a complete historical
cross-source activity feed or server aggregation for substantially larger datasets.
Neither is necessary for the designs shown.

**Should not be implemented:** per-society Dashboard detail fetches (N+1), capacity
percentages, health/productivity scores, fake trends, task deadlines, global unread
totals from a viewer-specific count, or a collaborator “Cabinet” lens that bypasses
server scope. Tours and prototype interactions never perform business actions.

## Prototype interactions and accessibility

- Role selection, desktop/390px mobile composition, keyboard-operable tabs,
  admin collaborator filter, attention search/type filters, activity source
  filters, daily date selection, destination previews and quick-action/help dialogs.
- All records are labelled demo data at the top and bottom; destination dialogs
  show their intended route and explicitly make no application request.
- Visible gold focus, native labelled fields/dialog with Escape and focus return,
  text statuses, list/table semantics and reduced-motion behavior. Product
  controls are at least 44px high; compact review controls are outside the product.
- Mobile CSS uses container queries so the built-in phone preview matches narrow
  natural layouts without browser/device emulation. No fixed content heights or
  internal table scrollers. Static checks do not claim rendered viewport QA.

## Future implementation impact — not changed now

Likely source: `DashboardPage.tsx`, DashboardHeader/Tabs/QuickActions and tab/
attention/activity/workload renderers. `dashboardData.ts` may gain typed task
attention items and filter derivations, with focused tests; `useDashboardData.ts`
keeps current scoped requests. Shared shell, routes and tour engine should be
reused, not redesigned.

Potential documentation after a direction is approved and implemented:
`docs/dashboard.md` (composition and role/data rules), `DESIGN.md` and
`docs/design-system.md` (Dashboard archetype). `docs/data-flow.md` only if data
orchestration actually changes; `PRODUCT.md` only if approved capabilities change.
No documentation edits are needed for this exploration.
