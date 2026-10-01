# Dashboard

## Purpose

The authenticated Dashboard is the approved **Daily Workspace**, answering:
**what should I work on now?** It reflects real scoped data; it does not invent
metrics. The user-approved image **Tableau de bord comptable moderne.png**
(2026-10-01) is the visual authority for `Mon bureau` and its shared command
banner/tab bar. It supersedes the earlier `direction-b-final.html` composition.
The approved **Tableau de bord des tâches CAMCONSULT.png** (2026-10-01)
governs the dedicated `Tâches` view. Other dedicated tabs and the company-side
composition retain their existing presentation and business rules.

Current implementation:

- Page: `app comptabole/src/pages/DashboardPage.tsx`
- Orchestration: `app comptabole/src/hooks/dashboard/useDashboardData.ts`
- Pure view-model rules: `app comptabole/src/lib/dashboard/dashboardData.ts`
- UI: `app comptabole/src/components/dashboard/`
- Mon bureau presentation: `app comptabole/src/components/dashboard/mon-bureau.css`
- Tâches: `app comptabole/src/components/dashboard/tabs/TasksTab.tsx`,
  `TaskRegister.tsx` and `tasks-workspace.css` in the same Dashboard component tree
- Existing dedicated/client view styling: `app comptabole/src/components/dashboard/dashboard-polish.css`

## Structure

1. Compact navy daily identity: date at left, small greeting, workspace title,
   role-aware quick actions and partial gold rule. No internal KPI card row,
   replacement counter strip or statistics widgets: the banner flows directly
   into Dashboard navigation. Internal Admin/collaborator work is already scoped
   by the signed-in account; the restricted company Dashboard retains its existing
   scoped KPIs.
2. URL-addressable shadcn Tabs (`?tab=`), with a gold active underline and a
   scrollable rail on narrow screens.
3. `Mon bureau`: Reprendre, Transmission Ledger, À traiter, remaining
   in-progress tasks, tasks to begin, viewer-specific communication, then the
   team shortcut where authorized. On phones this is a deliberate single-column
   presentation order with separated warm surfaces; Reprendre stays prominent, the
   date ruler scrolls horizontally, and the task action follows attention.
   Desktop retains its work column and secondary rail; no desktop table is
   squeezed into phone width.

At viewport widths of 1280px and above, a single-row master grid places the
stable view column (tabs, notices and content) beside a 320px rail with a 20px
column gap. The rail begins alongside the tabs and flows independently of main
section heights. Reprendre and the
transmission register each have a separate ivory surface. The two task registers
sit side by side when the actual main-column width reaches 620px, with a nested
header/body subgrid aligning their headings and overall heights. Each task,
attention, message and team preview contains at most three items.
Below 1280px, the outer sections form one column in DOM, reading and focus order:
Reprendre, transmissions,
À traiter, in-progress tasks, tasks to begin, messages, then the admin team
preview. The existing media-query hook in `DashboardTabs` selects one composition, mounting each
section once. The dossier CTA and selected/upcoming collection details can still
split internally when the actual available page width reaches 620px. Phone
layouts use a full-width Reprendre CTA; only the ruler and tabs scroll locally.
Main surfaces use an 18px inset and 16px section gap; rail surfaces use a 16px
inset. Below 640px both insets become 14px and section gaps become 12px.
Corners are restrained (4px surfaces, 6px command banner). The transmission
header uses a 40px marker column and 24px identity gap; the compact dossier uses
36px/28px to retain the same text anchor. Both reduce to 32px/12px on phones.
Internal detail/row spacing reuses 12px/8px tokens.
The command banner has 14px top and 18px bottom padding, a fine partial gold
rule and permission-aware quick actions. Existing Playfair Display is used
selectively for its title/date numeral/quick action, dossier heading/title/CTA,
Mon bureau section headings and transmission-detail headings. Inter remains the
working font for rows, metadata, ruler dates, counts, tabs and badges. This narrow
editorial exception does not change dedicated tab or other page typography;
no font or dependency is added. Dedicated task and attention views retain their
full loaded lists.
Mon bureau uses a warmer scoped canvas and ivory surfaces, with a stronger
gold-tinted dossier and paper-stack detail. Its main headings are 20px (rail
17.5px, phone 17px), transmission heading 22px (phone 18px), and dossier
heading/title 18px/22px (phone 16px/19px). The overview command title/date
numeral are 31px/40px (phone 24px/33px); dedicated views retain their existing
command scale. Task row titles/metadata use 15.5px/13px, context initials use
38px circles and task headings use 32px icon blocks. Phone navigation retains 44px targets.
The `À traiter` preview shows loaded counts for overdue, corrections, review and
other actionable items, then uses up to three rows selected across the highest
priority represented groups. Partial-source states suppress the summary counts;
`Tout voir` opens the complete attention view. Compact preview rows show an
absolute source date, circular source icon and semantic left rule; the complete
attention view retains its existing presentation.

