---
name: CamConsult
description: The Trusted Ledger — a premium navy-and-gold identity adapted for calm, precise accounting work.
colors:
  navy: "#0B2545"
  gold: "#C9A96A"
  background: "#F8F7F4"
  foreground: "#1A1A1A"
  surface: "#FFFFFF"
  secondary-surface: "#EEF0F2"
  muted-surface: "#F0EFEC"
  muted-foreground: "#667080"
  border: "#E3E0D9"
  input-border: "#D8D5CE"
  soft-gold-surface: "#F5ECD9"
  warm-highlight-surface: "#FBF4E6"
  success: "hsl(160 84% 33%)"
  warning: "hsl(33 92% 45%)"
  destructive: "hsl(0 72% 45%)"
typography:
  display:
    fontFamily: "Playfair Display, Georgia, serif"
    fontSize: "3rem"
    fontWeight: 400
    lineHeight: "0.98"
  headline:
    fontFamily: "Playfair Display, Georgia, serif"
    fontSize: "2.25rem"
    fontWeight: 400
    lineHeight: "1.25"
  body:
    fontFamily: "Inter, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
  label:
    fontFamily: "Inter, Arial, sans-serif"
    fontSize: "0.7rem"
    fontWeight: 700
    letterSpacing: "0.24em"
rounded:
  sharp: "0.2rem"
  field: "0.25rem"
  medium: "0.375rem"
  component: "0.5rem"
  pill: "999px"
spacing:
  control: "0.5rem"
  card: "1.5rem"
  page-mobile: "1.5rem"
  page-tablet: "2.5rem"
  page-desktop: "4rem"
  section-mobile: "5rem"
  section-desktop: "7rem"
components:
  button-primary:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.navy}"
    rounded: "{rounded.component}"
    height: "2rem"
    padding: "0 0.625rem"
  button-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.component}"
    height: "2rem"
    padding: "0 0.625rem"
  field:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.field}"
    padding: "0.7rem 0.8rem"
---

# Design System: CamConsult

## Overview

**Creative North Star: "The Trusted Ledger"**

CamConsult pairs the calm authority of a professional ledger with the restraint
of a premium advisory firm. Its public site establishes the identity; the
authenticated product transfers its navy ink, measured gold, serif/sans
relationship and fine-rule surfaces without reproducing editorial marketing
layouts.

The product UI is operational first: compact, disciplined and easy to scan.
Brand expression belongs in emphasis, hierarchy and carefully rationed accents,
not oversized type, decorative gradients or broad empty space.

**Key Characteristics:**

- Navy-led clarity with gold as a controlled mark of importance.
- Editorial display type for rare major headings; Inter for all working UI.
- Warm paper-like backgrounds, white working surfaces and fine neutral rules.
- Responsive marketing layouts may breathe; authenticated interfaces stay dense.

## Colors

The normative values are in the frontmatter, extracted from
`camconsult/app/globals.css`; authenticated semantic-state values are extracted
from `app comptabole/src/index.css` and are intentionally separate from brand
accent roles.

### Primary

- **Cabinet Navy:** the identity ink for strong text, dark surfaces, structural
  emphasis and product primary actions where frequent action needs a stable,
  high-contrast treatment.
- **CamConsult Gold:** the public-site primary/accent for CTAs, key icons,
  eyebrows, active indicators and restrained highlights. Gold pairs with navy
  text or navy surroundings.

### Secondary

- **Warm Paper and White Surface:** quiet application/page canvas and working
  surface layers.
- **Soft Gold and Warm Highlight:** low-emphasis informational panels or
  decorative support, never a substitute for a warning state.

### Neutral

- **Charcoal Foreground:** default readable copy.
- **Slate Muted Foreground:** secondary metadata and supporting descriptions.
- **Fine Rule and Input Rule:** low-contrast separation for cards, tables and
  fields.

### Named Rules

**The Gold Is Not Warning Rule.** Gold is a CamConsult brand accent. Pending,
warning, success, destructive/overdue and informational states use their own
semantic tokens and always retain a text or icon cue.

**The Ink Before Ornament Rule.** Use navy or neutral typography to carry
meaning; gold signals emphasis rather than becoming paragraph text or a
high-frequency background.

## Typography

**Display Font:** Playfair Display, with Georgia serif fallback.

**Body Font:** Inter, with Arial sans-serif fallback.

**Character:** Playfair gives major brand moments a considered advisory tone;
Inter keeps navigation, tables, forms, buttons, badges, KPIs and charts fast to
read.

### Hierarchy

- **Display:** the public hero ranges from 3rem on mobile to 4.5rem at `sm` and
  6rem at `lg`, with 0.98 line-height. In the product, reserve display type for
  major page or brand headings only.
- **Headline:** the public section headline is 2.25rem, rising to 3rem at `sm`;
  use this relationship sparingly in the product.
