# CamConsult Daily Workspace — art direction exploration

Design artifacts only. The three directions are prescribed by the user; none is
selected or approved for implementation. Existing production polish is left as
it was at the start of this exploration. No production documentation is changed.

## Product contract

Current source remains authoritative:

- `app comptabole/src/pages/DashboardPage.tsx`
- `src/components/dashboard/DashboardHeader.tsx`, `DashboardTabs.tsx`,
  `CollectionTransmissions.tsx`, `tabs/DailyWorkspaceTab.tsx`, `tabs/TasksTab.tsx`
- `src/lib/dashboard/dashboardData.ts` and `src/hooks/dashboard/useDashboardData.ts`
- `docs/dashboard.md`, `docs/permissions.md`, and the existing exploration's
  `source-findings.md`

All `src/` paths above are inside `app comptabole/`.

Each artifact retains Mon bureau, Tâches, À traiter, Échéances, Admin-only Équipe,
and Activité. This is a visual exploration of the internal Daily Workspace.
`societe_employe` intentionally remains outside the comps: its restricted client
Dashboard is a different existing role composition, not an internal workspace.
`responsable_collaborateurs` must remain in the collaborator composition rather
than gaining Admin team or journal access.

No task deadline, priority score, performance metric, trend, or historical feed
is proposed. Collection dates are `echeance` only. Reprendre chooses an existing
`en_cours` task in deterministic updated-time / ID order in the demo; production
keeps its full updated-time / creation-time / ID tie-break. Fixtures have distinct
updated times, so no unsupported "recently worked" claim is needed.

## Shared fixtures and interactions

Every name, count, event and date in the artifacts is **DEMO STRUCTURAL DATA**.
The demonstration day is 1 October 2026. Seven fictional societies, twelve tasks
and six non-closed collections produce the metrics: six active clients, eight
open tasks, five personal Admin unread messages and two overdue collections.
Lina's authorized fixture scope has three societies and three open assigned
tasks; her own conversations have three unread messages. Selecting Lina's work
as Admin keeps the Admin's five unread messages. No impersonation occurs.

- Role, Admin scope, six Dashboard views, collection-day selection, task-status
  filters, Activity source filters and a 390px mobile canvas are interactive.
- The six-day agenda includes deadlines on 1, 3 and 5 October and empty days.
  It keeps the current production range length rather than inventing a new
  calendar or week-fetch mechanism.
- External destinations show a route preview, with no fetch, save, create,
  transmission, archive or deletion. Tours are not reimplemented; future stable
  targets reuse summary, scope, resume, transmissions, tasks, attention and
  communication anchors.
- Empty-work, collection-loading and collection-error states are available in
  the artifact controls. A failed collection source never becomes an overdue
  zero or a successful all-clear state. Unaffected task/message sections remain.
- Native buttons/selects, roving tab keyboard behavior, visible gold focus,
  text statuses, 44px product targets, responsive container queries, reduced
  motion and native dialog Escape/focus return support the interaction model.
- Files are self-contained: embedded CSS, script, fixtures and simple line
  icons. No external fonts, packages, APIs or remote assets are required.

## A — Ledger Folio

**Visual authorship:** one warm working document below a navy command cap. A
continuous gold ledger margin establishes one content origin; section references
mark the working sequence. It derives its identity from cabinet working papers,
not four independently styled cards.

- **KPIs:** numeric summaries printed into the folio header; shared baseline,
  no icon chips, card shells or corner arrows.
- **Agenda:** a ruled weekly register attached to the same document margin;
  dates are ledger entries, with explicit collection counts and a small gold
  selection registration.
- **Reprendre:** the first active line with a gold bookmark on the spine;
  task/context/action share the document's main alignment.
- **Hierarchy:** indexed major entries; smaller selected-day/upcoming labels;
  quiet operational rows. Strong document rules are used only at area boundaries.
- **Secondary information:** corrections and communication are margin notes
  anchored beside related work, not a generic column of cards.
