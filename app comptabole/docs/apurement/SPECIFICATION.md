# CamConsult — Apurement des achats en suspension de TVA
## Codex implementation specification (approved business scope + controlled technical assumptions)

**Prepared:** 17 October 2026  
**Target codebase:** `camconsult-main/app comptabole/` (React/Vite/TypeScript + Express/Node.js + PostgreSQL)  
**Excluded:** `camconsult-main/camconsult/` (public Next.js website)  
**Status:** READY FOR CORE IMPLEMENTATION, **NOT** ready for production-certified BCD exports until Format Gate is signed off.  
**Implementation constraint:** This document specifies work to be performed by Codex. No application source changes are made by this document.

> **Authority:** The 11 choices in the user's latest response override suggested defaults in the earlier analysis. Facts explicitly described as *observed* are from the repository or attached files; everything labeled **design decision** is an engineering proposal, not a confirmed Tunisian fiscal rule. When encountering an undefined fiscal/legal rule, the implementation must surface a configurable choice or stop the affected operation, never invent legal compliance.

---

## 0. Contract, source-of-truth and non-negotiables

### Approved decisions — do not ask again

1. **Purchases only:** achats effectués en suspension de TVA, with BC and authorization management. No sales/FAC module.
2. “Apuré” involves **both purchase-order/invoice reconciliation AND tracking of official filing/acceptance**; these are separate states, not one Boolean.
3. **One authorization → many BCs.** A BC belongs to **exactly one supplier**; an invoice belongs to **exactly one BC**. Do not implement split allocations across BCs in v1.
4. TVA is **automatically calculated**, with **manual correction allowed** and a recorded, reviewable warning.
5. Exceptional dates/business discrepancies are **visible warnings subject to review**, not silently normalized.
6. Provide **BCD + Excel + PDF** declarations and a manually operated submission register. Exact official BCD semantics remain gated by validation.
7. Suggest existing **Stock purchases**; also support independent Apurement-only invoices.
8. **Bidirectional synchronization** for explicitly linked invoice facts. Avoid circular updates, overwrites, and propagation into submitted snapshots.
9. **Reuse Collecte de pièces attachments**, and track missing evidence.
10. **Cabinet internal users only**. Admin and team managers validate; assigned collaborators prepare. Client-company accounts have **no access** to Apurement.
11. Hybrid UI: company/quarter dashboard, authorization/BC drill-down, global invoice register; import `.xls`/`.xlsx` and BCD, manual entry, quarterly generation and reminders.

### Hard architectural rules

- Work only in `app comptabole/` except if a user later explicitly requests public-site work. Follow repository `AGENTS.md` and `app comptabole/AGENTS.md`, then `docs/permissions.md`, `docs/data-flow.md`, `docs/design-system.md`, `docs/conventions.md`.
- Preserve existing `Stock`, `Suivi fournisseur`, `Collecte`, task, dashboard, finance and company semantics. Existing customer `Facturation` (`server/routes/facturation.js`, tables `factures`, `facture_lignes`) is **cabinet billing**, never the purchase-invoice data model.
- Every record and request is **scoped to an authorized `societe_id`**. Client-company users (`poste='societe_employe'`) must receive 403 on every Apurement API even if they guess a URL or file ID.
- **No JavaScript floating-point monetary summations.** Store calculated and submitted amounts as exact signed/unsigned millime integers (Postgres `bigint`; strings in JSON) and use decimal-safe calculations from validated input strings. Never convert those amounts to JS `Number` to compute. Only final display converts/formatting safely.
- **Never change an already approved/submitted declaration** when an invoice, stock movement, supplier or BC changes. Corrections produce a new, explicitly linked declaration version and preserve earlier snapshots and download artifacts.
- **Never mark a file as officially accepted** when it is merely generated or downloaded. Filing and acceptance/rejection are human-evidenced transitions.
- **No automatic creation of fictitious Stock movements** when a standalone Apurement-only invoice is entered; Stock has physical goods and multi-line semantics. Link it to an existing Stock record later if a matching stock movement is created.
- **No automatic tax-authority submission.** None of the source documents proves an API or electronic submission interface.
- For BCD output, **prepare/test the observed sample format**, but label any generated file *test / non-official* and block official/production issue until the Format Gate is approved (see §2).

### Scope outside v1

No sales/FAC export, no full generic accounting purchase-invoice ledger, no multi-BC invoice splitting, no changes to Banque or `Facturation`, no direct tax portal integration, no implicit classification of an invoice as eligible merely because it exists in Stock, no legally binding clearance certificates.

---

## 1. Verified repository and document facts (use these locations)

### Actual architecture

| Existing place | Verified behavior and intended integration |
|---|---|
| `src/App.tsx` | Lazy React Router routes; use `<RequireEquipe />` for internal cabinet section and an internal-only Apurement permission check if necessary. |
| `src/components/layout/sidebar/navigation.ts` | Navigation groups; place `Apurement TVA` in `Comptabilité`, hide from société users. `cheminAutoriseClient` is an allowlist; do **not** add Apurement there. |
| `src/hooks/usePermissions.ts`, `src/store/auth.ts` | Client permissions/scope; server authorization must remain decisive. |
| `server/index.js` | Express API mounts at `/api/*`; add `/api/apurement`. |
| `server/auth.js` | `requireAuth`, `canSeeSociete`, `porteeSocietes`, `requireEquipeManager`, refreshed sessions. Additional explicitly internal guard required because `canSeeSociete` alone can permit client-company users to see their company. |
| `server/db.js` | `query` and `withTransaction` with PostgreSQL client; use for atomic sync and approvals. |
| `server/ensureSchema.js`, `server/schema.sql`, `server/migrate.js` | Schema is replayed at startup; all Apurement DDL must be additive/idempotent and data-preserving. Consider dedicated versioned migration scripts registered in startup rather than risky schema rewrites. |
| `server/routes/stock.js` | Purchases in `stock_mouvements` and `stock_lignes`, posted/edited/deleted in transactions; this is a critical sync hook. |
| `server/routes/fournisseurs.js` | Supplier-follow-up reads Stock purchase lines; not a standalone master supplier invoice table. `cleFournisseur` is a name key, **not legal identity**. |
| `server/routes/collectes.js`, `collecte_fichiers` | Attachments stored as `data_url` associated with a collecte; may be deleted. Link via secure reference and ensure durable official snapshots. |
| `server/routes/noeuds.js`, `noeuds` | Shared company document tree: another possible evidence source. |
| `server/notifications.js`, `server/relances.js` | In-app notifications and scheduling patterns. `concernedBySociete` includes **societe_employe** users — never use directly for Apurement recipients without filtering. |
| `server/routes/taches.js` | Reuse task conventions only; do not introduce Apurement-specific task statuses in shared `taches`. |
| `src/lib/classeurExcel.ts`, `src/lib/fichierImport.ts` | Existing `.xls`/`.xlsx` reader and pre-read guards. `fichierImport.ts` warns about security issues in existing `xlsx` dependency; treat parser as untrusted and upgrade/isolate as feasible. |
| `src/components/common/DataTable.tsx` | Reuse existing shared data table; server-side pagination, filters and sorting for new invoice/BC lists. |
| `server/journal.js` | Best-effort log (`logAction`); **insufficient** as sole immutable financial/legal audit trail. Add transactional domain audit entries. |