- **Title:** Playfair titles commonly use 1.25rem to 1.5rem with tight leading;
  operational card/table titles should normally remain Inter.
- **Body:** public reading copy is Inter at 0.875rem to 1rem, usually with 1.5
  to 1.75 line-height. Dense product content favors the smaller end.
- **Label:** Inter labels use 700 weight; public eyebrows are 0.7rem, uppercase
  and tracked at 0.24em. Product labels should use the relationship, not the
  marketing-page scale by default.

### Named Rules

**The Working Sans Rule.** Any content scanned repeatedly or compared in rows—
navigation, data, fields, actions, metrics and charts—uses Inter, not Playfair.

## Layout

The public site uses spacious section rhythm: horizontal page padding grows from
1.5rem to 2.5rem to 4rem across mobile, `sm` and `lg`; standard sections grow
from 5rem to 7rem vertically; wide content is commonly constrained to `max-w-7xl`.
The header uses its own compact responsive rail and only shows the full desktop
navigation at `2xl`.

The authenticated app inherits the alignment discipline but not the marketing
spaciousness. Use compact page padding, `w-full`, `min-w-0`, dense grids and
12–16px outer spacing. Desktop tables remain dense; mobile uses a domain-specific
compact renderer rather than page-level horizontal overflow. The product Sidebar
switches to mobile below 1024px.

## Elevation & Depth

The public system is primarily rule-and-surface based. Cards are flat at rest;
depth is reserved for a scrolled header, a popover, portal access, or a hovered
marketing card. The exact source shadows are captured in the sidecar; product
surfaces should use the existing subtle `card`, `card-hover` and `pop` shadows,
not ambient shadow on every panel.

### Named Rules

**The Flat Working Surface Rule.** In authenticated workspaces, borders and
surface contrast establish hierarchy first. Elevation is an interaction or
overlay signal, not default decoration.

## Shapes

CamConsult favors finely rounded, restrained forms. Public source declares a
0.2rem sharp detail radius, 0.25rem fields, 0.375rem medium controls and 0.5rem
component corners; pills and avatar-like controls are fully rounded. Borders are
generally one pixel and quiet. Menus can be more generously rounded to signal a
floating layer.

For the product, use established shadcn component radii rather than forcing
marketing-card shapes into every data surface. Tables, cards and form rows should
feel orderly and compact; badges, chips and status controls may use pill forms.

## Components

### Buttons

Public primary buttons use gold with navy text, uppercase Inter labels and a
short state transition. The installed button primitive has a compact 2rem default
height and 0.625rem horizontal padding; public landing CTAs deliberately expand
to 1.5rem × 1rem padding. Product buttons should use the compact primitive by
default and reserve landing-CTA scale for exceptional product moments.

Primary action in the authenticated workspace may be navy for frequent actions;
gold remains the recognisable accent for selected, highlighted or brand-forward
actions. Outline/ghost actions use a light surface and fine rule, then darken
through navy/muted hover treatment. Focus uses the gold ring.

### Cards / Containers

Public cards use white or warm-paper surfaces, one-pixel fine rules and usually
1.5rem internal padding. Hovered editorial cards may lift slightly and acquire a
gold rule. Product cards should retain the surface/rule language while using
compact padding and minimal elevation.

### Inputs / Fields

Public fields are warm-paper filled with a fine input rule, 0.25rem corners and
0.7rem × 0.8rem padding. Focus shifts the rule to gold and applies the source
gold focus halo. Keep this identity in product fields while using existing shadcn
APIs and semantic invalid/disabled states.

### Navigation

Public navigation is uppercase Inter with a small, bold tracked label and a gold
active underline. Its header changes between navy and translucent white states.
The product translates that to a stable operational shell: navy navigation
surfaces, explicit active state, visible labels/tooltips and compact mobile
off-canvas behavior—not a marketing header.

### Links, Badges and Charts

Text links are navy, bold, uppercase and tracked in public calls to action; they
turn gold on hover. Gold badges pair gold fill with navy text. Product charts use
the same restrained family but must retain labels/legends and semantic state
colors; no chart or badge may depend on color alone.

## Do's and Don'ts

### Do:

- **Do** use the frontmatter tokens as the canonical brand reference.
- **Do** reserve Playfair for major headings and use Inter for operational UI.
- **Do** use gold as a small, confident brand accent paired with navy.
- **Do** keep product cards, forms, tables and navigation compact, bordered and
  easy to scan.
- **Do** preserve distinct semantic success, warning, destructive/overdue and
  informational treatments in the authenticated app.

### Don't:

- **Don't** copy public hero spacing, editorial card scale or promotional motion
  into the accounting workspace.
- **Don't** use gold to mean warning, overdue or generic status.
- **Don't** use Playfair in tables, forms, buttons, navigation, badges, KPIs or
  charts.
- **Don't** replace fine rules with heavy shadows or arbitrary colorful surfaces.
- **Don't** communicate a product state with color alone.