Admin/collaborator tabs: `Mon bureau`, `Tâches`, `À traiter`, `Échéances`, optional
admin `Équipe`, and `Activité`. `overview` remains the default URL tab key.

Company employee tabs: `Vue d'ensemble`, `Collectes`, `Documents`, and
`Messages` when messaging is permitted.

## Dedicated Tâches view

`/?tab=tasks` starts directly with compact `Ouvertes` / `Terminées` controls,
the full accessible-work summary, an optional active dossier and complete task
registers. The page-level heading, subtitle, search input and filter control
were removed by design. The tabs switch only the loaded `taskRows` /
`otherTaskRows`; there are no search/filter requests or duplicate domain state.

Open, completed, in-progress and todo counts cover all loaded accessible tasks,
including `otherTaskRows`, independently of the selected lens.
The open lens separates `En cours` and `À faire`; the completed lens uses the
same ledger for `Tâches terminées`. Registers render every matching real row,
without the reference image's four-row sample limit or an overview preview cap.

In the open lens, the dossier selects the first `en_cours` row from
`taskRows`, preserving the deterministic order of `majLe` descending,
`creeLe` descending, then ID ascending. These are personal assigned rows for a
collaborator and authorized cabinet rows for Admin. It does not imply priority
or last-worked history. Reprendre, row links and Tout voir all open `/taches`.
`Autres tâches accessibles` remains separate when matching rows exist; company-
origin rows explicitly retain **Tâche de société (lecture seule au cabinet)**.
Task dates, deadlines and percentage progress are not invented.

The scoped styling keeps the command and task headings in the working sans,
with warm paper registers, blue in-progress badges/initials, warm neutral todo
and count treatments, and green completed states. Desktop initials are 28px
circles. At 900px and below, column headers disappear and company/assignee
metadata stacks under the title; initials shrink to 22px. Below 640px the status
also stacks, controls reach 44px and the dossier CTA spans its surface. Surface
insets are 20px, then 16px at 900px and 14px below 640px, with 12px gaps and
5px corners. These local tokens and rules do not change Mon bureau.

## Role-specific view

### Admin

- Cabinet-wide scoped bootstrap data.
- Derived counts: active clients, open tasks, overdue collection deadlines and
  unread messages when messaging is available. Actionable collection counts
  remain represented in the attention queue.
- Work-first overview with Reprendre and collection transmissions.
- Admin sees cabinet-wide data already authorized for the signed-in account.
  The Dashboard no longer exposes a collaborator scope switch. Messages and
  notifications remain viewer-specific; the bounded journal remains cabinet context.
- Grouped attention, collection deadlines, alphabetical team task counts,
  and bounded activity for recent files, messages and journal.
- Admin bordereaux contribute an unpointed attention item and aggregate values.
  The cabinet aggregate remains an Admin-only item.

### Collaborateur

- Server-scoped assigned societies/tasks and accessible entities.
- Derived counts: `Mes sociétés`, own open tasks, scoped overdue collection
  deadlines and unread messages when permitted. Actionable collection counts
  remain represented in the attention queue.
- Personal assigned work leads the overview. Other accessible tasks (including
  company-origin tasks, read-only for the cabinet) remain in `Tâches` under
  `Autres tâches accessibles`; they are not labelled personal work.
- Bureau, tasks, attention, deadlines and activity; no cabinet scope switch,
  admin team or journal tab. `responsable_collaborateurs` keeps this Dashboard
  role even when its server-authorized company/task scope is broader.

