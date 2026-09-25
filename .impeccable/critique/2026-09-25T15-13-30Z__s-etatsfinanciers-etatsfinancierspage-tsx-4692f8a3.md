---
target: ÉTATS FINANCIERS module
total_score: 22
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:C:\\Users\\Dhib\\Documents\\GitHub\\camconsult\\app comptabole\\src\\pages\\etatsFinanciers\\EtatsFinanciersPage.tsx"
target_fingerprint: "sha256:0a26ad74242a9ee9b4bf51b6f2a6a20896bb27911a0166eea077db95cfad9e8c"
target_path: "C:\\Users\\Dhib\\Documents\\GitHub\\camconsult\\app comptabole\\src\\pages\\etatsFinanciers\\EtatsFinanciersPage.tsx"
timestamp: 2026-09-25T15-13-30Z
slug: s-etatsfinanciers-etatsfinancierspage-tsx-4692f8a3
closed: true
---
Method: dual-agent (A: /root/etats_financiers_design · B: /root/etats_financiers_evidence)

# États financiers — source-only critique

## Design Health Score

| # | Heuristic | Score | Key issue |
|---|---|---:|---|
| 1 | Visibility of System Status | 2/4 | Failed list/detail fetches settle into empty states. |
| 2 | Match System / Real World | 3/4 | Accounting hierarchy is real; selector metadata is mislabeled CRM data. |
| 3 | User Control and Freedom | 3/4 | Back, cancel and destructive confirmations exist; import replaces the whole balance. |
| 4 | Consistency and Standards | 2/4 | Ledger tables fit; Balance & synthèse opens a company selector and 12 views sit together. |
| 5 | Error Prevention | 2/4 | Import preview exists, but malformed numbers can become partial amounts or zero. |
| 6 | Recognition Rather Than Recall | 2/4 | Exercise context exists; financial status is absent from the selector and later mobile tabs scroll offscreen. |
| 7 | Flexibility and Efficiency | 2/4 | Account table supports sorting/pagination; society selection lacks search. |
| 8 | Aesthetic and Minimalist Design | 2/4 | Financial tables are purposeful; landing is a generic elevated company-card grid. |
| 9 | Error Recovery | 2/4 | Toasts exist, but failures can look like empty data and edits can announce success early. |
| 10 | Help and Documentation | 2/4 | Some inline descriptions exist; AFFECTAT/global-vs-company mapping needs contextual explanation. |
| **Total** | | **22/40 (55%)** | **Acceptable; improve trust and orientation before visual polish.** |

All heuristics apply to this operational accounting workflow.

## Design Specificity Verdict

**LLM assessment — partial, strongest in detail reports.** Genuine debit/credit balance lines, AFFECTAT mappings, reporting statements, exercise comparisons and reconciliation cues give the detail a CamConsult accounting identity. The landing is a generic CRM card grid whose metadata does not establish financial work status.

**Deterministic scan.** Impeccable detect returned an empty result (zero findings) for src/pages/etatsFinanciers. It did not flag the data/permission semantics below; those came from source review. No false-positive detector findings. Browser/overlay review was skipped as explicitly requested.

## Overall Impression

This is a real, mixed accounting-preparation and reporting workspace, not just a balance viewer. Its detail is more product-specific than its entry point. Preserve company → exercise → balance/report, but orient the selector toward financial work and make the 12 real views easier to navigate. Two source-level trust risks should precede UI work: malformed import values and a missing société-scope check on one mapping read.

## What's Working

- The route carries society and exercise context into the balance editor; its title names both and surfaces discrepancy and unmapped-code counts.
- Tables use tabular, right-aligned figures, statement hierarchy, totals and multi-exercise headings; the main statement label column remains sticky.
- Source defines balance as debit − credit, reverses credit-natured statement lines for display, and preserves unassigned AFFECTAT values in the raw-code synthesis.
- Society filtering and balance API endpoints use the user’s actual society scope.

## 1. Executive assessment

États financiers is an internal-team company selector. Choosing a société opens its exercise register plus a 12-view reporting workspace; an exercise opens an editable/importable account balance. The workflow is real, but the landing communicates CRM identity instead of financial work status and does not scale to a large client book. It is not a financial-readiness registry because it does not load exercise/balance data.

## 2. Financial domain model

