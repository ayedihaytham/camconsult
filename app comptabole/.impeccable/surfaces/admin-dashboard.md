# Admin Dashboard

Scope: authenticated Admin Dashboard, Operate mode. Collaborator and company dashboards retain their existing compositions. Reuse the scoped dashboard view model, loaded lists, routes and permission checks. The user confirmed a balanced overview and selected the four-part briefing in chat after automatic browser opening was blocked.

## Direction contract

THESIS: Give collections, tasks, deadlines and unread messages equal, bounded places in the first view; move full queues, team and activity into the existing tabs.

OWN-WORLD: Keep CamConsult navy, gold, neutral paper and semantic status markers. Use the existing working sans, compact outline controls, fine rules and restrained 8px working surfaces.

STORY: The administrator sees the state of work, chooses a concrete item and opens its existing workspace. Summary links lead to the corresponding complete view. Missing sources remain explicitly unavailable.

FIRST VIEWPORT: Short navy identity and actions, six clear tabs, one joined four-domain summary, boxed seven-day selector defaulting to today and a two-by-two briefing. A selected date changes its collection preview, day deadline count and subsequent deadlines; tasks and unread messages stay current because they have no collection due dates. Each desktop preview has at most three rows; phone previews show one row per domain. No oversized dossier or team/activity previews. Échéances is a Monday-first monthly calendar with an adjacent selected-day panel, stacking on narrow screens.

FORM: Four-part briefing, grounded candidate 1, selected explicitly by the user. Surface seed 9c56a9d2. Code-led implementation; no raster assets needed. Signature interaction: select a calendar date to reveal its real collection deadlines and open the chosen collection, with keyboard and month navigation.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

Global DESIGN.md remains authoritative: this is a scoped composition change, not a replacement brand system. Implementation documentation belongs inside this application.

## Finish and documentation evidence

Finish disposition: **ship**, with no material fixes, against the established
global DESIGN.md. The review covers all six tabs at 375, 768, 1024 and 1440px;
screenshots live in [the review directory](../review/admin-dashboard/). These
are synthetic fixture previews, not production-account evidence. No raster
assets were generated, so shipping raster provenance is not applicable.

The documenter checked PRODUCT.md, DESIGN.md, the authenticated token source,
Tailwind font/radius mappings, the button primitive, Admin and calendar styles,
overview/tasks/team/calendar components and representative final screenshots.
Global product/design documents and their sidecar remain unchanged; this
extends the existing world without creating new global tokens.

Shipped behavior and validation are recorded in
[Admin Dashboard](../../docs/admin-dashboard.md). That document supersedes the
older Admin composition in the global Dashboard guide while preserving its
shared rules and collaborator/company authority. Pre-existing global
composition prose and public/authenticated button-description differences are
reported there, not canonized or repaired.
