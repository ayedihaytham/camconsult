# Design System

This is the concise canonical guide for the authenticated application. The
implementation tokens live in `app comptabole/src/index.css` and
`app comptabole/tailwind.config.js`.

## Direction and density

CamConsult is a professional, compact accounting interface. Favor clear
hierarchy and scanability over decorative whitespace.

- Typical outer spacing: 12–16 px (`p-3`, `p-4`).
- Typical section gaps: `gap-3` or `gap-4`.
- Typical card content padding: `p-4` where appropriate.
- Keep controls and empty states compact.

## Width and responsive layout

- Prefer `w-full` and `min-w-0` in page, flex and grid containers.
- Avoid unnecessary `container`, `mx-auto` and large `max-w-*` constraints.
- Desktop may use dense tables; mobile should use a domain-specific compact
  renderer when a table cannot fit naturally.
- Do not create page-level horizontal overflow to preserve a desktop table.

## Surfaces

Use the application canvas, neutral card surfaces, muted secondary surfaces and
subtle borders. Keep shadows minimal. Avoid nesting cards unless the hierarchy
requires a distinct interactive surface.

## Color semantics

- Navy (`primary`, identity `#0B2545`): primary actions, active state and main
  emphasis.
- Gold (`accent`, identity `#C9A96A`): restrained brand accent and focus/wayfinding.
- Green (`success`): completed, validated or positive state.
- Amber (`warning`): pending, warning or attention.
- Red (`destructive`): overdue, destructive or critical state.
- Neutral/muted: supporting and secondary information.

Use semantic tokens, not random Tailwind palette colors. Status must never rely
on color alone: pair the color with text, an icon or a distinct shape.

## Typography and icons

Use Inter/sans-serif for interface copy and dense data. Playfair/serif is limited
to deliberate brand or prominent heading moments already established by shared
components. Use existing Lucide icons and include accessible labels where an icon
stands alone.

## Components

- Prefer existing shadcn primitives over custom reimplementations.
- Reuse CamConsult shared page headers, empty states, badges, row actions and
  tables when they fit.
- Use semantic `Badge` variants; do not create one-off status pills.
- Keep focus, hover, disabled and destructive states visible and consistent.

## Tables

- Desktop: dense rows, readable headers, tabular numerals for aligned numbers.
- Mobile: a domain-specific card/list renderer with the same actions and data.
- Keep status text visible; do not communicate status with a colored dot alone.
- Reuse `app comptabole/src/components/common/DataTable.tsx` rather than adding a
  second generic table abstraction.

## Charts

Use a chart only when it improves understanding. Reuse current chart/progress
infrastructure and semantic colors. Always provide labels or textual values so
color and geometry are not the sole carriers of meaning.

## Avoid

- excessive glassmorphism or gradients
- giant shadows, cards, headings or whitespace
- decorative animation
- random colors or fake charts
- unnecessary nested cards
- fixed-width hacks that break responsive layout

For repository scope and implementation rules, see [conventions.md](./conventions.md).