- Société identity includes code, RNE/TVA, theme, status, contacts and record creation date. A balance is keyed by société and a free-form exercise string.
- Balance lines contain account number, label, debit, credit and AFFECTAT. Solde is derived as debit − credit, not stored. PostgreSQL fields are numeric; the client uses JavaScript numbers.
- Cabinet-wide AFFECTAT codes map to labels and reporting postes. Account-to-code mappings can be global or overridden per société.
- Supporting data includes fixed-asset movements/register, financing movements, TDRF inputs, notes and account details; these supplement rather than all derive from the base balance.
- No journal or transaction-level general-ledger model appears in this module; it stores period-level trial-balance lines.
- No month, quarter or date-range model is present. Exercise is free text and reports compare all available exercises.
- Balance and société types have no currency attribute. Main balance screens use fr-FR separators and two decimals without a currency marker. A few auxiliary note/export fields say DT; that does not establish a per-balance currency choice.

## 3. Route/workflow map

- /etats-financiers is RequireEquipe-protected and renders the société selector.
- /etats-financiers/:societeId is that société’s exercise register and reporting workspace. The local default view is Exercices; other views report across available exercises.
- /etats-financiers/:societeId/:balanceId opens one editable balance.
- /etats-financiers/:societeId/imprimer and its section route print the full workbook or one section.
- /grille-affectat is an admin-only sibling configuration route shown as Paramétrage.
- Report-view state is local, not URL/query state; it resets to Exercices on remount.

## 4. Current landing-page purpose

The page filters bootstrap societies through canSeeSociete, then displays the shared SocieteCard grid in 1/2/3 columns. Selecting a card navigates to /etats-financiers/{societeId}. This is a selector, not a financial registry: it does not show exercise count, latest balance, discrepancy, missing mappings or readiness.

Card metadata is problematic in this context. The page counts accounts whose role is societe_employe, while the shared card labels that count responsable(s) or Aucun responsable. “Client depuis” comes from societe.creeLe, a company-record creation date, not a distinct relationship-start field. Neither fact answers whether financial work is available. Keep other SocieteCard consumers out of scope; treat this as module-specific information fit.

## 5. Balance & synthèse assessment

This is a mixed workflow:

- Exercise register: create, edit metadata, delete and open. Rows show exercise, updated date and optional note; duplicate exercise names are rejected per société.
- Balance preparation: account rows with editable fields/AFFECTAT, add/remove, sorting, pagination, Excel/PDF/print.
- Import: first worksheet of XLSX/XLS/CSV; detects headers in first 10 rows; Compte is required; preview and mapping suggestions are provided. Confirming replaces all lines in that exercise.
- Reports include Bilan Actif/Passif, Etat de résultat, Flux de trésorerie, Notes, fixed-asset variations/register, SIG, TDRF, Contrôle and Synthèse AFFECTAT.
- Synthèse AFFECTAT means multi-exercise totals by raw code, including a visible no-code row and total difference; it is not generic dashboard KPIs.
- In Exercices, PDF/Excel export the workbook; in report views they export the active section. Print follows the same context. The individual editor has balance-level Excel/PDF/print.
- Reporting is read/calculation/analysis, but some supporting movement, TDRF and note sections are editable. The account balance itself is editable.

## 6. Paramétrage assessment

Paramétrage is the cabinet-wide AFFECTAT reporting map: code, label, Bilan/CPC poste and count of globally mapped accounts. Internal users can read the global grid; the page and write/rename/delete endpoints are admin-only. Company-specific account overrides are stored separately and used in company balance/import flows, not edited here.

This configuration changes how existing balance lines feed statements. Rename/merge updates matching lines globally; removing a code removes the map record while leaving the line’s text value unchanged. The UI explains this impact. Keep it within finance, but label it explicitly as the cabinet-wide Grille AFFECTAT.

## 7. High-priority UX findings

1. **[P1] Import parsing can silently alter amounts.** The parser strips whitespace, replaces one comma, then uses parseFloat. A formatted value like 1.234,56 becomes 1.234.56 and parses as 1.234; invalid text becomes 0. A Compte-only header is accepted, absent debit/credit default to 0, and the recognized SOLDE column is unused. The preview does not flag malformed cells; confirmation replaces all existing lines. Make parsing strict and locale-aware, reject ambiguous rows, and surface validation before confirming replacement. [ImportBalanceDialog.tsx](</C:/Users/Dhib/Documents/GitHub/camconsult/app comptabole/src/pages/etatsFinanciers/ImportBalanceDialog.tsx:23>) · [balances.js](</C:/Users/Dhib/Documents/GitHub/camconsult/app comptabole/server/routes/balances.js:684>).

2. **[P1] A société-specific mapping read lacks an explicit scope check.** GET /grille-affectat?societeId=… checks only that the caller is internal; unlike balance routes it does not call canAccess before returning grille_comptes_societe. A collaborator could directly request an override for an unassigned company. Verify/fix the server boundary before designing around this data; do not rely on visible company choices. [grilleAffectat.js](</C:/Users/Dhib/Documents/GitHub/camconsult/app comptabole/server/routes/grilleAffectat.js:11>) · [balances.js](</C:/Users/Dhib/Documents/GitHub/camconsult/app comptabole/server/routes/balances.js:20>).

