---
target: authenticated Tâches experience
total_score: 19
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:C:\\Users\\Dhib\\Documents\\GitHub\\camconsult\\app comptabole\\src\\pages\\taches\\TachesPage.tsx"
target_fingerprint: "sha256:4698c0c57fd8f673173399060d288d32f34b056c65479aae194f4851d896a6fb"
target_path: "C:\\Users\\Dhib\\Documents\\GitHub\\camconsult\\app comptabole\\src\\pages\\taches\\TachesPage.tsx"
timestamp: 2026-09-23T01-26-11Z
slug: app-comptabole-src-pages-taches-tachespage-tsx
---
# Tâches — source-only design critique

Method: dual-agent (A: taches_design_assessment · B: taches_detector_evidence). The user prohibited browser, preview, screenshots and viewport emulation. Findings below are static source inferences, not runtime visual verification.

## Design health

| # | Nielsen heuristic | Score | Source-backed limit |
|---|---|---:|---|
| 1 | Visibility of system status | 2 | Status is visible, but mutation success is premature. |
| 2 | Match to real work | 3 | Three real states and company context; date meaning is ambiguous. |
| 3 | User control | 2 | Cancel and filters exist; save failure can discard the form. |
| 4 | Consistency | 2 | Board/List/Table use different visual grammar; “Board” is English. |
| 5 | Error prevention | 2 | Delete confirmation and company validation; title trim can bypass intended minimum. |
| 6 | Recognition | 2 | Status actions hide in a low-opacity menu; titles truncate on mobile. |
| 7 | Efficiency | 2 | Search, filters, sorting, pagination and keyboard drag exist; no bulk flow. |
| 8 | Aesthetic restraint | 2 | Repeated rounded task cards and generic header dilute CamConsult identity. |
| 9 | Error recovery | 1 | Failed save can follow a false success toast and closed form. |
| 10 | Help | 1 | Little guidance for transitions or recovery. |
| **Total** | | **19/40** | **Poor, with source-only confidence limits.** |

## Design specificity and strengths

The current composition is category interchangeable: a generic three-view task workspace with real CamConsult data, rather than a task-specific Signature Ledger. The strongest existing decisions are the real three-state workflow, role-limited transitions, search across title/description/company/assignee, and the shared table renderer with a separate mobile item. Board drag includes a keyboard sensor and the menu offers a non-drag status path. Neither assessment used a browser. The deterministic detector returned `[]` (zero findings) for `TachesPage.tsx`; that does not establish component accessibility or responsive layout.

## Priority issues

1. **P1 — Save and delete feedback can mislead.** `TachesPage.tsx:88-102,224-227` starts asynchronous store actions without awaiting them; `TacheFormSheet.tsx:109-119` immediately closes the sheet. Store actions can reject (`store/data.ts:58-61,466-499`). A failed save can therefore close the draft and show success. Await mutation resolution, keep pending feedback and draft visible, then confirm success; await deletion before final dismissal.
2. **P1 — Mobile task progression is hidden.** Below 1024px the page forces Table (`kanban-board-shadcnui.tsx:106-109`), rendered as separate bordered cards (`TaskTableMobileCard.tsx:20-74`). Status changes sit in a small, faded ellipsis (`TaskActionsMenu.tsx:39-56`). Preserve the mobile Table behavior, but render a full-width ruled work item with title, company, assignee, status and the next permitted transition discoverable.
3. **P2 — The page has not joined Signature Ledger.** The header is a plain heading and description (`kanban-board-shadcnui.tsx:317-341`); the generic toolbar and card board carry the visual identity. Use a compact Work Ledger variant of the shared banner with only real, scoped task counts; keep board, list and table distinct below it.
4. **P2 — Date and status semantics need precision.** Board/List use an unlabeled clock for `termineLe ?? majLe` (`kanban-board-shadcnui.tsx:635,679-686`; `TaskListView.tsx:90-91,134-139`); mobile announces “Mise à jour” even when displaying completion (`TaskTableMobileCard.tsx:18,66-72`). Label the event accurately. `en_cours` uses the warning variant (`TaskStatusBadge.tsx:8-23`) although it is normal work, not a warning; use an informational operational treatment while keeping `a_faire` neutral and `termine` success.
5. **P2 — Form semantics and recovery need tightening.** Labels are not linked to controls and errors lack announced associations (`TacheFormSheet.tsx:121-186`). The description placeholder mentions an “échéance” despite no task due-date field (`types/index.ts:69-82`). Link labels and errors, validate after trimming title, and remove the misleading hint.

## View assessment

- **Board:** keep as a secondary status movement view. Three columns and real drag/drop clarify progression; fixed 320px columns use local horizontal scrolling (`kanban-board-shadcnui.tsx:450-490,542-546`). Cards are justified as draggable objects but are tall and visually generic. Empty column treatment is present.
- **Liste:** best candidate for the primary Work Ledger. It has grouped status sections and compact rows (`TaskListView.tsx:44-176`), but global ten-row pagination means a group count may include tasks not on the current page. Direct transition affordance and source-backed date labels would strengthen it.
- **Table:** keep for sorting/comparison. Real columns are title, company, assignee, status and updated/completed timestamp (`taskTableColumns.tsx:15-155`). Table uses the generic bounded table variant; visually differentiate its dense comparison role from Liste. Below 1024px it supplies the only mobile renderer.

## Work Ledger hierarchy and status

Make task title and current state primary; company and assignee directly visible but quieter; description summary and labeled last activity secondary; full description/edit/delete detail-only. `a_faire` is neutral, `en_cours` is active informational, and `termine` is success. These are progress states, not deadline or priority signals. Admin may change any state; collaborators may move only assigned tasks forward (`TachesPage.tsx:74-85`, mirrored server-side). No due date exists.

## Toolbar, mobile and permissions

Use one permission-gated create action, dominant search, secondary filters, a compact view switcher and quiet table tools. Show active filter context and an easy clear path; preserve existing company/status filters and admin-only assignee filter. There is no bulk selection flow today, so do not add one for visual symmetry. On phone widths, apply the documented edge-to-edge shell and 12–16px internal row padding; keep the single mobile Table mode while improving its ruled list presentation. Replace the current 56px `MobileFab` usage (`MobileFab.tsx:20-33`) with the canonical 52px `OperationalFab` for admin creation, preserving accessible name and safe-area placement. The `/taches` route is protected by `RequireEquipe` (`App.tsx:221-229`); client employees do not enter it. Task/company/assignee information comes from scoped bootstrap state and existing maps, so proposed banner counts and context need no per-company fetch.

## Personas and limits

- **Power user:** repeated status work takes menu selections in Liste/Table; the board provides faster direct movement but view state resets on remount.
- **Keyboard/screen-reader user:** board has a keyboard drag sensor and menu fallback, but unlinked form labels/errors and unannounced pending state weaken the flow.
- **Mobile user:** a named FAB is available to admin, but one-line title truncation and card-per-task layout slow scanning; the small ellipsis hides permitted progression.

The loading fallback is generic (`App.tsx:116-122`); no view-specific task skeleton exists. Empty messages distinguish no tasks from filtered-out tasks (`kanban-board-shadcnui.tsx:282-284`), but the latter offers no direct filter reset. Responsive and contrast conclusions remain static inferences because live preview was prohibited.

## Questions for later design choice

Should Liste be the default desktop work queue while Board remains the movement view and Table the comparison view? Should the allowed next status transition become directly visible in the mobile work item? Which filtered counts are meaningful enough for a Work Ledger banner without repeating the status group headers?
