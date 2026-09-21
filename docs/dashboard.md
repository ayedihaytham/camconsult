# Dashboard

## Purpose

The authenticated Dashboard is an operational cockpit answering: **what needs
my attention now?** It reflects real scoped data; it does not invent metrics.

Current implementation:

- Page: `app comptabole/src/pages/DashboardPage.tsx`
- Orchestration: `app comptabole/src/hooks/dashboard/useDashboardData.ts`
- Pure view-model rules: `app comptabole/src/lib/dashboard/dashboardData.ts`
- UI: `app comptabole/src/components/dashboard/`

## Structure

1. Compact navy command surface: greeting, date, role-aware quick actions and
   inline role metrics separated by a fine gold rule.
2. URL-addressable shadcn Tabs (`?tab=`) rendered as a horizontally scrollable
   ledger rail on narrow screens.
3. Tab content uses compact ledger rows, timelines and restrained tonal
   sections instead of a repeated grid of framed cards.

Admin/collaborator tabs: `Vue d'ensemble`, `À traiter`, `Échéances`, optional
admin `Équipe`, and `Activité`.

Company employee tabs: `Vue d'ensemble`, `Collectes`, `Documents`, and
`Messages` when messaging is permitted.

## Role-specific view

### Admin

- Cabinet-wide scoped bootstrap data.
- Command metrics: active clients, open tasks, overdue collection deadlines and
  unread messages when messaging is available. Actionable collection counts
  remain represented in the attention queue.
- Asymmetric Overview with a priority ledger and warm tonal task summary.
- Grouped attention queue, deadline timeline, unified team workload ledger,
  and a chronological activity ledger for recent files, messages and journal.
- Admin bordereaux contribute an unpointed attention item and aggregate values.

### Collaborateur

- Server-scoped assigned societies/tasks and accessible entities.
- Command metrics: `Mes sociétés`, own open tasks, scoped overdue collection
  deadlines and unread messages when permitted. Actionable collection counts
  remain represented in the attention queue.
- Overview, attention, deadlines and activity; no admin team or journal tab.

### `societe_employe`

- Data is limited to the company scope.
- KPIs: open collections, next deadline, accessible documents and optional
  unread messages.
- Client overview plus open collections, documents and optional messages.
- No cabinet team/admin content or pending-society attention.

## KPI definitions

- Active clients: societies where `statut === "actif"` (admin).
- My societies: count of societies already scoped to the collaborator.
- Collections to process: `transmis`, `a_corriger`, or overdue and not closed.
- Open collections: not `valide` and not `archive`.
- Open tasks: `a_faire + en_cours`; collaborator task input is server-scoped.
- Unread messages: sum of `conversation.nonLus`; supporting count is the number
  of conversations with unread messages.
- Next deadline: earliest non-closed collection deadline at/after today; if none
  is upcoming, the first sorted past deadline is used.
- Documents: nodes with `type === "fichier"`; monthly support count uses
  `creeLe` in the current calendar month.
- Monthly society/task support counts use `creeLe` in the current calendar month.

## Attention logic

Items are derived from real collections, conversations, notifications, societies
and (admin-only) bordereaux.

1. `urgent`: overdue collections, then `a_corriger` collections.
2. `review`: `transmis` collections, then pending societies (not company users).
3. `communication`: conversations with `nonLus > 0`, when messaging is allowed.
4. `other`: unread non-message/non-collection notifications and one admin
   aggregate for unpointed bordereaux.

Groups use that order; items within a group sort by their source date ascending.

## Deadline logic

Only collections with `echeance` and a status other than `valide`/`archive` are
included. Date-only values are compared at local start-of-day and sorted by days
from today, then society name.

- `< 0`: overdue
- `0`: today
- `1..7`: this week
- `> 7`: later

Tasks have no deadline field and must not be used as fake deadline data.

## Current summaries

- Task status: proportional segmented bar and counts for `a_faire`, `en_cours`,
  `termine` from scoped tasks, plus the next real collection deadline when one
  exists.
- Team workload (admin only): one row per collaborator with a relative Progress
  bar normalized to the largest current visible workload. It is not a capacity
  target or performance score.

These are CSS/shadcn Progress-based summaries with visible text values; the
Dashboard does not currently render the shared `RadialBarChart`. Collection
status counts remain in the view model for role-aware data continuity but are
not duplicated as a standalone Overview or deadline chart.

## Data sources and performance

`useDashboardData()` combines scoped `useData` bootstrap selectors with one
collection-list fetch. Admin also loads the existing bordereaux and journal list
endpoints together. `buildDashboardData()` memoizes and derives the complete view
model. There is no dashboard summary endpoint.

No per-society request is made. Preserve that property: never introduce an N+1
loop to aggregate Dashboard data.