3. **[P2] The landing is an unsearchable CRM scan with one mislabeled fact.** “Responsable(s)” counts company-side employee accounts; “Client depuis” uses record creation date. Replace module-only metadata with exact society identity and a finance action; add search on existing name/code/RNE. Show financial readiness only if a real, permission-scoped aggregate exists—no fake KPI or per-company N+1 request.

4. **[P2] Twelve views compete in one strip and later views are hidden on mobile.** Exercices plus eleven statements/schedules/controls are one 12-choice segmented row; mobile scroll hides later choices, including Synthèse AFFECTAT. Group the existing views by task and clarify which compare all exercises versus edit one selected exercise; preserve all views and routes.

5. **[P2] Financial context and operation feedback can be hard to trust.** Main FinancialTable pins its label, but AffectatSyntheseTable pins only Code, allowing Libellé to scroll away from values. Failed list/detail requests settle into “Aucun exercice”/“Balance vide” after a toast; add/edit launches async mutations but announces success immediately. Keep both identifying columns available; distinguish load errors from true empty states and announce saves only on success. Include icon-only delete labels/touch targets in this focused pass.

## 8. Financial information hierarchy

1. Société identity and authorized scope.
2. Exercise register: exercise, updated date and note; no invented readiness state.
3. Selected balance: account, label, debit, credit, derived solde and AFFECTAT, with company/exercise in view.
4. Report: selected statement/schedule with all exercise headers; these are comparisons across available exercises, not a selected date range.
5. Actions at the correct level: import/edit at balance level; Excel/PDF/print at workbook or active-section level; admin-only global mapping clearly separate.

## 9. Grid vs register assessment

The card grid works for a handful of companies, shows name/status and supports keyboard activation; mobile becomes one column. It lacks search, filtering, sort and pagination, uses CRM metadata, and becomes a slow scan as the client book grows.

Prefer a searchable compact société selector/register using existing raison sociale, code and RNE, with status/theme only if useful. Selecting a row should continue to open that société’s exercise register. A richer financial registry requires a real scoped aggregate source and should be deferred; do not request once per company.

## 10. Table / financial report critique

- Strong: right-aligned tabular figures, account/poste hierarchy, subtotals, sticky main statement label, newest-first exercise headings, sortable/paginated account rows and internal horizontal scrollers.
- Bilan/CPC, SIG and AFFECTAT synthesis compare all loaded exercises. SIG repeats year columns across product/charge/result groups, so it is inherently wide; keep controlled table scrolling rather than stacked cards.
- AFFECTAT table keeps Code sticky but not Libellé; preserve both while scrolling.
- Server aggregates round to 3 decimals; UI displays 2 decimals; statement values under 0.005 render as an em dash and discrepancy/synthesis warnings use 0.01 thresholds. This is current behavior; confirm presentation/tolerances with accounting owners rather than changing formulas.
- Core Balance/Societe model has no currency. Main balance UI has no currency marker; some auxiliary notes/exports label DT. Do not assume a different currency model.
- Exercise is a free-form label sorted lexically descending; no month/quarter/custom period or report-level period picker exists.

## 11. Role / permission behavior

- Admin sees all sociétés and can use internal finance routes and edit the cabinet-wide AFFECTAT grid.
- Collaborateur sees only session-scoped société IDs; list/detail/aggregate/mutation routes apply server scope. Authorized internal users can import/edit/export; there is no distinct finance read-only flag in these paths.
- Internal collaborator manager passes RequireEquipe and receives all-société visibility in usePermissions.
- societe_employe is hidden from finance navigation, redirected by RequireEquipe, and rejected by balance APIs.
- Preserve this matrix. The company-specific AFFECTAT override read is the exception below.

## 12. Data isolation

Balance list, per-balance reads, aggregates and line/movement operations use canAccess; it allows admin, rejects company employees, and checks society IDs for other employees. The picker filter is not the only protection. Line mutations resolve the parent balance server-side.

Exception: internal-only GET /grille-affectat can return company-specific overrides for any requested société ID without checking collaborator scope. Treat this as a concrete source-level risk. No runtime exploit test was performed.

## 13. Mobile

Source shows a one-column landing, horizontally scrollable report controls and internally scrollable financial tables rather than stacked cards. This protects numeric comparison; the primary statement label remains sticky. AFFECTAT label does not; 12-option control has no visible all-options cue; header actions wrap; destructive controls are 26×26px; the balance line form uses a side sheet and two-column amount inputs. These are static observations only: no 375px/1440px rendering or overflow check was run.