### Exact Stock structure and mapping

`stock_mouvements` has `societe_id`, `achat_date`, `achat_num_facture`, `fournisseur`, `achat_devise`, `achat_cours`, `achat_montant_tnd` (legacy scalar), `achat_doc_data_url`, and sales/customs fields. The **purchase line items** live in `stock_lignes` where `categorie='achat'` and `montant_tnd` is Postgres `numeric`; there can be multiple lines for one movement. Use the purchase-line total with an explicitly documented fallback for legacy records, not the sum of purchase and sale lines. Neither table currently provides a normalized supplier fiscal identifier, authorization, BC, or suspended TVA amount.

The existing Stock PATCH endpoint builds an updated DTO and calls `replaceLignes` in one transaction. **Do not implement sync by making HTTP requests from one server route to another.** Refactor necessary stock persistence into a reusable service, preserving DTOs and existing routes, then invoke the Apurement sync coordinator *inside the same PostgreSQL transaction*.

### Attached evidence

- `APPUREMENT BC 03 TR 2026 INDUSTRIE (1).xls`: legacy `.xls` with `Factures` and `Société` tabs, macro-bearing workbook. `Factures` has authorization ref, BC number/date, invoice number/date, supplier MF/name, HT, suspended TVA and object. Sample invoice dates include `07/2026`, `08/2026`, `09/2026`: **month/year only, not legally usable as a complete date**.
- `BCD_T3_26`: observed 208 records = **1 EF + 206 DF + 1 TF**; lengths 220 / 521 / 198 characters; 6 BCs, 4 suppliers, one authorization. Detailed HT 13,950,327.387 TND matches footer; detailed suspended TVA **2,650,562.191** vs footer **2,650,562.204 TND**: **13 millimes difference**.
- `cah_charg_dep_fact_compressed.pdf` (2007): covers **factures émises** (sales) with `FAC_` convention and different fields; page describing record length says 231, tables extend to 331. **Not an applicable purchase BCD specification by itself**. Do not combine its `FAC` fields with sample `BCD` layout.

---

## 2. Remaining blockers and explicit stage gates

The answered questionnaire resolves scope but **not** all implementation-level accounting rules. Implement independent phases without waiting, but never guess the following items.

| ID | Unresolved item | Severity | Safe behavior until resolved | Needed evidence/decision |
|---|---|---|---|---|
| **B1** | **Official 2026 BCD purchase filing specification** (field positions, lengths, reserved positions, filename, encoding, allowed values, accepted attachments) | **RELEASE BLOCKER for official BCD** | Build parser/serializer for **sample-derived test profile only**, feature flag off for official export | Official BCD cahier des charges or administration-accepted sample plus proof of acceptance |
| **B2** | **VAT rounding, aggregation and discrepancy rule**, especially the 13-millime mismatch in supplied sample | **RELEASE BLOCKER for financial approval/official export** | Use one transparent provisional per-invoice half-up-to-millime calculation for preview; show both detail-sum and aggregate-sum; flag discrepancies. Don't silently choose one for final filing | Accountant-approved rule for tax rate(s), rounding, manual overrides, footer and tolerance |
| **B3** | Legacy **month/year-only invoice dates** and period allocation outside the invoice quarter | **ROW-LEVEL BLOCKER for strict export** | Import with `date_precision='month'`, keep raw value, exclude from final BCD until complete date supplied; cross-period dates get reviewed warning and explicit period allocation reason | Accountant supplies actual dates and exception treatment |
| **B4** | Whether authorization and BC have **legal ceilings, expiration/validity, specific tax rates** | **CONDITIONAL** | Model nullable limits/dates; never fabricate them or display a fake remaining balance. Block only rules that are agreed/configured | Real authorization example and constraints |
| **B5** | How editing **amounts of multi-line Stock invoice** from Apurement should modify stock purchase lines, prices and currency values | **SYNC SAFETY GATE** | Bidirectional sync straightforward shared fields; amount changes require a line-level adjustment workflow or explicit authoritative line allocation. Never arbitrarily scale or overwrite line items | Confirm accounting treatment for complex Stock invoice edits |
| **B6** | Which submission proofs/statuses qualify as `accepté`, `rejeté`, or truly `apuré` | **WORKFLOW SIGN-OFF** | Track `déposé (déclaré par utilisateur)` and `accepté (preuve enregistrée)` separately; do not claim official acceptance automatically | Example filing receipt, rejection and correction flow |
| **B7** | Production data retention, attachment max size and deployment topology | **DEPLOYMENT GATE** | Reuse secured existing storage short-term; freeze immutable evidence; cap sizes and do not embed unlimited data-URLs in list responses | Storage/backup policy and retention requirements |
| **B8** | Quarterly reminder schedules and actual filing deadlines | **CONFIGURATION GATE** | Reminders work when configured; no hardcoded legal deadlines, no automatic client messages | Deadlines, frequency, recipients, notification channels |

**Format Gate:** B1 and B2 must be signed off with fixtures and byte-for-byte/verifiable output tests before the production UI enables **« Générer BCD officiel »**. B3 must be resolved per affected invoice. B5 determines completeness of multi-line reverse monetary sync. Other screens, linking, reconciliation, draft reports and traceable review can be built beforehand.

**Implementation may proceed now** on foundational schema, UI, Stock suggestions, explicit linking, safe bidirectional common-field sync, document references, imports, internal Excel/PDF, warnings, approvals and submission register. **Do not label the feature legally compliant on that basis.**

---

## 3. Domain entities and ownership (detailed build contract)

### 3.1 Company fiscal profile

`apurement_profils_fiscaux` — one row per `societe_id` (FK, unique); fields: declarant legal name, activity, raw MF string and its explicitly mapped components, city, street, number, post code, source/reference and last verified time. Prefill from `societes`; changes in the general Société form trigger a *difference notice*, not a forced overwrite of a reviewed fiscal profile. Track `verified_by`, `verified_at`, `updated_at`, revision.

