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

- Typical outer spacing: 12–16 px (`p-3`, `p-4`).
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
- **Client Ledger:** operational registries such as Sociétés use a quieter
  compact navy identity banner, contextual inline metrics, dominant search,
  secondary filters/tools, fine row rules and nearby pagination. They are not
  generic admin tables or dashboards.
- **Workflow/process:** Tâches and Collectes foreground state, next action and
  direct operational facts. Financial pages foreground numeric alignment and
  precision. Do not copy a Dashboard command surface into every module.

A banner is shared grammar, not one fixed component: command pages may be
stronger; operational registries use the smaller identity treatment that matches
their task.

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

- Mobile is an intentional recomposition, not squeezed desktop. Use a
  domain-specific compact row/list renderer with equivalent data and actions
  when the table cannot fit naturally.
- Preserve all role-appropriate Dashboard tabs in an accessible horizontally
  scrollable ledger rail; never silently remove a tab because of width.
- Keep `min-w-0` on flex/grid children, constrain text appropriately and verify
  that no page-level horizontal overflow is introduced.
- A mobile-only create FAB is appropriate for one obvious primary action; hide
  it while selection mode is active and retain an explicit selection exit.

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
