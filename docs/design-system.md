# Design System

This is the implementation guide for the authenticated application. The
canonical brand values are documented in [DESIGN.md](../DESIGN.md); implemented
tokens live in `app comptabole/src/index.css` and
`app comptabole/tailwind.config.js`.

## Direction and density

CamConsult is a modern, compact financial workspace. Follow **The Trusted
Ledger**: accounting clarity, calm structure, precision, trust and fast
scanability. Prefer readability, then scanability, then density; compact does
not mean cramped.

- Desktop/workstation page gutters: use the existing `p-3` / `p-4` shell rhythm
  and align the banner, utility region and register. On phone-width edge-to-edge
  register pages, outer horizontal padding is zero and the page begins directly
  below the Topbar; apply 12–16px inside content that needs a text/control inset.
- Typical section gaps: `gap-3` or `gap-4`.
- Typical bounded-content padding: `p-4` where a distinct surface is useful.
- Keep controls, empty states and rows compact; do not manufacture cards.

## Surfaces, color and responsive width

- Prefer `w-full` and `min-w-0` in page, flex and grid containers.
- Avoid unnecessary `container`, `mx-auto` and large `max-w-*` constraints.
- Desktop may use dense tables; mobile should use a domain-specific compact
  renderer when a table cannot fit naturally.
- Do not create page-level horizontal overflow to preserve a desktop table.
- Use the warm workspace canvas, white or neutral focused-work surfaces and
  subtle rules. Keep shadows minimal; a surface earns elevation only when it is
  a bounded concept, overlay or interactive layer.
- Navy (`primary`, canonical `#0B2545`) is architectural: command/page identity,
  primary hierarchy, active state and frequent primary actions.
- Gold (`accent`, canonical `#C9A96A`) is structural: fine rules, selected-state
  cues, focus and restrained brand detail. It is never a warning or a large
  default page fill.
- Green (`success`) means active, completed or validated; amber (`warning`)
  means pending, correction or attention; red (`destructive`) means overdue,
  critical or destructive; muted slate carries neutral/inactive information.

Use semantic tokens, not arbitrary Tailwind palette values. Status always pairs
its marker with readable text, an icon or another non-color cue.

## Typography and icons

Use the existing modern sans/grotesk voice—Inter or the established neutral UI
sans—for authenticated page headings, interface copy and dense data. Reserve
Playfair/serif for rare, deliberate brand/display moments; never use it in
tables, forms, navigation, buttons, badges, KPIs or charts. Use tabular numeric
styles where aligned financial values benefit, and existing Lucide icons with
accessible labels when an icon stands alone.

## Page grammar

- **Command Ledger:** Dashboard uses a compact navy command surface, greeting,
  context, fine gold rule, inline real metrics, role-aware actions and a
  ledger-style tab rail. Dashboard sections may use asymmetry and selective
  warm/gold tonal work summaries.
- **Signature Ledger:** shared banner grammar for operational modules: canonical
  navy, sans product typography, a small tracked gold module/archetype eyebrow,
  partial gold rule, contextual inline metrics and one optional
  permission-appropriate primary action. Keep the information zone clean on the
  left; the right-side low-contrast ledger/grid motif and tiny four-square
  registration detail are signature, not a hard split or illustration. The
  motif must not compete with content. Shared presentation accepts page-provided
  eyebrow, title, description, metrics, action and archetype styling; domain
  derivation and permission decisions remain in each page/module.
- **Client Ledger:** Sociétés emphasizes client/entity identity, direct status
  and context, high scanability, dominant search, secondary filters/tools and
  fine row rules.
- **Team Ledger:** Collaborateurs emphasizes people, access scope, assigned
  sociétés, work context and account status.
- **Process Ledger:** Collecte de pièces emphasizes workflow state, correction,
  actual overdue/deadline state, transmission/validation and next action. Tâches
  keeps its own real status semantics and does not invent due dates.
- Financial pages foreground numeric alignment and precision.

The archetypes share a visual grammar, not a fixed metric count or page layout.
Do not derive société statuses, collaborator permissions or collecte workflow
inside a shared presentation component.

### Signature Ledger implementation

- Reuse `app comptabole/src/components/ledger/SignatureLedgerBanner.tsx` for
  the operational banner. Keep it presentational: pages supply scoped metric
  values, semantic tones and any permission-gated action.
- Keep the module eyebrow uppercase, small, tracked and restrained gold. It
  identifies context without materially increasing banner height.
- The gold rule is a partial structural cue, not a status indicator. The
  signature zone's grid/ledger motif should remain very low contrast (roughly
  2–5% visual presence), fade toward the information area and stay behind no
  important text.
- Metrics are inline, contextual and compact; use only meaningful available
  data and do not force the same number of metrics across modules. Avoid KPI
  cards inside operational banners.
- At desktop sizes, allow one clear primary action in a restrained
  light/outlined-on-navy treatment. Do not elevate export/print or other utility
  actions to banner-primary status.
