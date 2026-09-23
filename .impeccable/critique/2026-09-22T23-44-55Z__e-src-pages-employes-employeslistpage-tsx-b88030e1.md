---
target_identity: "file:C:\\Users\\Dhib\\Documents\\GitHub\\camconsult\\app comptabole\\src\\pages\\employes\\EmployesListPage.tsx"
target_fingerprint: "sha256:4482e9b73be5e3d8e954487be3ac7868fa0d9e6884c180786271f68914595e3a"
target_path: "C:\\Users\\Dhib\\Documents\\GitHub\\camconsult\\app comptabole\\src\\pages\\employes\\EmployesListPage.tsx"
timestamp: 2026-09-22T23-44-55Z
slug: e-src-pages-employes-employeslistpage-tsx-b88030e1
---
## High-value issues

1. The page suppresses its visible page identity and begins with generic ledger
   chrome. Add a compact Team Ledger identity region with only existing,
   meaningful aggregate markers; keep it quieter than Dashboard.
2. The register allocates a major column to a recoverable password while
   assigned-company and permission context live in expansion. Reprioritize
   future visible columns around collaborator identity, role, assigned-company
   scope, access summary, status and quiet actions.
3. Current employee passwords are stored, returned, displayed, copied and used
   as plaintext credentials. This is a security/authentication concern, not a
   masking-polish concern. Plan a separately authorized hashing/reset/invite
   migration before removing password reveal/copy from the UI.
4. Type colors misuse semantic tokens and account-active status pulses without
   authoritative presence information. Use controlled non-semantic type cues;
   retain marker-plus-text account status without a live-activity implication.
5. Mobile has elevated cards, hidden overflow affordances and no selection mode.
   Future mobile work should use a compact Team Ledger list with a visible menu,
   explicit selection state and FAB only outside that state.

## Credential/account finding

`Employe.motDePasse` is the employee's current plaintext/recoverable login
credential: it is persisted in `employes.mot_de_passe`, returned by employee
DTOs and the admin-gated employee endpoint, checked with direct equality at
login, included in the welcome email, and passed to `PasswordCell`, which can
reveal and copy it. It is not a temporary or demo-only field.

## Proposed Team Ledger information hierarchy

Direct: collaborator identity, role/type, email, assigned-society scope/count,
an existing derived open-task count if needed, access summary, account status,
and quiet row actions. Secondary: full society names, individual permission
labels, creation metadata and account-management detail. Credentials require a
separate hardened account workflow rather than normal register presentation.

## Expansion assessment

Expansion is useful only for genuinely secondary assignment and permission
detail. Frequently scanned scope/access facts should be direct. Existing quick
scope preview currently truncates at three societies without an overflow count;
do not retain expansion solely because it exists.

## Mobile assessment

Retain a domain-specific mobile renderer rather than the desktop table. Make the
row overflow independently visible/focusable, avoid nested interactive card
semantics, preserve equivalent safe bulk management through explicit selection,
and use a single create FAB only when not selecting.

## Keep as-is

Admin-only routing and server enforcement, internal-collaborator filtering,
search/type/status filters, marker-plus-text statuses, existing validated forms,
confirmed destructive actions, journal logging, real bulk operations and use of
shared bootstrap data are sound foundations.

## Suggested implementation scope

- `app comptabole/src/pages/employes/EmployesListPage.tsx`
- `app comptabole/src/components/ledger/LedgerPageHeader.tsx`
- `app comptabole/src/components/ledger/LedgerToolbar.tsx`
- `app comptabole/src/components/ledger/LedgerTable.tsx`
- `app comptabole/src/components/ledger/StatusDot.tsx`
- `app comptabole/src/components/common/PasswordCell.tsx`
- `app comptabole/src/pages/employes/EmployeViewSheet.tsx`
- A separately authorized credential-security change would also require
  `server/routes/employes.js`, `server/routes/auth.js`, `server/mappers.js`,
  `server/schema.sql` and `server/mailer.js`.
