# Admin Dashboard

This document describes the Admin-only Dashboard replacement. It supersedes the
older Admin Mon bureau, Tâches and deadline-list composition described in
[Dashboard](../../docs/dashboard.md) and the Dashboard examples in
[Design System](../../docs/design-system.md). Those documents remain authoritative
for shared derivation, permissions and unchanged collaborator/company views.
[PRODUCT.md](../../PRODUCT.md) and [DESIGN.md](../../DESIGN.md) retain global
product and brand authority; this is a composition change within CamConsult.

## Overview and selected day

[AdminOverviewTab](../src/components/dashboard/tabs/AdminOverviewTab.tsx) gives
collections, tasks, deadlines and permitted unread messages bounded places in
the first view. A compact navy command header and the existing six tabs precede
a joined summary, boxed day selector and four-part briefing. Team and activity
remain in their dedicated tabs rather than overview previews.

- Summary links show transmitted collections to examine, open tasks, collection
  deadlines on the selected day and viewer-specific unread messages.
- [DashboardWeekSelector](../src/components/dashboard/DashboardWeekSelector.tsx)
  starts at the actual local day and shows seven consecutive boxed dates. Today
  is initially selected. Previous/next moves the window by seven days and
  selects its first day; Aujourd’hui restores the current day.
- Selecting a date updates the collection preview, day deadline count and next
  two deadlines after that date, using real collection `echeance` values through
  `transmissionRows`. The selected-date caption makes this scope explicit.
- Task and message queues, transmitted-collection summary and overdue count
  remain current. Tasks have no deadline field; changing the date does not
  imply historical task or message data.
- Work previews show in-progress tasks before tasks to begin. Collection,
  task and message previews contain at most three rows on desktop; the upcoming
  deadline preview contains at most two. Below 640px, each briefing panel shows
  its first row, with a link to the complete workspace or tab.

Collection loading and errors show unavailable counts and distinct messages.
Successful emptiness is separate. Existing retry notices remain outside the
overview, and healthy tasks/messages remain usable during collection failures.
The message panel and summary require `canUseMessaging`.

## Dedicated tabs

- **Tâches:** [AdminTasksTab](../src/components/dashboard/tabs/AdminTasksTab.tsx)
  offers local search across title, company and assignee, with Ouvertes, En
  cours, À faire and Terminées lenses. Counts cover all loaded accessible tasks
  independently of search. Existing `TaskRegister` renders complete matching
  lists, keeping other accessible tasks separate and company-origin read-only
  labels intact. Links open `/taches`; no preview cap applies here.
- **À traiter:** existing attention sources, priority groups, local search,
  filters and partial-source handling are reused. Only the Admin presentation
  changes; no priority score or new data source is introduced.
- **Échéances:** [DeadlineCalendar](../src/components/dashboard/deadlines/DeadlineCalendar.tsx)
  replaces the Admin deadline list with a Monday-first, six-week monthly grid
  and selected-day detail. Only non-validated/non-archived collections with
  actual deadlines appear. The calendar starts on today, supports month
  navigation and Aujourd’hui, and offers next-deadline/overdue shortcuts.
  Clicking a date shows all its collections; collection links open their
  existing routes. This selection is local to the mounted calendar, separate
  from the overview selector.
- **Équipe:** [TeamTab](../src/components/dashboard/tabs/TeamTab.tsx) keeps the
  alphabetical derived list and real À faire, En cours, Terminées and Ouvertes
  counts. Name search filters locally; the summary still covers all loaded
  members/work. Names remain informational. No capacity, performance ranking
  or collaborator scope switch is introduced.
- **Activité:** the existing bounded recent-file/message/journal merge and
  source filters remain. It is not a complete audit history.

## Presentation and accessibility

[admin-dashboard.css](../src/components/dashboard/admin-dashboard.css) is scoped
to `.dashboard-admin`, assigned by
[DashboardPage](../src/pages/DashboardPage.tsx). The Admin working sans, navy
hierarchy, gold selection/focus cues, warm canvas, semantic status text and fine
rules reuse the incumbent system. Flat bounded surfaces use 8px corners and
16px insets/gaps, reducing to 12px on phones. Command title sizes are 23px and
19px on phones; briefing headings are 15px/14px, rows 13px, metadata 12px.
These are surface implementation values, not new global tokens.

The briefing becomes two columns at 620px of actual workspace width; narrow
views stack in reading order. The summary becomes two columns below 640px.
Only the tab rail and boxed date strip may scroll locally.
[deadline-calendar.css](../src/components/dashboard/deadlines/deadline-calendar.css)
places the selected-day panel beside the calendar at 1100px and stacks it below
at narrower widths. Phone date cells retain numbers/counts while company detail
stays in the selected-day panel.

Dates expose `aria-current="date"` for today and `aria-pressed` for selection.
The monthly grid uses one tab stop: arrows move by day/week, Home/End select
the week's bounds, and PageUp/PageDown move months while preserving the chosen
day where possible. [deadlineCalendar](../src/lib/dashboard/deadlineCalendar.ts)
uses local civil dates and clamps month changes to the destination month's last
day. Controls retain visible focus, named icons and reduced-motion handling;
phone utility controls use 44px targets. Existing Radix tab navigation remains.

The Admin tours are `dashboard-admin:v1` and `dashboard-admin-tasks:v1` in
[tourRegistry](../src/components/tour/tourRegistry.ts). Existing collaborator
and company tours remain role-specific.

## Data boundary and evidence

[useDashboardData](../src/hooks/dashboard/useDashboardData.ts) and
[dashboardData](../src/lib/dashboard/dashboardData.ts) remain the data pipeline.
No endpoint, domain store, mutation or backend authorization changes. Date,
search and lens changes use loaded scoped data without additional requests.

The shipped finish review returned **ship**, with no material fixes, against
the established DESIGN.md. Review screenshots in
[the local evidence directory](../.impeccable/review/admin-dashboard/) cover
overview, tasks, attention, deadlines, team and activity at 375, 768, 1024 and
1440px. They use a synthetic fixture preview, not a production account. No
raster assets were generated or added to the UI.

Reported implementation validation: lint passed; build passed with
`NODE_OPTIONS=--no-experimental-require-module` for the existing Node/Tailwind
configuration issue; 822 tests passed and 11 skipped. Two unrelated suites
failed because `samples/BTL EURO PETRA2026.xlsx` and
`samples/ETAT FOURNISSEURS PETRA(1).xlsx` were missing. `git diff --check` passed.
Production-account routing, source failures, role permissions and replayed
tours remain manual integration checks; fixture evidence does not verify them.

Existing documentation drift was preserved: global Dashboard prose still
describes the former Admin composition, and DESIGN.md's compact public button
description differs from the authenticated primitive's 36px navy default in
[button.tsx](../src/components/ui/button.tsx). Neither difference is promoted
into a new system rule or repaired outside this task's scope.