### 3.2 Supplier directory

`apurement_fournisseurs`: UUID, `societe_id`, `raison_sociale`, `matricule_fiscal_raw`, `matricule_fiscal_normalise` (nullable until verified), aliases, created/modified/revision. Company-scoped; **do not identify a supplier legally by `cleFournisseur` alone**. Maintain a name-key candidate match for Stock and an explicit accountant-confirmed match to verified fiscal ID. Conflicting MF for an existing supplier must warn/block inappropriate merge. One BC references exactly one supplier.

### 3.3 Authorizations

`apurement_autorisations`: UUID, company, `numero` text, type/category if confirmed, `date_debut`, `date_fin` nullable, `plafond_ht_millimes` and `plafond_tva_millimes` nullable, administrative document, `statut_interne` (draft/active/closed/cancelled, not a legal clearance assertion), version, timestamps, audit. Unique index only on a business key confirmed by real samples (initial suggestion `societe_id`+normalized authorization number, with collision review). Different BCs may reference the same authorization and different suppliers. Do not assume one BC per authorization.

### 3.4 Purchase orders — BC

`apurement_bons_commande`: UUID, company, `autorisation_id` required, `fournisseur_id` required, `numero` text preserving leading zeros, `date_bc` nullable in draft, optional contractual ceilings/dates, description, internal workflow state, revisions/timestamps. FK validation must ensure same `societe_id` among BC, authorization and supplier (composite keys or transaction-level assertions plus regression tests). A BC is not marked “apuré” just because invoices exist; show **contrôle documentaire**, **contrôle montants**, **déclaration**, **dépôt** separately. A BC can span multiple quarters if business permits; an invoice still belongs to exactly one BC.

### 3.5 Purchase invoices

`apurement_factures`: UUID, company, `bc_id` required for declaration eligibility (may allow nullable only in *unassigned intake drafts*), `fournisseur_id` derived/validated against BC; `numero_facture` text; `date_facture` nullable, `date_precision` (`day`/`month`/`unknown`), `date_brute` for imported partial dates; `objet`, invoice type (`facture` initially; credit notes quarantined until signed off), `montant_ht_millimes bigint`, `taux_tva_bps integer` (e.g. 1900 for 19%), `tva_calculee_millimes bigint`, `tva_suspendue_millimes bigint`, `tva_mode` (`auto` or `manuel`), override justification, warnings/acknowledgment state, source type, stock link, optimistic `version`, timestamps, soft archive, creator/modifier. `stock_mouvement_id` nullable and **unique where not null** if business unit is precisely one stock movement → one purchase invoice. Use explicit link table instead if the code discovers a real many-to-one stock invoice representation; do not conflate goods lines with separate fiscal invoices.

**Single-BC invariant:** Each active invoice has zero-or-one (intake draft) or exactly one (complete) BC. Do not create `apurement_imputations` in v1. BC supplier = invoice supplier; changing BC requires revalidation of supplier and quarter.

**Duplicate policy:** Candidate duplicate key = company + verified supplier MF (or resolved supplier ID) + normalized invoice number + full date (where present); flag possible duplicates for incomplete dates or missing fiscal ID. Never unique-index the raw number alone; do not silently deduplicate imported files.

### 3.6 Cross-module linkage and sync

`apurement_liens_stock` if not embedded in invoice: `facture_id` unique, `stock_mouvement_id` unique, company, link state (`linked`/`conflict`/`source_deleted`), last synced source hash/version, last direction/actor/timestamp, conflict JSON details. Use one canonical mapping between invoice and purchase movement.

Syncable **shared source fields**: purchase date, invoice number, resolved supplier name/identity when safe, and line-aggregate HT **only when line allocation is explicitly safe**. **Apurement-only fields stay in Apurement:** authorization, BC, suspended-VAT amount/rate and tax-review metadata. **Stock-only fields stay in Stock:** goods, quantities, line unit prices, sale/customs data, foreign-currency and FX input. Do not corrupt source semantics for the sake of bidirectionality.

### 3.7 Documents / missing evidence

`apurement_pieces_liens`: company, parent type/id (`autorisation`, `bc`, `facture`, `declaration`, `depot`), original source (`collecte_fichier`, `noeud`, `stock`, `apurement_upload`), source object id, verified source company and access, filename/MIME/size/hash, immutable evidence object reference or frozen copy, source state, timestamp. One document may be linked to multiple Apurement objects with **no redundant user upload**. `apurement_pieces_manquantes`: requested evidence type, parent object, state (`manquante`/`demandee`/`fournie`/`validee`), due date nullable, request link (optionally Collecte), company and audit.

Existing `collecte_fichiers` can be deleted/cascade-deleted. If a piece is essential to a validated/submitted declaration, retain a **durable content-addressed copy/snapshot** or immutable storage reference before approval. Do not assume a mutable FK alone is a durable legal archive; don't make a global Collecte deletion impossible as a side effect without product approval.

### 3.8 Period, declaration versions, snapshots and submission

`apurement_declarations`: company, year (four-digit), quarter T1–T4, version integer, `supersede_declaration_id` optional, internal state, submission state, generated source profile/version, control hash, approved/reviewed by/at, submitted/accepted/rejected by/at, filing reference, created/updated timestamps. Enforce one editable *current draft* per company/year/quarter, and unique `(societe_id, exercice, trimestre, version)`.

`apurement_declaration_lignes`: immutable snapshot of invoice ID/reference, BC/authorization/supplier identity, exact date, HT, TVA, VAT mode/override, sequence, document hashes. At approval take an atomic snapshot under a lock. Past snapshots must be immutable even if live invoice or Stock changes.

`apurement_depots`: submission attempt/version, sent date, mode (portal/manual/other), receipt/reference, outcome (submitted/accepted/rejected), rejection reason, proof attachments, actor/timestamp. Allow multiple attempts after rejection; don't overwrite accepted evidence. Submitted != accepted; accepted != automatic “legally apuré” unless confirmed.

`apurement_exports`: FK declaration version, type (`excel`/`pdf`/`bcd-test`/`bcd-officiel`), storage locator, SHA-256, generator revision, layout profile, generated by/at, size, header/detail/trailer validation results. Immutable after generated. Re-download must serve the **same bytes** for an approved version.

`apurement_imports`, `apurement_import_lignes`, `apurement_controles`, `apurement_audit`, `apurement_reminder_rules`/`apurement_reminder_runs` hold source checksum, row outcomes, warnings, explicit acknowledgments, actor, before/after, and notification deduplication. Avoid storing entire source files as unlimited JSON or base64 in general-purpose API responses.

