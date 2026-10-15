# Public website color system

Scope: the public Next.js website only. Color definitions live in
[app/globals.css](app/globals.css). The authenticated product has its own design
system and is not changed by this work.

## Logo evidence and audit

The four existing PNG assets were inspected visually and sampled on a two-pixel
grid, retaining pixels with alpha >= 250 to exclude transparency and most edge
antialiasing. Dominant opaque colors were:

| Asset | Dimensions | Exact colors |
| --- | --- | --- |
| `public/brand/logo-cabinet-navy.png` | 1500 × 382 | `#0B2545` (57,818 samples) |
| `public/brand/logo-cabinet-white.png` | 1500 × 382 | `#FFFFFF` (57,818 samples) |
| `public/brand/logo-mark-light.png` | 240 × 241 | `#0B2545` (7,612), `#FEF4E8` (462) |
| `public/brand/logo-mark-dark.png` | 240 × 241 | `#FEF4E8` (7,612 samples) |

Navy is the primary brand color. Ivory is the supporting warm neutral; white
belongs to the reversed wordmark. The assets contain no gold or teal. The
previous gold accents therefore gave way to navy and restrained blue derivatives.
Green, amber and red are reserved for status meaning and labeled chart data.

The existing `.dark` class, localStorage preference, system preference listener,
and pre-paint initialization remain the single theme mechanism. The audit found
literal RGBA shadows, fixed emerald utilities, faint chart bars, weak input
boundaries, and different focus treatments. These now use semantic tokens.

## Palette

Hex values below are the resolved colors. Alias tokens share their source role.

| Role / token | Light | Dark |
| --- | --- | --- |
| `background` | `#F4F3EF` | `#101C2A` |
| `foreground` | `#20374D` | `#E6EBEF` |
| `card`, `surface` | `#FCFBF8` | `#192B3D` |
| `elevated`, `popover` | `#FFFFFF` | `#22384E` |
| `primary`, `accent` | `#0B2545` | `#AAC5DF` |
| `primary-foreground`, `accent-foreground` | `#F8F5EF` | `#0B2545` |
| `primary-hover`, `accent-hover` | `#254564` | `#C3D6E7` |
| `accent-ink` | `#285378` | `#BAD0E3` |
| `accent-soft` | `#E2EAF0` | `#263B50` |
| `secondary` | `#E3E8EB` | `#263D52` |
| `muted` | `#ECEDE9` | `#162638` |
| `muted-foreground` | `#4B6070` | `#B6C5D1` |
| `border`, `divider` | `#CBD3D8` | `#3B5268` |
| `input` | `#748695` | `#7D95AA` |
| `ring` | `#35658D` | `#A9CCE8` |
| `feature` | `#E8EDF0` | `#20354D` |
| `feature-raised` | `#F2F4F4` | `#294159` |
| `feature-foreground` | `#20374D` | `#E6EBEF` |
| `feature-muted` | `#3C5265` | `#D1DEE8` |
| `feature-input` | `#607485` | `#91A9BE` |
| `slate` (calendar tile) | `#A5B5C3` | `#A5B5C3` |
| `success` | `#246549` | `#9BCDB1` |
| `success-foreground` | `#F5F8F5` | `#102A1D` |
| `warning` | `#8B4E25` | `#E1BD92` |
| `destructive` (error) | `#A03F3A` | `#E8A8A1` |
| `info` | `#285378` | `#AACBE6` |
| `disabled` | `#DFE4E7` | `#304356` |
| `disabled-foreground` | `#536675` | `#B4C3D0` |
| `chart-1` | `#285378` | `#AAC5DF` |
| `chart-2` | `#526C84` | `#8FAABF` |
| `chart-3` | `#8B4E25` | `#E1BD92` |
| `chart-4` | `#246549` | `#9BCDB1` |
| `chart-track` | `#E6EBEF` | `#30475C` |
| `scrim` | `#08182A` | `#08182A` |
| `shadow` | `#0B2545` | `#050E1A` |

`shadow-color` uses 10% opacity in light mode and 28% in dark mode. Standard
shadows plus `panel`, `header`, `hover`, `pop` and the inset field boundary are
defined centrally. The existing hero grid and folded-paper gradient also use
central variables. Selection uses the accent fill/foreground pair; carets use
accent ink. Focus rings use their own contrasting color rather than an arbitrary
opacity of the decorative accent.

`.brand-footer` applies the dark surface roles in both themes. Its existing white
wordmark stays legible. The header uses the original navy/white variants according
to the page theme. No logo files, dimensions, filters or proportions were changed.

## Implementation coverage

- Shared header, language menu, mobile navigation, footer, theme switch and back
  to top; shared button variants and client portal links.
- Home hero and balance sheet, services, about/balance section, method charts,
  calculators, deadlines, FAQ, newsletter, contact section and CTA band.
- Services and service detail, contact, careers, tax tools/calendar, blog,
  resources/download dialog, and all legal pages including the cookie policy.
- Browser theme color follows the computed CSS theme in the pre-paint script and
  on preference changes. The two viewport fallback hex values in the root layout
  intentionally mirror `feature` for clients without JavaScript.

Typography, content, translations, routes and business logic are preserved. The
only layout adjustment lets the footer reminder row wrap when translated text
exceeds the available tablet width. Reduced-motion styles disable smooth scroll
and nonessential CSS transitions/animations; existing component motion guards
remain in place. Keyboard focus also outlines labels for visually hidden inputs.

## Validation and limits

Run the available checks from this directory:

```text
npm run typecheck
npm run build
npm run check:seo
git diff --check
```

For a local production preview, set `SEO_BASE_URL=http://127.0.0.1:3100` before
the SEO check. This project currently defines no lint or unit-test script.

Browser verification covers French, English and Arabic/RTL, both themes, and
1440, 768 and 390 pixel widths. The review includes 12 routes, calculator tabs,
method steps, menus, the resource dialog, hover/focus/invalid/disabled states,
chart boundaries, preference persistence and first paint. Text targets are 4.5:1
for normal text and 3:1 for large text; meaningful tested field boundaries and
chart marks target 3:1. Decorative separators intentionally use lower contrast.
This is a targeted visual/accessibility check, not a full WCAG certification.

There is a cookie-policy page but no cookie-consent component in this repository.
No consent workflow was invented. Existing contact, newsletter and download
workflows are preserved; this styling work does not add backend integrations.
The build's existing Next.js middleware-to-proxy deprecation warning remains.
Safari/Firefox and real-device checks remain manual release checks. Changes are
local until committed and deployed.
