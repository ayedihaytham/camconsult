---
target: Grille AFFECTAT / Paramétrage
total_score: 23
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 4
target_identity: "file:C:\\Users\\Dhib\\Documents\\GitHub\\camconsult\\app comptabole\\src\\pages\\etatsFinanciers\\GrilleAffectatPage.tsx"
target_fingerprint: "sha256:17952a4712fb71faf769131692598841d22796532108027fbbf1da8e508974d2"
target_path: "C:\\Users\\Dhib\\Documents\\GitHub\\camconsult\\app comptabole\\src\\pages\\etatsFinanciers\\GrilleAffectatPage.tsx"
timestamp: 2026-09-26T20-50-48Z
slug: es-etatsfinanciers-grilleaffectatpage-tsx-9f4146ec
---
Method: dual-agent (A: /root/affectat_ux · B: /root/affectat_scope). Source and documentation only.

## Product role

`/grille-affectat` is the cabinet-wide configuration register, not a statement. Codes have an identifier, label and optional global Bilan/CPC poste. Global account-to-code associations are learned from balance entries/imports; société-specific account-to-code overrides are stored separately and take precedence for that société's future imports. This page displays only global mappings and counts global attached accounts. Codes arise indirectly from assigned balance lines, not from a page-level Add control. The page is admin-only, while the API allows internal collaborators to read the reference. Mutations require admin. Collaborator balance saves can learn cabinet-wide mappings by default; this is current behavior, not a proven permission bypass.

## Design health score

| Nielsen heuristic | Score / 4 | Key issue |
|---|---:|---|
| Status visibility | 2 | Inline saves lack local pending/success feedback |
| Real-world match | 3 | Accurate domain vocabulary and scope explanation |
| Control and freedom | 3 | Dialog cancellation exists; inline save recovery is weaker |
| Consistency | 3 | Brand/table primitives fit, interactions vary by field |
| Error prevention | 2 | Global poste and rename consequences need safeguards |
| Recognition | 2 | No quick location for code or unassigned poste |
| Efficiency | 1 | Linear scan without search/pagination |
| Minimalism | 3 | Restrained but help permanently occupies vertical space |
| Error recovery | 2 | Failed inline edits can appear saved |
| Help | 2 | Definitions lack link to override workflow |
| **Total** | **23/40** | **Acceptable; targeted work needed** |

## Design specificity verdict and evidence

The navy identity and precise accounting language are CamConsult-specific, while the editable register remains generic. The CLI detector returned `[]` (zero findings), which does not test mapping semantics or rendered mobile ergonomics. No live visual overlay was used by explicit user constraint.

## What's working

- Three explanations establish code/poste/société override vocabulary.
- The dense semantic table preserves code, label, poste, attached-account count and actions without cards.
- Rename and remove have confirmation/dialog copy; loading, error/retry and empty states exist.

## Priority issues

1. **P1 — Rename omits société overrides.** The transaction updates `balance_lignes` and global `grille_comptes` but not `grille_comptes_societe`. Later import can reuse and recreate the old code. The dialog's all-lines claim is incomplete. Resolve data integrity before polishing that workflow. Source: `server/routes/grilleAffectat.js:79-99`, `server/schema.sql:359-366`.
2. **P1 — Global consequences are understated.** Changing poste saves immediately and affects all société reports through the report join. Deleting a code leaves raw balance lines but removes their poste join, placing them in the unassigned report bucket. Make these effects explicit before destructive/report-affecting changes. Source: `GrilleAffectatPage.tsx:146-162,230-240`, `server/routes/grilleAffectat.js:104-107`, `server/routes/balances.js:107-119`.
3. **P1 — Long register lacks navigation.** All codes render at once without search, sort or pagination. Start with search over loaded code/label/poste; filters for actual unassigned poste or attached-account count can be evaluated. `countFor` is O(codes × global accounts) client CPU, not network N+1. Source: `GrilleAffectatPage.tsx:45,107-193`.
4. **P1 — Mobile reuses a 720px desktop table.** Shared Table provides local horizontal overflow, so page-level overflow is not proven, but code identity and row actions are separated by panning. Use compact mapping rows at phone widths while retaining desktop table. Source: `GrilleAffectatPage.tsx:107-193`, `src/components/ui/table.tsx`.
5. **P2 — Inline save and accessibility gaps.** Label saves on blur from uncontrolled `defaultValue`; failed PATCH can leave apparent unsaved text. Poste saves on selection. Per-row fields need accessible names and local pending/error feedback; repeated 36px icon actions are weak mobile targets. Source: `GrilleAffectatPage.tsx:134-188`, `src/store/balances.ts:348-359`.

## Personas and cognitive load

Power user: no direct code jump or unassigned triage across a long list. Keyboard/screen-reader user: per-row input/select lack row-specific accessible labels; icon controls are 36px. First-time admin: scope terminology is explained, but where société exceptions are configured is not linked. The five-column register and repeated editable cells impose moderate scanning load; the action choice itself is not overloaded.

## Table, editing, global scope, mobile and reuse

Make this a Ledger configuration work surface, not a report tab or card grid. Reuse FinancialIdentityHeader, ledger toolbar/search/filter, table/DataTable and pagination primitives, Dialog/ConfirmDialog, and domain store. Do not add bulk selection without a real batch operation. Sticky header makes sense for a bounded long register; sticky code column is optional at intermediate widths. Keep quick low-risk label editing near the row with explicit save/failed state, and add an impact checkpoint for changing global poste. Retain dedicated rename/merge dialog. A right-side Sheet earns its place only if attached-account and impact context make the two-field edit materially clearer. Demote destructive row action to accessible overflow. Compact the explanatory block without hiding definitions. State clearly that this page is global and that attached count excludes société overrides. Phone rows should preserve code, label, poste, count and actions without compressing the desktop table.

## Security/data flow and documentation

GET uses two cabinet-wide queries and a third scoped query only when `societeId` is passed; no page-level network N+1. API GET is internal-read; PATCH/rename/delete are admin-only. Global code rename omission is a real scope integrity defect, not a demonstrated unauthorized access. Report mapping changes are real. If implemented, update `docs/design-system.md` for configuration-register pattern, `docs/data-flow.md` for override precedence/impact, and `docs/permissions.md` only if write authority changes.

## Agreement, disagreement and next step

Both assessments agree on search/navigation, mobile recomposition and clearer edit feedback. Agent A prefers retaining quick inline edits; Agent B stresses global consequences. Reconcile by keeping fast low-risk edits but accurately guarding report-affecting changes. Recommend `/impeccable design` for register/mobile composition after separately resolving or explicitly scoping the rename/override integrity issue. No browser testing or production changes.
