---
target: Collecte de pièces detail page
total_score: 18
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 4
target_identity: "file:C:\\Users\\Dhib\\Documents\\GitHub\\camconsult\\app comptabole\\src\\pages\\collectes\\CollecteEditorPage.tsx"
target_fingerprint: "sha256:b3ce01e4a10c0620670c313407e4b98e09ba6827b9b6aae664343c8be2a6c61f"
target_path: "C:\\Users\\Dhib\\Documents\\GitHub\\camconsult\\app comptabole\\src\\pages\\collectes\\CollecteEditorPage.tsx"
timestamp: 2026-09-25T12-20-27Z
slug: rc-pages-collectes-collecteeditorpage-tsx-6a2ba1f6
closed: true
---
# Collecte de pièces detail — source-only critique

Method: dual-agent (A: collecte_detail_design · B: collecte_detail_evidence). Operate mode; no browser or runtime inspection.

## Design health (provisional, source-based)

| Nielsen heuristic | Score /4 | Main evidence |
|---|---:|---|
| System status | 2 | Real status/deadline appear, but saves and transitions lack persistent progress feedback. |
| Real-world match | 3 | Société, période, checklist, tableau, Récap and document concepts are domain-accurate. |
| Control and freedom | 1 | Switching sections can lose unsaved tableau edits. |
| Consistency | 2 | Detail composition differs from approved Process Ledger list. |
| Error prevention | 1 | Async dialogs close before success; dirty edits are unguarded. |
| Recognition | 2 | Section labels are visible, but header presents many peer actions. |
| Efficiency | 2 | Direct section navigation works; repeated utility buttons crowd work. |
| Minimalism | 2 | Heavy table header, repeated status text and comment input chrome add noise. |
| Error recovery | 1 | Failed comment/history/upload actions lack local recovery states. |
| Help | 2 | State notices explain some workflow steps, but not save/exit consequences. |
| **Total** | **18/40** | **Poor; static assessment, not a rendered-page score.** |

## Executive assessment

Keep the real role-aware workflow, status/deadline context, derived checklist, Récap requests and section navigation. The visual composition is disconnected from the approved Process Ledger list: `LedgerPageHeader` visually hides the page title and description; Topbar breadcrumb truncates context; actions fill one wrapping cluster; a rounded shadowed section card and full navy table heads replace the list's Signature Ledger / warm work surface / fine-rule grammar. The list's monogram, société-period pair, status/deadline and next-action hierarchy should carry into a compact detail identity, not a copied register table.

## High-priority UX findings

1. **P1 — Protect tableau work.** `CollecteGrid` holds local dirty rows and resets them when its `lignes` prop changes; the parent passes a fresh filtered array each render. Section buttons switch directly and unmount panels. Add a dirty-state guard/preserve drafts before a visual comp presumes effortless switching (`CollecteEditorPage.tsx:412-476,652-675`; `CollecteGrid.tsx:52-86`).
2. **P1 — Confirm only after server success.** `ConfirmDialog` invokes async callbacks then closes immediately. This affects validation, correction, archive, transmission and deletion; errors can arrive after the dialog disappears (`ConfirmDialog.tsx:90-96`; `CollecteEditorPage.tsx:744-810`).
3. **P1 — Resolve read-only state contradiction.** Archived rows/files are locked, but note input and Récap send/close remain available; the note endpoint accepts archived writes. The notice says the opposite. Treat this as a workflow/server rule issue distinct from the visual comp (`CollecteEditorPage.tsx:390-395,678-683`; `RecapTab.tsx:133-170,206-225`; `server/routes/collectes.js:461-470,508-543`).
4. **P1 — Recompose mobile work.** Below `lg`, the full section card stacks above content. Checklist, Récap and tableaux keep wide scrollable tables. Define a compact section chooser and domain-specific checklist rows, while retaining a scrollable financial grid only where column relationships demand it (`CollecteEditorPage.tsx:412-555`; `RecapTab.tsx:93-185`; `CollecteGrid.tsx:108-125`).
5. **P2 — Rebalance identity and actions.** Surface société and période visibly in a compact Process Detail identity, with status, deadline and one role/status-appropriate next action. Put full-collection export, preview and configuration in quieter utilities; keep section-specific Excel/PDF/print with that section. Archive is consequential and confirmed, but is neither a gold semantic state nor inherently destructive (`CollecteEditorPage.tsx:214-365,881-925`).

## Workflow / state