### 3.9 SQL and migration rules

- Prefer additive `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` and named indexes, and separate **version-tracked data migrations** when needed. `ensureSchema()` currently replays `schema.sql`; test cold install AND repeated boot against populated DB.
- Use UUID PK and composite tenant checks; FK delete policy should preserve legal audit. Existing `societes` is cascade-deleted by some child tables, so assess and protect declarations/exports before allowing a company deletion; never use unexamined cascade for immutable filing records.
- Use `bigint` for millimes (serializable **as decimal strings** in JSON); `numeric` may be used for intermediate precise rates and permitted source amounts. Avoid integer overflow; validate max value against export field widths.
- Use `updated_at`, row version with compare-and-swap; constraints for nonnegative values where legally applicable; unique partial indexes for linked stock movement and declaration state. Make all joined and filtered queries company-scoped and indexed.
- Write an explicit data-retention/archive/deletion policy before real filings. Never run destructive backfills automatically on startup.

---

## 4. Detailed workflow and status machine

### 4.1 Entry paths

A. Existing company selection → year + quarter dashboard. B. Add authorization and BC manually. C. Suggest stock purchases (not auto-enroll; eligibility to be confirmed). D. Upload `.xls`/`.xlsx` or BCD for preview and mapping. E. Manual standalone invoice (with evidence) not present in Stock. F. From Stock: action **« Lier à un BC en suspension »** deep-links to Apurement, with existing source values prefilled and confirmation before linking.

### 4.2 Local states (proposed French labels)

Invoice validation state: `a_completer` → `a_controler` → `conforme`/`avec_reserves`/`bloquee` → `revue`. `avec_reserves` must include warning acknowledgment, author and reason; missing required full date, legal identity or BC association remain blocking for strict BCD unless an approved specification says otherwise.

Internal declaration state: `brouillon` → `pret_a_valider` → `valide` (immutable snapshot). Filing attempt state: `non_depose` → `depose` → `accepte` or `rejete`; a rejection creates a correction workflow on a **new draft version**, not mutation of a submitted artifact. Cancellation/resubmission must be explicit and audited.

**BC display badges are derived from controls**, not arbitrary hard-coded status: `À compléter` / `Rapproché` / `Déclaré` / `Déposé` / `Accepté` / `Avec anomalies`. A BC may contribute invoices to multiple quarterly declarations; show per-period state.

### 4.3 Review and approval

1. Recompute controls server-side using current records in one transaction/consistent snapshot.
2. Reject blocking anomalies with 422 and structured codes; provide sorted list with clickable source records.
3. Require warnings to be individually acknowledged by a permitted accountant, with optional mandatory note for discrepancies (manual TVA, out-of-quarter, invoice-before-BC, linked amount mismatch).
4. Collaborator may submit for review. Admin/team manager approves and freezes a version.
5. On approval, compute exact detail totals, immutable line snapshots, warnings, fiscal profile, documents and content hashes, and record approver identity.
6. Produce frozen Excel/PDF from the approved version. BCD official only after Format Gate; otherwise test file prominently marked as such.
7. Filing register: user enters submission reference/date, proof, outcome; a rejection or amended filing creates a new declaration version.

### 4.4 Changes after approval or submission

- Edits to live invoices, linked Stock, supplier identity, authorization and BC remain possible only under permissions and safety rules; they make **current data** diverge from older snapshots without altering them.
- Notify internal reviewers of a post-approval discrepancy. Offer **« Préparer une déclaration rectificative »** from the latest accepted/submitted version.
- Never resend, mutate or silently replace the archived BCD/PDF/Excel or a receipt. Version histories must remain navigable and downloadable.

---

## 5. Bidirectional Stock synchronization — mandatory engineering protocol

**This is not background polling or a copy-on-save of independent records.** The objective is consistent shared fields for a **linked** Stock invoice, with a single transactional coordinator, field-ownership rules and explicit conflict UX.

### Link / discovery

- Read candidate purchases from `stock_mouvements` joined to `stock_lignes` for `categorie='achat'`, with server pagination and filters (`societe_id`, date, supplier name, invoice number). Reuse the supplier follow-up aggregation conventions without reusing payment records.
- Never import Stock sales, customs-only movements, a movement from another company, or a movement already linked elsewhere. Do not auto-link solely on supplier free-text name.
- Candidate ranking: company, exact normalized invoice number, date, verified supplier legal identity if available, amount converted/validated. Show confidence and differences; **link only after explicit confirmation**.
- On link, the user chooses how initial differences are resolved: **« Reprendre Stock »**, **« Reprendre Apurement »** (only fields safely writable to Stock), or **« Conserver et créer un conflit à résoudre »**. Record decisions.

### Stock → Apurement

1. Refactor `server/routes/stock.js` persistence into a reusable `stockService` while keeping current POST/PATCH/DELETE endpoints and response DTOs stable.
2. Within the **same** transaction as successful Stock mutation, find Apurement linkage, compute before/after source fingerprint, identify shared changed fields, and apply rules. For an editable Apurement record with no competing revision, update synced fields and recalculate controls; otherwise create conflict with before/after values and notify reviewers.
3. If Stock purchase movement is deleted and has an Apurement link, **block deletion with actionable message for approved/registered usage** or perform explicit audited detach/archive for allowed drafts; never cascade-delete fiscal history. Existing unrelated stock deletion remains unaffected.
4. Stock's purchase amount comes from purchase lines. If lines disagree with previously linked amount, flag `ecart_montant_stock` and require review. Preserve VAT overrides and BC linkage when Stock date/number/name updates.

### Apurement → Stock

1. For invoice **number, date and supplier name**, update the connected movement through the same stock domain service and same transaction when the mapping and client input are verified; do not change sale/customs fields or replace all `stock_lignes` just to update a header.
2. For **HT amount** when one Stock purchase has **one amount line** and currency handling is unambiguous, require confirmation and update the correct purchase line consistently. For **multiple lines**, show a **line-allocation editor** or reject reverse propagation with conflict requiring Stock-side line edits. Never redistribute amounts proportionally without explicit allocation, and never modify `achat_cours`/`achat_devise` in an unsupported manner.
3. MF and legal supplier alias may exist **only in Apurement** until the source schema provides a verified place; do not shoehorn MF into free-text stock supplier name.
4. Apurement's VAT, BC and authorization fields are owned by Apurement; they are not representable in Stock today. Bidirectional sync does **not** imply writing these into unrelated Stock columns.

