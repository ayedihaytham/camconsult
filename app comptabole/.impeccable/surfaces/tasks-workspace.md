# Tâches — Kanban et Gantt

Operate mode, extension of the existing authenticated Task workspace. The user explicitly chose a planning Gantt with optional planned start and finish dates. This authorizes those fields; no due date, priority, dependency or percentage progress is introduced.

## Direction contract

THESIS: Keep one task workspace with clearer Kanban cards and a genuine date-based Gantt, sharing search, filters and authorized actions.

OWN-WORLD: Preserve CamConsult navy, gold focus, warm neutral surfaces, compact working sans, fine rules and existing shadcn primitives.

STORY: The user sees work by its real status or planned period, opens authorized task edits, and schedules tasks that currently have no dates.

FIRST VIEWPORT: Existing compact task identity and search/filter tools; clear Kanban/List/Gantt switch. Kanban shows three calm columns with compact task titles, assignees and planned-date hints. Gantt shows a locally scrolling period with anchored task identity, today's marker and status-colored planned intervals. Unscheduled tasks remain findable below it. Phone Kanban uses a selected status column; List retains the existing compact renderer.

FORM: Precisely scoped extension/refinement, no new visual-world or surface concept tournament. The Gantt period uses explicit optional planning dates, never creation/update timestamps. Preserve task origin, assignment scope and forward-only collaborator transitions.

FINISH: Independent finish review disposition: ship, after the mobile out-of-period action moved into the sticky task identity and passed 375px/768px review. Shipped behavior and integration are recorded in [tasks-workspace.md](../../docs/tasks-workspace.md). Existing root DESIGN.md and its sidecar remain authoritative and unchanged for this ordinary extension. Review screenshots are ignored, labeled synthetic previews; no shipping raster was introduced. Lint, build and 20 scoped tests passed; the full suite has 852 passing/11 skipped tests and two missing-Excel-fixture suite failures. Live database schema and API persistence remain a release check because project connection configuration was unavailable and the default PostgreSQL port 5439 was not listening.

Global design files remain authoritative and unchanged. Source/schema documentation stays within this application.