Actual statuses: `brouillon`, `transmis`, `a_corriger`, `valide`, `archive`. Admin configures, validates, corrects, archives and unarchives; collaborator edits in scope, can transmit and manage per-section Récap, but cannot validate/archive; client edits draft/correction and only requested cells in a transmitted Récap. Validated is client-read-only for lines/files, while cabinet remains editable; archive locks lines/comments/files for all, except the noted notes/Récap inconsistency. Admin PATCH accepts any valid status without enforcing a transition graph; current UI is stricter. A client file endpoint can accept transmitted-state uploads when any Récap section is sent, while the frontend hides the upload action: another UI/API mismatch. Preserve backend scope checks.

## Information and action hierarchy

Context/identity (société + période) → status/deadline/workflow explanation → one next action → section navigation → active work surface → scoped utilities → content/feedback. Primary workflow depends on status and role: client/collaborator transmit; admin validates a transmitted collection; correction is an alternative. Archive and reopen are consequential secondary workflow actions with confirmation appropriate to their effect. Full Excel export, preview and tableau configuration are page utilities. Checklist/tableau Excel/PDF/print are section utilities. Manual reminder is an admin-only contextual utility. Keep the existing export capabilities.

## Left navigation

Keep Checklist, Récap, Documents, each requested tableau and cabinet-only Historique. Replace the rounded shadow-card presentation with a compact ledger rail, fine grouping rules and a clear active registration cue. Preserve document counts, missing-cell counts and Récap state, but do not rely on dots/color alone. On mobile, use an accessible section picker near the work surface rather than stacking a long desktop rail above it. Current plain buttons lack aria-selected/current or tab trigger semantics (`CollecteEditorPage.tsx:412-470,826-877`).

## Checklist

The core facts are useful: piece, corresponding tableau, received state, date, available total, comment and received count. Make piece and direct tableau navigation strongest; status/date/total secondary. `Reçu` currently means that at least one saved line exists, not that a physical document was uploaded; the date is `transmisLe ?? majLe`, not a dedicated receipt timestamp (`lib/collecte/checklist.ts:25-57`). Keep wording accurate. Repeated full `En attente` and outlined empty comment Inputs add noise. A compact semantic status text/marker and an intentional comment affordance can improve scanning without losing accessibility. Preserve `recus / rows.length`; do not invent a score or SLA. Comments save on blur without pending/success/error feedback or explicit label (`CollecteEditorPage.tsx:529-550`).

## Other sections

Récap represents targeted missing-cell requests per tableau plus notes, not a general financial summary. Preserve per-tableau send/close/open behavior and client scoping; reduce duplicate notices (`RecapTab.tsx:37-55,70-91`). Documents have a useful upload/list/empty structure, but 16px icon-only controls rely on `title` and need names and touch targets (`CollecteEditorPage.tsx:564-629`). Tableaux have real derived values and explicit save; preserve them while addressing unsaved navigation and field labeling (`CollecteGrid.tsx:52-86,108-203,274-294`). Historique is actual journal entries with actor/time, loaded only when opened; keep it a quiet secondary section, with retry/error treatment rather than invented audit events (`CollecteEditorPage.tsx:97-103,688-713`).

## Reliability / data flow / accessibility

Detail is one GET; server loads sections, lines, notes and files in four parallel queries. No per-tableau GET loop. Section save returns only its lines and merges locally. Journal is a separate tab-triggered request with no catch, so failure can reject and appear as empty/stale data. File upload dialog closes after calling but not awaiting async onSubmit; parent uploads files sequentially, skipping missing data URLs, so close/success behavior can misrepresent partial failure. Shared upload copy says oversized files are saved as reference while this caller skips them. Checklist comments save on blur without awaiting or local recovery. Grid input fields and checklist comments lack associated labels; tab buttons do not announce selected state; document icon controls need explicit accessible names. These are source findings, not runtime reproductions.

## Keep / change / defer and next comp brief

**Keep:** back route, role/state model, actual status/deadline, contextual notices, section set, per-tableau Récap, exports, received count, comments, documents and journal. **Change:** visible detail identity, one next action, utility placement, quiet section rail, checklist density and mobile architecture; resolve save/confirmation/state reliability before shipping an implementation. **Defer:** new statuses, fake KPIs, new audit events, decorative charts and business-rule rewrites.

Next `/impeccable design`: depict a compact CamConsult Process Detail Ledger inside the existing shell, using the list family's controlled monogram, société-period identity, fine registration rule, warm work surface and semantic status/deadline grammar. Show admin validated, client correction, desktop and mobile; one contextual action; active section navigation; a readable checklist with received count, comments and section utilities. Use illustrative data only and keep existing permissions and workflow definitions.