### Concurrency, idempotency and errors

- Explicit `origin` metadata (`stock`/`apurement`), operation ID and sync version prevent event echo loops; invoke shared service directly, no recursive HTTP.
- Lock the linked row(s) with `SELECT ... FOR UPDATE` in a consistent lock order. Compare version/source fingerprint; return `409 CONFLIT_SYNCHRO` with base/current/incoming fields, rather than last-write-wins.
- Make repeated requests idempotent. On failed partial sync **roll back both domain updates**; never commit Stock and fail Apurement unnoticed.
- For long-running browser tabs, send existing SSE/invalidation signals *after commit* or refresh on focus; never let background refresh overwrite unsaved forms.
- Test two simultaneous edits, unlink/relink, source deletion, BC period lock, multi-line updates, manual TVA override preservation and same-file re-import.

---

## 6. Import mapping and reconciliation

### 6.1 Wizard steps (Excel and BCD)

1. Select company/quarter and source file, validate signature/size; store SHA-256 on ingestion. Enforce file size, row counts and CPU/memory limits; never execute macros.
2. Detect **Excel template** or **BCD sample-derived profile**, show recognized worksheets/header/EF metadata. `.xls` may be an OLE file, a misnamed text export, or malformed; reject unsupported types safely.
3. Map `Société`: fiscal profile and target quarter. Map `Factures` ten fields. Treat supplier MF as supplier—not declarant—identity. Preserve leading zeros and raw date strings.
4. Preview rows: original values, parsed values, tentative authorization/BC/supplier/Stock match, HT/TVA precision, warnings/errors. Allow interactive individual/group mapping and explicit override review.
5. Show **dry-run** net changes: create/update/link/skip/duplicate/conflict; no changes during preview.
6. Commit chosen rows via a server-issued short-lived, bounded preview token or deterministic import batch reference and idempotency key; verify that file hash and row decisions match reviewed preview. Process in bounded transactions; report partial failures explicitly if batch mode is supported.
7. Download import report with row numbers and code-specific errors; re-import same file must not duplicate data.

### 6.2 Column/rule table

| Excel field | Destination | Required for approval? | Import rule |
|---|---|---|---|
| N° Autorisation | authorization ref | yes | Keep as text, normalize only for comparisons |
| Numéro BC / Date BC | BC number/date | yes for strict complete BC | Validate date and mismatch with invoice |
| Numéro facture | invoice number | yes | Preserve text leading zeros and punctuation |
| Date facture | `date_facture`, precision/raw | full day required for strict BCD | `07/2026` creates partial-date warning; **do not invent day 01** |
| Matricule fiscal | supplier fiscal identity | required if target profile mandates | Validate format against approved profile; don't confuse with declarant MF |
| Raison sociale | supplier | yes | Match aliases only as *candidates* |
| Prix HT | exact millimes | yes | Parse TND with unambiguous decimal separator, three-decimal policy |
| TVA suspendue | exact millimes plus entered raw precision | yes | Show calculated vs entered/override, never silently discard extra digits |
| Objet facture | description | optional in base register | Preserve `ACHAT` as source text, not legal validation |

### 6.3 BCD parser & output profiles

**Import**: Support reverse parsing of *observed* `BCD_T3_26` with one EF, 206 DF and one TF in golden fixture. Distinguish header/detail/footer widths 220/521/198; parse year, quarter, invoice fields, BC authorization and purchase text suffix. Detect duplicate sequence, unsupported encoding, trailing noise, overlong fields, invalid digits/dates, details/footer discrepancy and unknown layouts. Preserve original file bytes and raw values. Import requires review; do not assume passing sample parsing means official conformity.

**Test export:** serializer `bcd-observed-2026-v0` may reproduce the observed mapping in a clearly labeled **test** channel; enforce ASCII strategy, fixed padding, exact string byte widths, no decimal separator, millimes, DDMMYYYY for full dates, strict identifier formats, exactly one EF and TF. **Never copy sales `FAC` field lengths into it.** Treat original BCD's mismatched VAT footer as a failed/flagged fixture for reconciliation, not a precedent for arbitrary adjustment.

**Official export:** profile `bcd-officiel-v1` stays disabled by feature flag until B1 and B2 resolved, reviewed goldens pass and documented official name/positions/encoding/case/rounding validation is signed off. On enablement, compute footer from **the approved aggregation rule** and fail if record sizes, per-field ranges or totals do not match the profile.

### 6.4 Financial control contract

Use pure functions with exact decimal library or integer-rational arithmetic. **No `Math.round(ht * 0.19 * 1000)` or ordinary JS float accumulation.** Convert input decimal strings to millimes only under a documented precision policy; retain import raw value for source evidence and require review of 4+ decimals rather than silently truncate. Rate in bps (19%=1900) and `tva_calculee` with a **clearly labeled provisional** rounding mode until accountant approval.

Expose both `total_tva_lignes` and `total_tva_sur_ht_global` independently, with `ecart_tva`; both may differ. Manual adjustment is stored with old/new value, amount difference, reason, reviewer, timestamp and control code. Tolerance policy configurable only by approved configuration; never automatically hide a 13-millime mismatch or force a footer to a global 19% value without an approved formula.

---

## 7. Evidence, reminders and other module integration

### Collecte de pièces

- Provide **« Associer une pièce existante »** picker filtered by the same `societe_id`; support `collecte_fichiers` and `noeuds` as reviewed evidence sources, plus Stock purchase-document link and new upload where necessary.
- Same document may satisfy several checks via links to its immutable storage object. Keep the original Collecte unchanged and still accessible under its normal permissions.
- Show checklist and statuses for authorization, BC, invoice and submission proof. Indicate document owner/source and whether the original is still available.
- If an Apurement reviewer creates a missing-document request, link it to the existing Collecte request workflow **only when an appropriate matching collecte exists and the user chooses to request through it**. This can notify the client via Collecte (expected Collecte behavior), but **never expose Apurement route/details or tax figures** in that client-facing message; keep Apurement itself cabinet-only.

### Supplier & company modules

- Prefill fiscal declarant from `societes`; no mass-writing company fields from imported workbook.
- Supplier suggestions reuse Stock/Fournisseurs source data, but verified fiscal-identity master resides in Apurement until a shared vendor master is explicitly introduced.
- Deep link `Apurement ←→ Stock` with bounded and authorized URLs. A supplier-paid status from `Suivi fournisseur` must **not** be equated with apurement or VAT filing.

### Notifications / reminders / tasks