### `societe_employe`

- Data is limited to the company scope.
- KPIs: open collections, next deadline, accessible documents and optional
  unread messages.
- Client overview plus open collections, documents and optional messages.
- No cabinet team/admin content or pending-society attention.

## Derived counts and company KPIs

Counts remain in the view-model for other Dashboard views and the company-side
header. Removing the internal KPI presentation does not remove its data or requests.

- Active clients: societies where `statut === "actif"` (admin).
- My societies: count of societies already scoped to the collaborator.
- Collections to process: `transmis`, `a_corriger`, or overdue and not closed.
- Open collections: not `valide` and not `archive`.
- Open tasks: `a_faire + en_cours`; collaborators count tasks assigned to their
  own employee ID. Admin counts the cabinet-wide authorized work.
- Unread messages: sum of `conversation.nonLus`; supporting count is the number
  of conversations with unread messages.
- Next deadline: earliest non-closed collection deadline at/after today; if none
  is upcoming, the first sorted past deadline is used.
- Documents: nodes with `type === "fichier"`; monthly support count uses
  `creeLe` in the current calendar month.
- Monthly society/task support counts use `creeLe` in the current calendar month.

Navigation remains available through existing tabs, quick actions and work links.
The Transmission Ledger links to `/?tab=deadlines`. Unknown collection-derived
values stay unavailable/loading; no overdue summary is shown before successful loading.

## Attention logic

Items are derived from real collections, conversations, notifications, societies
and (admin-only) bordereaux.

1. `urgent`: overdue collections, then `a_corriger` collections.
2. `review`: `transmis` collections, then pending societies (not company users).
3. `communication`: conversations with `nonLus > 0`, when messaging is allowed.
4. `other`: unread non-message/non-collection notifications and one admin
   aggregate for unpointed bordereaux.

Groups use that order; items within a group sort by their source date ascending.
The UI separates `urgent` into **Échéances dépassées** and **Corrections**, followed
by **À examiner**, **Communication** and **Autres éléments**. Search and type
filters are local. The compact overview places À traiter before task previews on
phones; urgency remains semantic and is not scored.

## Deadline logic

Only collections with `echeance` and a status other than `valide`/`archive` are
included. Date-only values are compared at local start-of-day and sorted by days
from today, then society name.

- `< 0`: overdue
- `0`: today
- `1..7`: this week
- `> 7`: later

Tasks have no deadline field and must not be used as fake deadline data.

## Continuation and transmissions

- Reprendre selects the first assigned `en_cours` task after sorting `majLe`
  descending, `creeLe` descending, then ID ascending. It opens `/taches` and
  makes no last-worked or priority claim. The remaining in-progress preview
  excludes that task. `Tâches` retains all rows and a completed-work lens, with
  open/completed counts derived from all loaded accessible tasks.
  The ivory dossier pairs a folder marker with real task status/title/company
  and, for Admin, assignee. Neutral continuation copy makes no recency claim.
  The wide dossier's right-hand action area occupies 33% (at least 180px), with
  a stretched divider and 20px inset. The dossier uses 16px vertical padding,
  a 36px folder block and a bottom-aligned helper/156px-wide, 40px-high CTA.
  CSS sheet faces, sand-toned layered edges, fine rules and soft shadows decorate
  the CTA area's lower-right corner behind its content; phones show a quieter,
  lower-clipped version. Phones use 14px vertical padding and a full-width, 44px-high CTA below
  the task; compact layouts retain the side split only when the page is wide enough.