## 14. Accessibility

Positive: company card supports Enter/Space and visible focus; tables use header cells; report control exposes selected state; import checkbox has a screen-reader-only label.

Improve: use native route links where appropriate; associate balance form labels with inputs; add explicit table captions/header scope for multi-exercise relationships; give icon-only balance-row delete an accessible name; enlarge small touch actions. Explain AFFECTAT raw code vs global poste mapping vs société override without relying on color alone.

## 15. Data flow / performance

- Landing uses scoped bootstrap data and makes no per-société finance request. Efficient, but therefore no finance readiness information.
- Opening a société fetches its exercise list. Every non-Exercices view fetches the same all-exercise /balances/postes aggregate; switching tabs refetches then clears it. Bounded repeat, not N+1.
- The endpoint uses a fixed set of société-scoped aggregate queries. Supporting movement/TDRF/notes data loads only for relevant views.
- Print workbook loads a fixed set of sources, then fetches notes once per exercise; request count grows with exercise count.
- No virtualization; account lines are paginated at 20. Multi-exercise table width grows with exercise count.

## 16. Keep / change / defer

**KEEP:** company → exercise → balance routes/context; permission scope; debit-credit and sign conventions; all report sections; numeric alignment, statement hierarchy and contained scrolling; imports/exports/print; admin-only global mapping; Signature Ledger navy/warm-surface/fine-rule identity.

**CHANGE:** replace misleading selector metadata and unsearchable grid with a compact selector; group all 12 views without removing any; keep code and label together on scroll; distinguish load failure from empty; fix save feedback and accessible small actions; address import integrity and override-read scope first.

**DEFER:** landing KPIs/readiness/latest-import indicators until real scoped aggregate data exists; new ratios/formulas/periods/currencies/classification rules; changes that replace existing multi-exercise reports or routes.

## 17. Recommended product direction

A Financial Ledger registry at the module entry, implemented first as a searchable compact société selector with existing fields and direct navigation to the exercise register. Keep the French module label États financiers; Financial Ledger can be an internal design archetype. The selected-company page is the exercise/report workspace; the single-balance editor is the accounting preparation surface. Do not make the landing a dashboard without aggregate data.

Keep Paramétrage grouped under finance, but name its cabinet-wide Grille AFFECTAT scope and distinguish company overrides.

## 18. Comp brief

- Desktop landing inside the existing authenticated shell: compact Signature Ledger identity and name-first searchable society register using only existing name/code/RNE/status/theme; no fake metrics or CRM tenure/responsable. Row opens that society’s exercise register.
- Mobile landing: stacked tap-friendly identity rows and same search; no page-level horizontal overflow.
- Desktop selected-société: identity, compact exercise ledger (exercise/update/note/open/delete/create), and all 12 views grouped by task. Make cross-exercise comparisons explicit and retain every year heading.
- Mobile selected-société: all authorized views discoverable through compact grouping; keep horizontal scroll inside tables and keep identifier plus label visible.
- Balance editor: preserve account → label → debit → credit → derived solde → AFFECTAT, company/exercise title, discrepancy/no-code cues, sorting/pagination, add/edit/delete/import/export/print.
- Paramétrage: distinguish admin-only cabinet mapping from society-specific account overrides; communicate global impact.
- Visual identity: The Trusted Ledger / Signature Ledger—working sans, navy structure, warm surfaces, fine rules, restrained gold and distinct semantic status colors. No marketing hero, KPI cards or invented financial visuals.

### Persona red flags

- **Collaborateur / accountant:** unsearchable cards slow switching; mislabeled employee count and record-creation date are weak financial cues; malformed import can replace a balance with wrong amounts.
- **Admin mapping owner:** global rename/merge/poste changes affect shared reporting; scope and consequence must remain clear.
- **Accessibility-dependent user:** icon-only balance delete, small targets and wide multi-year context require accessible names and preserved table relationships.

### Minor observations

- “Balance & synthèse” labels the company selector, whose first view is “Exercices.”
- “Paramétrage” is broader than the Grille AFFECTAT table.
- A schema comment says Bilan/CPC is not yet built although statement pages exist; current code is the source of truth.
- Exercise labels are unrestricted strings while some fixed-asset calculations assume year-shaped values; reports sort exercise labels lexically.
- Empty selector text has no direct assignment action; it does mention requesting scope.

### Questions to consider

1. Which should lead the next step: (a) import integrity and société-scope safety (recommended), (b) searchable selector, or (c) 12-view navigation/mobile hierarchy?
2. For the design comp, should the landing remain a simple searchable selector using existing data (recommended), or wait for a properly scoped financial-readiness aggregate before becoming a richer register?