- Use existing in-app `notify()` and SSE signal patterns; filter recipients to internal active cabinet staff. **Do not call `concernedBySociete` unfiltered** — it includes client-company staff.
- Trigger on manual validation requested, conflicting Stock sync, missing evidence, draft approaching a *configured* due date, rejected filing, and post-approval mutation.
- Quarter reminder rule has user-configured frequency/cadence/assignee/due date; avoid hardcoded legal deadline. Run server-side, with dedupe key `(company,period,event,recipient,cadence-window)` so restarts do not spam.
- Optional integration with existing `taches` requires only existing task states and safe internal assignment, not a new `apurement_task_status` in shared task tables. No automatic due-date behavior outside actual schema conventions.

---

## 8. API contract — implement with real route/style conventions

All routes under `/api/apurement`; `requireAuth` + `requireCabinet` (new reusable guard, 403 for `societe_employe`) and company authorization on **every** object ID and document ID; admin & team manager for approve/file/reopen; collaborators assigned to the company for draft operations. Return error envelope `{error:{code,message,fields?,warnings?}}` for new endpoints (or adapt consistently to existing API client; decide once in phase 1), with 400 malformed, 401 unauthenticated, 403 unauthorized, 404 missing *or intentionally non-disclosed other-tenant object*, 409 concurrency and 422 domain invalid.

| Method | Path | Purpose / guard |
|---|---|---|
| GET | `/synthese?annee=2026&trimestre=T3` | Scoped company/quarter summary, single batched query |
| GET/PUT | `/societes/:societeId/profil` | Fiscal profile, validated and audited |
| GET/POST | `/autorisations?societeId=&q=&page=&size=` | Paginated register/create |
| GET/PATCH | `/autorisations/:id` | Detail/update with optimistic version |
| GET/POST | `/bcs?societeId=&autorisationId=&statut=&page=&size=` | Paginated BC register/create |
| GET/PATCH | `/bcs/:id` | Detail/invoices/reconciliation/update |
| GET/POST | `/factures?societeId=&bcId=&source=&q=&page=&size=` | Invoice register/create, SQL filters |
| GET/PATCH | `/factures/:id` | Detail/update, version/conflict required |
| POST | `/stock/suggestions` | Eligible, unlinked Stock candidates for this company |
| POST | `/factures/:id/lier-stock` | Explicit confirmation and initial mapping decisions |
| POST | `/factures/:id/synchroniser` | Resolve a conflict; optionally propagate valid shared changes |
| POST | `/factures/:id/delier-stock` | Explicit, audited unlink; block when prohibited |
| GET/POST | `/pieces?parentType=&parentId=` | Evidence picker/link with company check |
| POST | `/pieces-manquantes` | Internal missing proof request (+ optional Collecte request) |
| POST | `/imports/preview` | Parse, validate, diff, persist bounded preview; NO domain mutation |
| POST | `/imports/:batchId/commit` | Validated row decisions; idempotency key; report |
| GET | `/imports/:id/rapport` | Authorized import result/errors |
| GET | `/controles?societeId=&annee=&trimestre=` | Rule codes, severity, ack, totals, affected resources |
| POST | `/controles/:id/ack` | Reasoned review with actor/time/version |
| GET/POST | `/declarations?societeId=&annee=&trimestre=` | Versions/new draft |
| GET | `/declarations/:id` | Snapshot, history, exports, filing attempts |
| POST | `/declarations/:id/soumettre-validation` | Collaborator review request |
| POST | `/declarations/:id/valider` | Manager/admin atomic snapshot/approval |
| POST | `/declarations/:id/rectifier` | New draft version from frozen parent |
| POST | `/declarations/:id/exports` | `excel`, `pdf`, `bcd-test` or feature-gated official BCD |
| GET | `/exports/:id/telecharger` | Authorization + stable frozen bytes |
| POST | `/declarations/:id/depots` | Human filing attempt and evidence |
| PATCH | `/depots/:id` | Accept/reject with mandatory evidence/reason |
| GET/PUT | `/rappels?societeId=&annee=&trimestre=` | Staff-configured reminders, no legal-default deadlines |

**Recommended request examples** (exact naming fixed in phase 1 and reflected in TS types):

```json
POST /api/apurement/factures
{
  "societeId": "<uuid>",
  "bcId": "<uuid>",
  "fournisseurId": "<uuid>",
  "numeroFacture": "F-000128",
  "dateFacture": "2026-08-15",
  "montantHtMillimes": "1444800",
  "tauxTvaBps": 1900,
  "tvaMode": "auto",
  "source": "manuel"
}
```

```json
PATCH /api/apurement/factures/:id
{
  "expectedVersion": 7,
  "tvaMode": "manuel",
  "tvaSuspendueMillimes": "274511",
  "motifCorrection": "Montant conforme à la facture jointe"
}
```

**Response list** should be `{items:[], page, size, total, hasMore}`; item amounts as **strings**, e.g. `"1444800"`. Use stable SQL sorting and indexes; UI formats TND to exactly 3 decimals. Avoid returning base64 documents or unnecessary supplier fiscal identifiers in list summaries.

---

## 9. UX / screen-by-screen behavior (French, current design system)

| Route | Screen | Essential interactions |
|---|---|---|
| `/apurement` | **Tableau de bord Apurement** | Company search, year/quarter, KPIs (`BC`, invoices, HT, TVA, unresolved warnings, filing status), priority actions and filtered list |
| `/apurement/:societeId` | **Dossier Apurement société** | Sticky summary/header, period switch, tabs: `Vue d'ensemble`, `Autorisations & BC`, `Factures`, `Contrôles`, `Déclarations`, `Documents & rappels` |
| `/apurement/:societeId/bcs/:bcId` | **Détail BC** | Authorization/supplier/date, optional ceiling and consumption, document proof, all linked invoices, VAT totals, warning and approval history, button add/link invoice |
| `/apurement/:societeId/factures/:factureId` | **Fiche facture** | Manual/edit fields, source badges, original Stock comparison, diff/conflict resolution, attachments, calculated vs manual TVA, ack notes, linked BC |
| `/apurement/:societeId/imports` | **Importer des factures** | Drag/drop Excel or BCD, mapping, row-by-row preview, correct/skip/create/link/overwrite choices, confirm, downloadable report |
| `/apurement/:societeId/declarations/:id` | **Déclaration trimestrielle** | Totals/controls, freeze/approval, versioned Excel/PDF, gated BCD, filing proof, correction history |