- The seven-day Transmission Ledger initially starts at the actual local day and filters
  collection `echeance` only. A continuous deadline ruler, date ticks and a short
  gold selected-date mark replace boxed day cells. Today has a stronger date and
  month anchor; days with collections show an explicit count and marker. The
  ruler uses the main-column width on desktop and scrolls horizontally on mobile.
  Selected-day detail sits underneath. It shares a two-column detail row with
  `Prochaines transmissions` at an actual available width of 620px; otherwise
  both stack with their labels visible, including an empty upcoming panel.
  Each existing detail area uses a fine inset border, warm surface and 12px padding.
  `Prochaines transmissions` keeps
  the existing next-two preview, with strong tabular date columns and text statuses
  instead of pills. A small loaded positive overdue count may accompany the header
  link; it is not a KPI widget. The ledger's inset aligns with Reprendre and task
  headings. Previous/next controls move the presentation window by seven days
  using loaded collection deadlines and select its first day; previous is
  disabled at the window starting today. This remains local UI state: no new
  requests, calendar data or task dates are introduced. The shared six-day
  `dashboardDateStrip` helper remains unchanged; the seven-day presentation is
  owned by `CollectionTransmissions`.
  A `transmis` collection says **Déjà transmis · à examiner** rather than claiming
  its transmission is still expected. Validated/archived items are excluded.
  Rows show company first, then period and textual state on one naturally
  wrapping line beside a compact date column and navigation arrow.
- Mon bureau communication shows at most three viewer-specific unread
  conversations, with initials, message preview, blue unread count and arrow.
  Rail sections use light warm surfaces and gold heading icons. Message/team
  initials sit on pale slate circles; the third unread preview uses a decorative
  navy circle without conveying priority or a person category. Unread rows share
  the rail surface, and team open counts use a readable warm ink emphasis.
- Mon bureau team (Admin only): at most three alphabetical, informational
  collaborator rows with initials and real Ouvertes, À faire and En cours counts;
  `Voir l’équipe` opens the dedicated team view. Rows do not filter work or rank people.
- Dedicated team (Admin only): alphabetical informational collaborator rows with À faire, En cours,
  Terminées and Ouvertes, rendered as a table on desktop and count rows on mobile.
  Names remain non-interactive because Dashboard collaborator filtering is not
  exposed. No relative bars, capacity,
  performance scores or employee rankings.
- Activity merges bounded recent files/messages and authorized journal entries,
  with at most 16 visible source items. It is not a complete audit history.
  The unread-message preview independently finds unread conversations so older
  unread exchanges are not hidden by the activity limit.
  Source filters sit beside the heading area. A bounded content measure connects
  event text and timestamp; mobile places the timestamp below the description.

## Loading, errors and empty states

Shared bootstrap hydration gates the page in `DataBoundary`. Collection loading
uses announced skeletons without hiding usable tasks or communication. Failed
collections are excluded from derivation even if their store retains old data;
counts are unavailable and a retry uses the same collection-list endpoint.
Attention is explicitly partial while any contributing source is loading/failed.
Admin journal and bordereau failures are reported and each healthy source remains
usable. A journal store error flag exposes its previously swallowed fetch failure.
Failures never appear as verified zeroes, successful emptiness or “Tout est à jour”.
True empty work, no deadline on the selected day, no tasks and no unread messages
have distinct text states. Quick actions navigate only; they perform no mutation.

## Guided tour and accessibility

The existing engine uses the internal `dashboard:v3` configuration; the restricted
company tour remains v1. Stable targets include summary, resume,
tabs, transmissions/date strip, tasks, attention preview/lens and responsive
quick actions. The tasks anchor belongs to the boxed in-progress register so
the target remains available in the compact section order.
Missing/hidden targets are skipped by the shared engine. Existing Aide placement,
first-visit persistence and replay remain unchanged. Controls retain visible
focus, semantic status text and 44px interaction targets; tabs use Radix keyboard
navigation and only tab/date rails scroll horizontally. Existing short row
color transitions respect reduced-motion preferences.

For internal users on `/?tab=tasks` only, `TourProvider` passes the URL search
to `getPageTour`, selecting the separate `dashboard-tasks:v1` visit. Its targets
cover the workspace, open/completed controls, dossier, ongoing,
todo, completed registers and opening a row; absent targets are skipped by the
same engine. The existing Mon bureau tour remains unchanged, and company users
retain their restricted tour even when the URL contains `tab=tasks`.

## Data sources and performance

`useDashboardData()` combines scoped `useData` bootstrap selectors with one
collection-list fetch. Admin also loads the existing bordereaux and journal list
endpoints together. `buildDashboardData()` memoizes and derives the complete view
model. Scope/date changes are local and do not fetch. There is no dashboard
summary endpoint. The local day refreshes at midnight without a new request.

No per-society request is made. Preserve that property: never introduce an N+1
loop to aggregate Dashboard data.
