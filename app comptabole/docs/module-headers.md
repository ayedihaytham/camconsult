# Shared navy page headers

The existing blue page headers use the Collecte de pièces screenshot supplied
by the user as their styling reference. The shared renderer is
[LedgerCompactHeader](../src/components/ledger/LedgerCompactHeader.tsx), with
styles in [module-banner.css](../src/components/ledger/module-banner.css).

[SignatureLedgerBanner](../src/components/ledger/SignatureLedgerBanner.tsx) and
[FinancialIdentityHeader](../src/components/ledger/FinancialIdentityHeader.tsx)
delegate to it. The Dashboard, collection register and collection editor also
use the same renderer; Stock already used LedgerCompactHeader. Existing white
page headers and the public website are outside this change.

- Navy surface, gold section label, white working-sans title and outlined
  header actions; no decorative grid, registration motif or title icon.
- Desktop: 16px top / 20px horizontal inset, 8px corners, 24px title. Phone:
  14px horizontal inset, restrained lower corners and 22px title.
- Real statistics use 20px Playfair numerals alongside uppercase labels,
  separated by fine rules. Phone statistics form two columns. Semantic tones
  and loading states remain available; dossier identifiers use smaller sans.
- Description and scope stay visible when supplied. Headers without metrics
  stay content-sized, with no empty statistics row or forced minimum height.
- Actions wrap, have visible focus and grow to 44px phone targets. Pages with
  an existing mobile create FAB hide their matching header create action via
  `operational-signature-banner`; the page still owns its permission guard.
- The collection editor keeps status, receipt progress, deadline and workflow
  controls in the footer. Its validation action retains its white emphasis.
- Existing heading levels, heading IDs, tour targets, counts, action handlers
  and role decisions remain owned by the calling page.

Legacy header-specific overrides were removed from index, dashboard and task
styles so page wrappers cannot silently change the shared presentation.

Validation: lint and production build pass; 856 tests pass and 11 are skipped.
Two suites are blocked by the existing missing Excel samples. Actual shared
renderers and the collection-editor header were previewed with labeled demo
data at 375, 768, 1024 and 1440px, including long titles, financial amounts,
loading/unavailable states and action/menu interaction. No horizontal overflow
or browser exceptions were recorded. Preview captures are ignored review
artifacts, not shipped assets or evidence of live account data.