**Design constraints:** current CamConsult blue header language, compact spacing, sticky actions, always-visible primary actions (`Ajouter BC`, `Ajouter facture`, `Importer`, `Contrôler`, `Préparer déclaration`), table pagination and server-side search, no nested action maze, keyboard accessible and mobile cards at 375px. Use existing `DataTable` and shared dialogs/sheets; no new generic table framework. Show real-time conflict or validation feedback without toast-only business blocking messages. Keep a single canonical calculation path server-side, with UI preview purely explanatory.

**Suggested overview KPIs:** `(Nombre BC, Factures liées, Total HT, TVA suspendue, BC à compléter, Anomalies bloquantes, Pièces manquantes, Déclaration/dernier dépôt)`. All explicitly scoped to user-visible companies and selected quarter. Display remaining ceiling only if supplied, and call it **`Plafond disponible (renseigné)`**, never assume zero/blank = unlimited.

---

## 10. Codex work breakdown with checkpoints

**Execution model:** one phase per pull request/commit. Codex must read actual source files and `AGENTS.md`, report discrepancies with the spec, and validate every phase. Do not start next phase on a failing build. Avoid implementing all of this in one massive change.

### Phase 0 — Source verification + executable design contracts (no migrations yet)

**Tasks:** inspect repository instructions, scripts, all relevant Stock/Collecte/permissions/notification paths; write `docs/apurement/decisions.md`, `docs/apurement/sync-contract.md`, `docs/apurement/export-gates.md`, route/schema draft, documented warning codes and role matrix. Include B1–B8 as unresolved; prepare 206-record BCD and workbook fixture metadata without exposing real taxpayer IDs in public tests. Determine how source document storage is backed and deletion works.

**Gate:** reviewer signs off field ownership, relations, status transitions, accepted warning policy, no code edits to public site.

### Phase 1 — Domain schema, guards, exact arithmetic + audit

**Tasks:** add idempotent tables/indexes/migrations; money parser/formatting/calculation helpers; robust validation; `requireCabinet`/role policy, tenant guards; transactions/optimistic versions; audit and snapshot building blocks; server unit/integration tests. Do not change Stock writes yet.

**Gate:** migration re-run twice on populated DB; `societe_employe` 403; cross-tenant attempts denied; amounts round-trip exactly with 3 decimals; no existing schema changed destructively.

### Phase 2 — Core authorization, supplier, BC and invoice CRUD

**Tasks:** backend services/routes/list filters; fiscal profile; supplier identity; validation states; standalone invoices; BC/authorization relations, warning engine; frontend basic views and Zustand domain actions. No official output.

**Gate:** complete manual end-to-end purchase; one invoice → one BC → one supplier → one authorization; cross-company reference rejected; read/write/approve RBAC tests.

### Phase 3 — Stock source suggestions and bidirectional sync

**Tasks:** refactor Stock persistence to shared reusable service without changing existing public route semantics; implement source suggestions/verified linking, transactional two-direction shared-field sync, conflict detection, manual line allocation for complex cases, safe unlink/delete and post-approval change handling. Implement navigate-to-Apurement from Stock only where appropriate.

**Gate:** Stock old tests still pass; edits reflect in both places on common safe fields; multi-line amount change never silently corrupts goods lines; two-tab race produces 409; frozen declaration remains unchanged.

### Phase 4 — Documents, missing evidence, reminders

**Tasks:** secured existing-file picker from Collecte and Structuration/Stock, immutable evidence storage reference/snapshot, missing proof controls, optional Collecte request link, internal-only notifications, configurable reminders and dedupe, optional existing task integration.

**Gate:** no cross-company file enumeration; no Apurement UI/API for clients; no client notification from an Apurement internal alert; linked evidence survives source document deletion for frozen filing; reminders do not spam.

### Phase 5 — Excel and BCD import, preview, deduplication

**Tasks:** safe `.xls`/`.xlsx` reader, header mapping, partial date preservation and row warnings, dry-run preview/commit, supplier/BC/Stock reconciliation, safe observed BCD parser, import audit. Add golden fixtures from both attachments without executing macros.

**Gate:** 206 BCD records parsed correctly; source trailer discrepancy **+13 millimes** flagged; workbook month/year dates are not silently completed; repeat import creates no duplicate; original raw values retained; invalid files rejected.

### Phase 6 — Reviews, frozen quarterly declarations, Excel/PDF and filing tracking

**Tasks:** consistent control engine, review ack, manager/admin approval, atomic snapshots, repeatable Excel/PDF generated from approved snapshot, version history, filing attempt and proof management, correction/versioning, header KPI enhancements.

**Gate:** approved versions immutable and hashes stable; collaborator cannot approve; `generated`, `déposé` and `accepté` stay distinct; edited source creates conflict/new version rather than altering old artifacts.

### Phase 7 — BCD export validation gate (conditional)

**Tasks BEFORE Gate:** observed-profile golden tests, draft/test downloads clearly marked non-official, validator with explicit forbidden official status.

**After B1/B2 sign-off ONLY:** implement approved current official profile, exact byte-layout tests, official summary/reconciliation, eligible invoice criteria and hard pre-export validations, acceptance results attached to test evidence, enable per-env feature flag.

**Gate:** official reference and rounding policy signed; production BCD exports produce exact valid bytes; total/detail math reconciles under approved rule; strict dates/fiscal IDs/encoding all pass.

### Phase 8 — Full regression, performance and production rollout

**Tasks:** regression of all connected modules and existing workflows, test security and large imports, 2-way races, stock delete protections, backup + rollback, production-safe migrations, logging/alerts, user acceptance, staff runbook and feature-flag rollout.

**Gate:** `npm run lint`, `npm run test`, `npm run build`, `npm run test:integration` (Postgres available), `git diff --check`, relevant UI 375/768/1024/1440 checks; documented manual deployment and restore rehearsal. If baseline fails before edits, capture baseline and prevent new failures rather than masking them.

---

## 11. Proposed implementation file map — names are guidance, verify existing equivalents first