- **Mobile:** the spine survives as a narrow margin. Notes relocate after tasks,
  with metrics paired and the date register scrolling horizontally. No forced
  desktop table or fixed document width.
- **Complexity:** medium. Existing data/renderers survive, but one shared folio
  grid and responsive margin ownership would replace independent padding.
- **Trade-off:** the richest document metaphor, with more care needed to keep
  annotation widths readable between tablet and laptop breakpoints.

## B — Financial Desk

**Visual authorship:** an arranged work docket, not a literal photographed desk.
The navy task-count block establishes active work; the resume docket and dated
planning register have different shapes, scales and jobs.

- **KPIs:** an asymmetric contextual strip. Open tasks form a navy numeric block;
  clients, personal messages and overdue collections remain printed measures.
- **Agenda:** a vertical deadline ruler on desktop, with date, weekday and count
  as three aligned register fields. Selected-day detail and next dates share the
  same planning zone.
- **Reprendre:** a dominant working docket with a gold top bookmark, explicit
  ongoing state and a clear continuation action, without a beige CTA card.
- **Hierarchy:** the active dossier owns the first surface; work lists sit on
  paper with clear headings; the planner uses precise column alignment.
- **Secondary information:** attention aligns beneath planning, while personal
  communication spans the desk base instead of living in a stacked sidebar.
- **Mobile:** the docket comes first, the date ruler turns horizontal, then work,
  attention and communication. The task-count block remains a compact signature.
- **Complexity:** medium–high. One asymmetric grid and a genuinely responsive
  agenda orientation need more CSS than A; no new domain/data logic is required.
- **Trade-off:** more spatial than documentary. The two main desktop zones must
  accommodate uneven real data lengths without stretching rows.

## C — Editorial Command Sheet

**Visual authorship:** figures, sequence and typographic scale construct the page.
Full-width working bands replace widget containers. A short gold registration
and numbered section sequence connect the command header to an open paper sheet.

- **KPIs:** prominent tabular figures used as structural anchors, with open tasks
  slightly enlarged. Labels are explicit; no enclosing statistic cards.
- **Agenda:** an editorial deadline ruler across the sheet, with larger date
  figures and adjacent selected/upcoming contexts. There is no calendar grid.
- **Reprendre:** an active working headline on the first sheet band, with state
  and company information subordinate to the actual task title.
- **Hierarchy:** major horizontal bands; restrained section references; side by
  side work lists and smaller bottom notes. Few rules own large regions.
- **Secondary information:** attention and messages are the final paired note
  band, avoiding a permanent right rail.
- **Mobile:** typographic scale reduces, the reference margin narrows, and major
  bands retain the sequence current work → dates → tasks → attention → messages.
- **Complexity:** medium. Mostly CSS grid, type and shared row treatment; careful
  wrapping rules matter for long task/company names and unknown KPI values.
- **Trade-off:** the most exposed typography; there is less container chrome to
  hide inconsistent content rhythm or unclear labels.

## Alignment and feasibility

Each direction has one reusable alignment grammar: command content, metrics,
scope, tabs, headings and rows inherit a small set of page/margin coordinates.
The authenticated shell is context, not a proposed shell redesign. No permanent
visual-system commitment is written to DESIGN.md until a direction is selected.

All displayed capabilities use existing scoped data and inexpensive derivations.
No endpoint, database, permission or network change is needed for any direction.
Shared primitives would gain presentation variants after approval; the tour
engine and business derivations would remain unchanged. Large historical feeds,
capacity modeling and fabricated analytics are explicitly out of scope.

## Review

Start at `index.html`. Open each direction's **Mon bureau**, **Échéances**, and
**Mobile** links, then switch role/scope inside the comp. All six views are
available, beyond the requested one representative secondary view.

The artifacts are source/DOM checked rather than visually inspected in a live
browser. Manual review should judge desktop alignment, long names, date selection
and the mobile reading sequence before any production implementation is chosen.

`build-comps.mjs` regenerates the three self-contained HTML files. It is artifact
source only; it does not import or write application components.
