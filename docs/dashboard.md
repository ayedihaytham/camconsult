# Dashboard

## Purpose

The authenticated Dashboard is the approved **Daily Workspace**, answering:
**what should I work on now?** It reflects real scoped data; it does not invent
metrics. Its design reference is
`.impeccable/mocks/dashboard-command-exploration/direction-b-final.html`.

Current implementation:

- Page: `app comptabole/src/pages/DashboardPage.tsx`
- Orchestration: `app comptabole/src/hooks/dashboard/useDashboardData.ts`
- Pure view-model rules: `app comptabole/src/lib/dashboard/dashboardData.ts`
- UI: `app comptabole/src/components/dashboard/`

## Structure

1. Compact navy daily identity: small greeting, date, sans workspace title,
   role-aware quick actions and partial gold rule. No internal KPI card row,
   replacement counter strip or statistics widgets: the banner flows directly
   into Dashboard navigation. Internal Admin/collaborator work is already scoped
   by the signed-in account; the restricted company Dashboard retains its existing
   scoped KPIs.
2. URL-addressable shadcn Tabs (`?tab=`), with a scrollable rail on narrow screens.
3. `Mon bureau`: Reprendre, Transmission Ledger, À traiter, remaining
   in-progress tasks, tasks to begin, viewer-specific communication, then the
   team shortcut where authorized. On phones this is a deliberate single-column
   presentation order with separated warm surfaces; Reprendre stays prominent, the
   date ruler scrolls horizontally, and the task action follows attention.
   Desktop retains its work column and secondary rail; no desktop table is
   squeezed into phone width.

On large desktop, the overview keeps its work column beside an independently
flowing secondary rail; rail content does not set the vertical positions of work
sections. Below the wide two-column breakpoint, the presentation order becomes Reprendre,
transmissions, À traiter, in-progress tasks, tasks to begin, messages, then the
team shortcut. Each phone section has a quiet warm surface and consistent
gutter; the deadline ruler and Dashboard tabs scroll horizontally when needed.
Reprendre keeps its restrained gold marker. Major sections use clear headings;
subsections and rows use lighter rules. The desktop rail is 320px where space
permits, with roughly three items per work/attention/message preview. Dedicated
task and attention views retain their full loaded lists.
The `À traiter` preview shows loaded counts for overdue, corrections, review and
other actionable items, then uses up to three rows selected across the highest
priority represented groups. Partial-source states suppress the summary counts;
`Voir tout` opens the complete attention view.

Admin/collaborator tabs: `Mon bureau`, `Tâches`, `À traiter`, `Échéances`, optional
admin `Équipe`, and `Activité`. `overview` remains the default URL tab key.

Company employee tabs: `Vue d'ensemble`, `Collectes`, `Documents`, and
`Messages` when messaging is permitted.

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
- The six-day Transmission Ledger starts at the actual local day and filters
  collection `echeance` only. A continuous deadline ruler, date ticks and a short
  gold selected-date mark replace boxed day cells. Today has a stronger date and
  month anchor; days with collections show an explicit count and marker. The
  ruler uses the main-column width on desktop and scrolls horizontally on mobile.
  Selected-day detail sits directly underneath. `Prochaines transmissions` keeps
  the existing next-two preview, with strong tabular date columns and text statuses
  instead of pills. A small loaded positive overdue count may accompany the header
  link; it is not a KPI widget. The ledger's inset aligns with Reprendre and task
  headings. No week-navigation requests, new calendar or task dates are introduced.
  A `transmis` collection says **Déjà transmis · à examiner** rather than claiming
  its transmission is still expected. Validated/archived items are excluded.
- Team (Admin only): alphabetical informational collaborator rows with À faire, En cours,
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

The existing engine uses the internal `dashboard:v2` configuration; the restricted
company tour remains v1. Stable targets include summary, resume,
transmissions/date strip, tasks, attention lens and responsive quick actions.
Missing/hidden targets are skipped by the shared engine. Existing Aide placement,
first-visit persistence and replay remain unchanged. Controls retain visible
focus, semantic status text and 44px interaction targets; tabs use Radix keyboard
navigation and only tab/date rails scroll horizontally. No motion is added.

## Data sources and performance

`useDashboardData()` combines scoped `useData` bootstrap selectors with one
collection-list fetch. Admin also loads the existing bordereaux and journal list
endpoints together. `buildDashboardData()` memoizes and derives the complete view
model. Scope/date changes are local and do not fetch. There is no dashboard
summary endpoint. The local day refreshes at midnight without a new request.

No per-society request is made. Preserve that property: never introduce an N+1
loop to aggregate Dashboard data.