```text
camconsult-main/app comptabole/
  server/
    index.js                       # mount /api/apurement
    auth.js                        # add internal-only guard if reusable
    schema.sql                     # additive DDL and indexes, or versioned migrations
    routes/stock.js                # call reusable stock service + sync coordinator
    routes/apurement.js            # HTTP composition, validation + access guards
    apurement/
      permissions.js               # cabinet + company-level policy
      repository.js                # company scoped SQL
      domain.js                    # invariants, state transition rules
      amounts.js                   # exact millime / rates / rounding
      controls.js                  # warning codes and severities
      invoiceService.js
      stockLinkService.js          # bidirectional atomic coordinator
      documentService.js           # secured references / evidence freeze
      importExcel.js
      importBcd.js                 # sample parser
      exportBcd.js                 # gated profiles
      exportExcel.js
      exportPdf.js
      declarationService.js        # freeze/correct/filing
      reminders.js                 # configured scheduler and idempotent notifications
      audit.js                     # transactional audit trail
      tests/*.test.js
    stock/
      stockService.js              # optional extraction from routes/stock.js
  src/
    App.tsx                        # lazy routes + guards
    components/layout/sidebar/navigation.ts
    pages/apurement/
      ApurementDashboardPage.tsx
      ApurementSocietePage.tsx
      ApurementBcPage.tsx
      ApurementFacturePage.tsx
      ApurementImportPage.tsx
      ApurementDeclarationPage.tsx
    components/apurement/
      AuthorizationFormSheet.tsx
      BonCommandeFormSheet.tsx
      FactureFormSheet.tsx
      StockLinkDialog.tsx
      SyncConflictDialog.tsx
      ImportPreviewTable.tsx
      ControlPanel.tsx
      DocumentsPicker.tsx
      QuarterStatusBar.tsx
    store/apurement.ts
    types/apurement.ts
    lib/apurement/*                 # frontend pure display / request mapping only
  docs/apurement/
    decisions.md
    sync-contract.md
    export-gates.md
    operator-runbook.md
```

Do not blindly create all files; follow local conventions and consolidate where a real reusable abstraction already exists. No `app comptabole/node_modules` edits and no changes to `../camconsult`.

---

## 12. Test matrix and acceptance cases

| Test ID | Scenario | Expected result |
|---|---|---|
| T01 | Authorization with BC 39 and BC 40, each tied to one supplier | Works; independent BC sums, common authorization |
| T02 | Invoice attempts second active BC association | 422; not duplicated in totals |
| T03 | BCD fixture 206 DF | Parser obtains 206, 6 BCs, 4 suppliers, correct 13,950,327.387 HT |
| T04 | BCD fixture declared VAT footer | Flags **+0.013 TND** difference from DF sum; does not silently repair |
| T05 | Legacy Excel `07/2026` invoice date | Preserves precision/raw; strict final export blocked pending full date |
| T06 | User manually sets TVA off from calculated value | Stores both values, emits mismatch warning requiring reason/review |
| T07 | Two companies, identical supplier invoice number | No cross-company duplicate or data exposure |
| T08 | Stock 4 purchase lines + one linked fiscal invoice | Suggests/links at movement level; no false four-invoice count |
| T09 | Stock header invoice number/date updated | Linked editable Apurement updates safely or shows actionable conflict |
| T10 | Apurement changes invoice number/date | Linked Stock header updates in same transaction, audit records origin |
| T11 | Apurement edits HT for multi-line Stock movement | Line-allocation/review required; no silent modification or false success |
| T12 | Stock movement deleted while used in frozen declaration | Snapshot preserved; deletion blocked or explicit audited safe policy |
| T13 | Source Collecte attachment removed | Frozen evidence remains accessible and hash-identical |
| T14 | Collaborator tries approve; `societe_employe` tries any endpoint | 403, server-side |
| T15 | Manager validates Q3 then Stock changes invoice | Q3 version unchanged, conflict/new rectification warning |
| T16 | Excel import repeated with same checksum | Idempotent, no duplicate invoice/BC/authorization |
| T17 | Incomplete fiscal identity or invalid quarter | Blocking controls, no official export |
| T18 | Download after approval | Artifact bytes and checksum stable across re-downloads |
| T19 | File generated but not officially submitted | Status remains `non_depose` |
| T20 | Submitted with receipt but not accepted | `depose`, never `accepte` until recorded evidence |
| T21 | Rejected submission | Evidence retained; new corrective declaration version created |
| T22 | Internal reminder sent twice by scheduler/restart | One notification per configured dedupe window |
| T23 | Malicious XLS macro / fake format / oversize ZIP | Never execute macro; reject invalid/oversized inputs |
| T24 | Cross-tenant BC, Stock movement, document, import batch or export ID | 403/404; no data leaks |
| T25 | Existing Stock/Fournisseurs/Collecte UI and API paths | No regression; existing business calculations unchanged |

**Additional automation**: pure arithmetic property tests (rate/decimal precision), fixed-width round-trip/golden-byte tests, migration-from-empty-and-populated-DB tests, period/timezone boundary, pagination and performance on ≥10k invoices across companies, concurrent edit/review races, file upload and content type security.

---

## 13. Operational checklist and handoff instructions for Codex

Before coding, Codex should: (a) read `AGENTS.md` files; (b) review source paths in §1; (c) run initial `npm run lint`, `npm run test`, `npm run build` if local dependencies available; (d) state any baseline failures and source-vs-spec discrepancies; (e) produce phase 0 design contracts. Do not generate official BCD until gate approval.

After each phase, Codex must report **files changed; migrations; exact API shapes; tests/commands run and pass/fail; risks; remaining blockers** and request confirmation before irreversible changes or any production migration. Do not remove or weaken test cases to make CI green.

**No fiscal compliance claim is warranted** from the historical 2007 FAC document and one BCD example. The attachments support **business modeling and test fixtures**, not a complete legal filing specification for purchases in October 2026.

---

## 14. Definition of done for the overall module

The module is functionally complete when a permitted internal user can:

1. Pick a company/quarter and see a fast, accurate scoped dashboard.
2. Manage an authorization, several BCs, exactly one supplier per BC, and invoices with one BC each.
3. Add standalone invoices, discover/link existing Stock invoices, and safely synchronize shared fields in **both directions** without breaking multi-line Stock transactions.
4. Import both Excel formats and the recognized sample BCD, preview/deduplicate/reconcile with raw-value preservation.
5. Reuse existing company documents, request missing pieces, and preserve evidence across filings.
6. Compare exact money totals with visible calculation and manually corrected TVA, with individual warnings and auditor review.
7. Approve a quarter with admin/team-manager permissions and immutable versioned detail snapshots.
8. Download consistent Excel/PDF, use gated test BCD and (after Format Gate) certified official BCD profile.
9. Record submission/acceptance/rejection evidence, create corrective versions and inspect complete history.
10. Receive internal reminders according to configured scheduling, without client-side access to the module.
11. Pass all original application tests plus Apurement-specific security, sync, import, arithmetic and export tests.

**Definition of production-ready BCD** additionally requires a verified current **official purchase BCD schema**, an approved **rounding/footer policy**, complete invoice dates/identities, proven export validity and a documented sign-off. Until then the core module can be delivered, but official export stays disabled.