- Preserve the distinction from the Dashboard Command Ledger: the Dashboard is
  the strongest command surface; operational banners are shorter and quieter.

## Components

- Prefer existing shadcn primitives over custom reimplementations.
- Reuse CamConsult shared page headers, empty states, badges, row actions and
  tables when they fit.
- Use compact marker-plus-text status treatments when possible; avoid oversized
  one-off status pills.
- Keep focus, hover, disabled and destructive states visible and consistent.
- Cards are for self-contained concepts, meaningful comparison or focused work;
  do not wrap every row, metric or empty state in a card.

## Registries, toolbars and selection

- Preserve existing DataTable behavior and reuse
  `app comptabole/src/components/data-table/DataTable.tsx`; do not create a
  second generic table abstraction.
- Give entity/name columns clear priority, keep direct operational facts visible
  and reserve expansion for genuinely secondary information. Use fine ledger
  separators, quiet overflow actions and controlled tonal monograms—not rainbow
  consumer-style avatars.
- Search is the dominant registry utility. Filters are secondary; low-frequency
  export, print and column controls belong in Actions/Outils. Keep one obvious
  primary create action rather than a row of equally weighted controls.
- Place pagination close to its register controls when it supports the flow.
- Selection uses a pale warm-gold row treatment, fine gold cue, explicit count
  and grouped safe actions. Keep destructive actions red and distinct.

## Mobile composition

- **Edge-to-edge operational workspace:** at phone widths, major adopted
  register surfaces (banner, utility/search region, register/list and selection
  surface) may span the available width. This is zero unnecessary outer
  horizontal page gutter, not zero content padding: retain roughly 12–16px
  inside text/control regions and row content. Do not stack page, section,
  wrapper and control padding redundantly.
- **Topbar and banner:** target about 0–4px outer separation on phone widths so
  the banner connects to the shell. Keep its internal padding. Use square or
  very restrained top corners and only a modest lower radius; leave roughly
  6–8px before the utility/search working zone. Do not apply this phone spacing
  to desktop, which keeps its workstation gutters and breathing room.
- Prefer a shared authenticated shell/page-section mechanism for edge-to-edge
  surfaces instead of page-by-page negative margins. Current opt-in shell paths
  are `/societes`, `/employes` and `/collectes`; `AppLayout` applies
  `px-0 pt-0 pb-2` below `sm` and restores `sm:p-4` at 640px. The shared
  Sidebar's mobile breakpoint (1024px) is independent from this phone-width
  edge-to-edge rule.
- Mobile registers are full-width ledger surfaces, not compressed desktop
  tables or floating cards per row. Use fine separators and internally padded
  rows. Keep utility controls usable, preserve equivalent actions and avoid
  page-level horizontal scrolling.
- Mobile is an intentional recomposition, not squeezed desktop. Use a
  domain-specific compact row/list renderer with equivalent data and actions
  when the table cannot fit naturally.
- Preserve all role-appropriate Dashboard tabs in an accessible horizontally
  scrollable ledger rail; never silently remove a tab because of width.
- Keep `min-w-0` on flex/grid children, constrain text appropriately and verify
  that no page-level horizontal overflow is introduced.
- For one obvious create action, use the shared
  `app comptabole/src/components/ledger/OperationalFab.tsx` presentation where
  appropriate: an approximately 52px true circle, navy surface, white icon-only
  `+`, fixed lower-right placement, restrained shadow and safe-area-aware bottom
  offset (`env(safe-area-inset-bottom)`). Provide a module-specific accessible
  name (for example, “Ajouter une société”); the icon alone is not a name.
- The page owns its create permission. The mobile FAB must inherit exactly the
  desktop primary action's visibility rule; the shared FAB must not calculate
  permissions. Hide it during selection mode, when the full-width bottom
  selection action surface takes precedence. Never display both together.
- On short desktop workspaces, tighten vertical padding and gaps with CSS, not
  tiny type, fixed-height table scrollers or JavaScript viewport measurement.

## Interaction and accessibility

- Visible focus follows the existing gold ring treatment; gold focus is not a
  warning state.
- Preserve keyboard-accessible menus, tabs, selection and dialogs; name
  icon-only controls and retain linked form labels.
- Maintain adequate touch targets and do not make active, selected or disabled
  states color-only.

## Charts

Use a chart only when it improves understanding. Reuse current chart/progress
infrastructure and semantic colors. Always provide labels or textual values so
color and geometry are not the sole carriers of meaning.

## Avoid

- generic shadcn/default-admin composition, pill-heavy interfaces or a card grid
  when ledger rows and rules better express the work
- excessive glassmorphism, gradients, giant shadows, headings or whitespace
- gold-as-warning semantics, random colors, fake charts or rainbow avatars
- decorative animation, unnecessary nested cards or hidden high-frequency facts
- fixed-width hacks, clipped controls or desktop tables that create page-level
  horizontal overflow on mobile
- marketing-page hero scale inside operational authenticated pages

For repository scope and implementation rules, see [conventions.md](./conventions.md).
