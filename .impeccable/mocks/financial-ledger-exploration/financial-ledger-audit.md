# CamConsult Financial Ledger — source-based design audit

Design exploration only. The three linked HTML comps use the existing public brand values (#0B2545 and #C9A96A) and illustrative development-seed data; they do not query production. The approved dossier identity header and grouped finance navigation remain the baseline. No API, formula, permission, route, data model or production UI change is proposed as part of this artifact.

## Main findings

1. A single body pattern cannot fit all 12 views. The implementation contains a balance register, three comparative statements, an indirect cash-flow statement with input fields, analytical tables, fiscal calculations, a long narrative document, asset schedules and checks. Repeated `LedgerSheet` containers create long vertical stacks, especially in Notes, TDRF and Contrôle.
2. Numeric hierarchy is uneven. `FinancialTable` already right-aligns tabular values and distinguishes sections/totals, but the dominant result can still be hard to find among dense rows. Other views use separate table structures, so a consistent zero/negative/subtotal vocabulary is missing. Preserve the actual debit−credit sign convention and existing `computeRows`/`computeSig` functions.
3. Mobile overflow is local but often not useful. `FinancialTable` pins at least 240px of label before 130px per exercise; `AffectatSyntheseTable` pins 352px for code/label; SIG and immob tables are much wider. Keep full accounting columns available, but offer a one-exercise reading mode or focused row detail on phone widths.
4. Period context is inconsistent. Statements compare all available exercises; Notes and the asset register choose one locally; TDRF renders a complete form per exercise. Notes places its exercise selector after an exercise-dependent principles section. The selected financial view itself is component state and returns to Exercices on reload.
5. Source and editing provenance need clearer visual treatment. Balance rows distinguish compte, libellé, débit, crédit, solde and AFFECTAT; imported classifications may be supplied, learned cabinet-wide, société-specific, suggested from account prefix, or blank. TAB VAR mixes calculated and editable values and makes registry-covered masses read-only. Flux and TDRF mix derived values with inputs. Color alone cannot explain those differences.
6. Reading is not always read-only today. Immo, Flux and TDRF components can persist suggested inputs when mounted. Supplemental data also loads independently of postes. Any future edit-mode separation or save-status change must be treated as a behavior change and reviewed separately.
7. Contrôle repeats a small four-column comparison in a separate rounded container for each line. It should be one grouped reconciliation register per exercise, with source values, discrepancy and direct provenance. Some checks reuse the same underlying source; the cash-closing check in particular compares a balance liquidity value with a Flux field copied from that same value. No UI should claim independent validation or certification.
8. The complete workbook output is not the same as the on-screen collection: full Excel/PDF exports build eight sheets, while print renders eleven sections and its sommaire lists only eight. Section-specific exports cover the views. Any design label should state export scope honestly; reconciling the manifests is a separate product/code decision.

## Internal classification and design needs

| View | Type / real task | Dominant content and appropriate body | Current limitation / mobile need |
|---|---|---|---|
| Exercices | Register; create/open/delete source balances | Exercise, note, update date, direct balance action | Compact rows and same create dialog; a FAB can serve phone width without replacing empty-state action |
| Bilan Actif | Financial statement; read assets | Gross, amortization/provision, net, current/noncurrent totals, total assets | Preserve account hierarchy; one exercise plus optional comparison on phone |
| Bilan Passif | Financial statement; read equity and liabilities | Equity with net result injected from CPC, noncurrent/current debts and grand total | Share statement grammar with Actif; long labels need wrap and local horizontal alternative |
| État de résultat | Financial statement; trace earnings | Revenues, charges, operating and final results from existing poste rows | Strong subtotal/final-result lines; keep comparisons readable |
| Flux de trésorerie | Indirect cash-flow statement plus financing inputs | Operating adjustments, investing movements, financing fields and cash position | Separate calculated rows from five editable fields; do not imply independent cash reconciliation |
| SIG | Analytical statement | Existing Products / Charges / Soldes intermédiaires blocks, across exercises | Three column groups per exercise are extremely wide; preserve block relationship in mobile disclosure |
| TDRF | Fiscal worksheet / calculation | Existing parameters, reintegrations, deductions, calculated stages and tax outputs | Choose exercise first, add internal stages; long input form needs labels and save feedback |
| Synthèse AFFECTAT | Mapping audit / register | Raw codes, mapped labels, amounts by exercise, blank code and total | Code/label sticky span is 352px; compact identity on mobile without hiding blank-code exceptions |
| Notes | Disclosure document | Company profile, accounting principles, account detail, immob summary, narrative blocks | Local table of contents; exercise selector precedes exercise-specific content; long document navigation |
| TAB VAR Immob | Wide movement worksheet | Opening/gross acquisitions/cessions/closing, amortization and VNC by mass/exercise | Controlled horizontal scroll; explicit editable vs registry-derived cells |
| Registre immobilisations | Asset register | Asset identity, acquisition date/cost, rates, category subtotals, amortization/VNC | Compact asset rows and focused detail/edit; no giant per-asset cards |
| Contrôle | Reconciliation / exception register | Check name, both source values, computed difference, comparison by exercise | Consolidate checks, pair semantic discrepancy text with numbers; avoid invented pass/approval status |

Related workflows: `BalanceEditorPage` is a dense source worksheet; `ImportBalanceDialog` previews/replaces lines and classifies AFFECTAT with real source priorities; `ImportBiensDialog` brings in asset rows; `GrilleAffectatPage` is an admin-only cabinet reference, not a 13th statement tab. The existing print and export implementations must remain sources of output scope until separately changed.

### Per-view interaction decisions

| View | Density / internal navigation | Width, sticky context and editing | Phone composition |
|---|---|---|---|
| Exercices | Compact; no internal index | Register columns need no frozen axis; create/delete and open balance remain direct | Stacked ledger rows, visible action, permitted create FAB |
| Actif | Medium-dense; section jump optional when long | Pin a compact poste label where table scrolling is necessary; read-only | One exercise, optional comparison toggle, original table accessible |
| Passif | Medium-dense; same chapter rhythm as Actif | Same number columns and final-total grammar; result is injected, not edited here | Same statement presentation as Actif |
| Résultat | Medium-dense; anchor major product/charge/result sections when long | Subtotals and final result outweigh leaf values; read-only | Segment by real sections, retain every amount |
| Flux | Medium-dense; operating/investing/financing anchors | Preserve comparative columns; five financing/interest inputs need an explicit working subarea | Read sections vertically, edit an exercise's input group in a focused sheet |
| SIG | Dense analysis; block anchors useful | Product, charge and soldes groups remain semantically paired; full table may scroll locally | One real SIG block at a time with accessible group labels |
| TDRF | Dense worksheet; stage index required | One exercise and calculated milestones; parameters/free lines editable and labelled | Exercise first, then stage disclosure with persistent save/error feedback |
| Synthèse AFFECTAT | Dense audit register; no chapter index | Raw code plus label should stay legible; unclassified row and total remain visible | Code and label together, selected exercise amount, full comparison available |
| Notes | Readable document; local sommaire essential | Narrative text measure differs from numeric note tables; profile and disclosures editable where already supported | Sommaire as grouped selector, chapter reading and explicit editing |
| TAB VAR Immob | Dense ten-column schedule; mass anchors | Local horizontal scroll with frozen mass/exercise identity; mixed editable and registry-derived cells | Mass + exercise first, opening/closing/VNC summary, full movement table reachable |
| Registre immobilisations | Dense register; category jump optional | Preserve category subtotals and per-asset actions; asset cost and depreciation need stable numeric axes | Compact asset rows; edit/detail in existing sheet flow |
| Contrôle | Dense exception register; exercise jump useful | Check/source/difference in one line; computed comparison read-only | Difference first, source pair in expanded detail; no fabricated approval state |

### Source map and constraints

- View composition, fetch timing and full/section export choice: `src/pages/etatsFinanciers/BalancesListPage.tsx`.
- The actual 12-view taxonomy and desktop/mobile navigation: `FinancialViewNavigation.tsx`.
- Statement row definitions and debit−credit presentation: `src/lib/etatsFinanciers/postes.ts`; raw AFFECTAT grouping: `server/routes/balances.js`.
- Statements and analyses: `FinancialTable.tsx`, `SigTable.tsx`, `FluxTable.tsx`, `TdrfTable.tsx`, `AffectatSyntheseTable.tsx`.
- Supporting schedules and sources: `ImmoVariationTable.tsx`, `ImmobilisationsRegistrePage.tsx`, `BalanceEditorPage.tsx`, `ImportBalanceDialog.tsx`, `ImportBiensDialog.tsx`.
- Long-form report and reconciliation: `NotesView.tsx` plus its five section components, `ControleTable.tsx`, `src/lib/etatsFinanciers/controle.ts`.
- Printing and workbook contents: `PrintClasseurPage.tsx` and `src/lib/etatsFinanciers/exportClasseur.ts`.
- Finance authorization stays with the internal-team route guard and `server/financeAccess.js`; `/grille-affectat` remains an admin configuration route.

## Directions to compare

| Direction | Visual philosophy | Strength | Tradeoff | Desktop / mobile | Print/export implication | Relative implementation effort |
|---|---|---|---|---|---|---|
| A — Financial Statement Book | Continuous white paper, chapter index, formal hierarchy and fine rules | Bilan, Résultat, Flux and Notes read exceptionally well | Repeated edits require more navigation between report and source | Desktop wide document with local contents; mobile one readable exercise and disclosure sections | Closest to printed reports, but wide schedules still need print-specific rules | Medium |
| B — Ledger Workspace | Dark grouped rail, compact context, dense grid and corrective actions | Balance, Exercices, AFFECTAT, Immo and Contrôle use width efficiently | Long documents require a separate reading/print mode | Desktop working sheet dominates; mobile selected exercise and row-detail editing | Screen is operational; print must use a separate formal stylesheet | Medium-high |
| C — Hybrid Financial Workbook | Shared context/numeric grammar with explicit reading and working body modes | Fits all 12 types without forcing identical composition | More than one body renderer must stay consistent | Desktop statements become paper, sources become sheets; mobile switches by task type | Could preserve formal export while giving inputs an efficient surface | High |

No winner is selected here. The differences are in body architecture, not route/data logic.

## Proposed shared visual grammar

- **Financial report context:** société identity, active view, available exercise(s), source/scope of export. Only display a unit when the existing screen or real model supplies it.
- **Statement rows:** section, detail, subtotal and final total with consistent right-aligned tabular numerals, restrained negative and near-zero conventions, row headers and screen-reader-aware labels. One presentation layer can serve Actif/Passif/Résultat because they already share `FinancialTable`.
- **Working cells:** visual difference between calculated, explicitly entered, suggested and registry-derived values; useful field labels, focus, save/error feedback. Apply only where the source really distinguishes provenance.
- **Register rows:** exercise and asset records with compact identity, direct action and detail/secondary metadata.
- **Exception rows:** difference and source pair on the same scan line, readable warning/error semantics and links only where a real route/action exists.
- **Document sections:** numbered Notes chapters and a local contents index that does not duplicate the module rail.
- **Mobile selection:** existing grouped bottom-sheet view selector remains; an exercise selector or local section outline appears only where the view needs it. Wide accounting tables keep a controlled scroll option with a discoverable cue.

Likely production impact after choosing a direction: `BalancesListPage.tsx`, `FinancialIdentityHeader.tsx`, `FinancialViewNavigation.tsx`, `FinancialTable.tsx`, `SigTable.tsx`, `FluxTable.tsx`, `TdrfTable.tsx`, `AffectatSyntheseTable.tsx`, `ImmoVariationTable.tsx`, `ImmobilisationsRegistrePage.tsx`, `ControleTable.tsx`, `NotesView.tsx` and its sections, `BalanceEditorPage.tsx`, `ImportBalanceDialog.tsx`. No new generic table or store is needed. Navigation-state deep linking, autosave semantics, calculation discrepancies and export manifest changes require explicit behavior review if later pursued.
