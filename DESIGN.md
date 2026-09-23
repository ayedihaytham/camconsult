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
  authenticated-heading:
    fontFamily: "Inter, Arial, sans-serif"
    fontWeight: 700
    lineHeight: "1.2"
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

CamConsult is a modern financial workspace: precise, trustworthy, confident,
calm, sophisticated and highly scannable. The public site remains the source of
brand identity; the authenticated product translates navy ink, measured gold,
warm paper and fine rules into a dense accounting workstation rather than a
marketing experience.

The product is operational first. Workflow value wins over visual novelty;
brand expression belongs in hierarchy, alignment and carefully rationed accents,
not oversized type, decorative gradients or broad empty space.

**Key Characteristics:**

- Navy-led architectural clarity with gold as a controlled structural mark.
- Modern sans/grotesk character for authenticated headings and working UI.
- Warm paper-like backgrounds, selective light work surfaces and fine rules.
- Responsive marketing layouts may breathe; authenticated interfaces stay dense.

## Colors

The normative values are in the frontmatter, extracted from
`camconsult/app/globals.css`; authenticated semantic-state values are extracted
from `app comptabole/src/index.css` and are intentionally separate from brand
accent roles.

### Primary

- **Cabinet Navy:** architectural surface, primary product hierarchy, important
  ink, command/page identity and selected navigation architecture.
- **CamConsult Gold:** fine structural rule, selected-state accent, focus and
  restrained brand detail. Gold pairs with navy text or navy surroundings.

### Secondary

- **Warm Paper:** the quiet authenticated workspace canvas.
- **Pale Navy / Slate:** secondary working surfaces and utility contrast.
- **White / Light Surface:** selective elevation, forms and focused work areas,
  not the default wrapper for every page section.
- **Soft Gold and Warm Highlight:** low-emphasis informational support, never a
  substitute for a warning state.

### Neutral

- **Charcoal Foreground:** default readable copy.
- **Slate Muted Foreground:** secondary metadata and supporting descriptions.
- **Fine Rule and Input Rule:** low-contrast separation for cards, tables and
  fields.

### Named Rules

**The Gold Is Not Warning Rule.** Gold is a CamConsult brand accent, never a
generic warning, status replacement or large decorative page fill. Green means
active/success/completed; amber means pending/correction/warning; red means
destructive/overdue/serious error; slate carries inactive and neutral states.
Every state retains readable text or an icon cue.

**The Ink Before Ornament Rule.** Use navy or neutral typography to carry
meaning; gold signals emphasis rather than becoming paragraph text or a
high-frequency background.

## Typography

**Display Font:** Playfair Display, with Georgia serif fallback.

**Body Font:** Inter, with Arial sans-serif fallback.

**Character:** the authenticated application has a modern sans/grotesk visual
language. Inter, or the existing neutral UI sans, carries page identity,
navigation, tables, forms, buttons, metrics and dense metadata. Playfair gives
rare, explicitly editorial brand moments a considered advisory tone; it is not
the default product heading font.

### Hierarchy

- **Display:** the public hero ranges from 3rem on mobile to 4.5rem at `sm` and
  6rem at `lg`, with 0.98 line-height. In the product, reserve this display
  voice for rare brand moments only.
- **Headline:** product page identity and major authenticated headings should
  normally remain modern sans with tight, confident leading.
- **Title:** operational card, table and section titles remain Inter/sans.
- **Body:** public reading copy is Inter at 0.875rem to 1rem, usually with 1.5
  to 1.75 line-height. Dense product content favors the smaller end.
- **Label:** Inter labels use 700 weight; public eyebrows are 0.7rem, uppercase
  and tracked at 0.24em. Product labels should use the relationship, not the
  marketing-page scale by default.

### Named Rules

**The Working Sans Rule.** Anything scanned repeatedly or compared in rows—
page identity, navigation, data, fields, actions, metrics and charts—uses the
working sans, not Playfair. Codes, identifiers and aligned numeric values may
use a tabular or technical treatment where useful.

## Layout

The public site uses spacious section rhythm: horizontal page padding grows from
1.5rem to 2.5rem to 4rem across mobile, `sm` and `lg`; standard sections grow
from 5rem to 7rem vertically; wide content is commonly constrained to `max-w-7xl`.
The header uses its own compact responsive rail and only shows the full desktop
navigation at `2xl`.

The authenticated app inherits the alignment discipline but not the marketing
spaciousness. Desktop remains a workstation: use intentional outer gutters and
align the page banner, utilities and register. Mobile favors an edge-to-edge
workspace for major operational surfaces, with 12–16px of internal content
padding rather than extra outer gutters. Keep the Dashboard's distinct Command
Ledger composition. The mobile Sidebar breakpoint remains 1024px; phone-width
edge-to-edge register composition is a separate layout decision.

## Page archetypes

One CamConsult design language supports several compositions. Do not copy one
page literally into another.

### Command Ledger — Dashboard

The Dashboard is the strongest command page: a navy operational surface with
role-aware real metrics, urgency hierarchy, ledger navigation, asymmetry and
selective warm/gold work summaries. It answers what needs attention now.

### Signature Ledger — operational modules

The Signature Ledger is the shared banner language for operational modules. Its
canonical navy surface, modern sans identity, small tracked gold eyebrow,
partial gold rule and compact inline context make the page immediately
identifiable without turning it into a marketing hero. Keep a clean information
zone on the left and a low-contrast ledger/grid motif with a tiny four-square
registration detail on the right; the motif is a quiet signature, not a split
panel or illustration. A single permission-appropriate primary action may sit
in this signature zone. Metrics are contextual, inline and derived by the page;
do not force a fixed count or place KPI cards inside the banner. Keep the
information zone clean across about 55–65% of the banner and the signature zone
within the remaining 35–45%; motif presence stays around 2–5%. The four-square
registration detail is tiny and secondary, not a logo replacement or repeated
row icon.

The Dashboard remains the larger, more expressive Command Ledger. Operational
Signature Ledgers are shorter, quieter and specific to their workflow. Shared
visual language does not mean identical page composition.

#### Client Ledger — Sociétés

Emphasize the client/entity registry, direct status/context and high scanability.
Use a compact navy identity banner, contextual metrics, dominant search,
secondary filters and tools, fine ledger separators, quiet overflow actions and
semantic statuses.

#### Team Ledger — Collaborateurs

Emphasize people, access scope, assigned sociétés, work context and account
status. Keep permission and metric derivation in the module, not the shared
banner presentation.

#### Process Ledger — Collecte de pièces

Emphasize workflow queue, correction, real overdue/deadline state,
transmission/validation and the next operational action. Tâches should also
prioritize state, next action and direct workflow information, without
misrepresenting task timestamps as deadlines.

### Financial and data-heavy pages

Financial work favors precision over decoration: excellent numeric alignment,
dense readable tables, clear hierarchy, controlled brand surfaces and restrained
semantic color. Dashboard treatment is used only when it improves the task.

## Ledger rhythm and entity identity

Prefer an entity row followed by a fine rule over stacks of cards. Use
name-first hierarchy, small controlled monograms where recognition benefits,
useful metadata, category, identifier and state. Monograms are tonal CamConsult
markers, never random rainbow avatars or consumer-profile cards.

Operational tables may retain DataTable behavior internally while presenting
quiet chrome externally. Keep the first/entity column strong, promote frequently
needed operational facts into direct columns, and reserve expansion for genuinely
secondary information.

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

Cards are for self-contained content, meaningful comparison or focused work;
they are not the default wrapper for every metric, row, empty state or page
section. Prefer ledger composition, typography and rules first.

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

## Controls, selection and disclosure

Each page has one clear primary action. Search is the dominant registry utility;
filters are secondary; export, print and column controls belong in Actions or
Outils; pagination is compact and visible when it supports the workflow. Avoid
long rows of equally weighted buttons and permanent bulk controls when nothing
is selected.

Selection uses a pale warm-gold treatment, a fine gold structural cue, an
explicit count and grouped non-destructive actions. Destructive actions remain
red and separate. Statuses use a small semantic marker plus readable text;
oversized pills are unnecessary when a quieter status is sufficient.

Use expansion only for genuinely secondary information. If a fact is frequently
needed, operationally important or repeatedly accessed, expose it directly in
the register when layout allows. Primary interactions stay discoverable;
secondary row actions can live in overflow menus.

## Responsive composition

Mobile is an intentional composition, not compressed desktop. On phone-width
operational register pages, the Topbar and banner sit almost directly together
(about 0–4px separation); keep banner content internally padded, use full-width
utility/register/selection surfaces, and leave a small distinct gap after the
banner. Rows remain internally padded and separated by fine rules. Do not use a
floating card per row or introduce page-level horizontal scrolling. Desktop
retains workstation gutters. A mobile-only create action is a true circular,
approximately 52px, icon-only navy `+` FAB with an accessible action name, the
same permission visibility as its desktop equivalent, safe-area-aware placement,
and no visibility during selection mode. Selection becomes a full-width action
surface with explicit count and grouped actions. Short desktop workspaces may
use CSS to tighten vertical rhythm, never tiny type or a fixed-height register
scroller.

## Interaction and accessibility

Preserve visible focus, named icon controls, keyboard-accessible menus and tabs,
adequate touch targets, linked form labels and selected states that are not
color-only.

## Do's and Don'ts

### Do:

- **Do** use the frontmatter tokens as the canonical brand reference.
- **Do** reserve Playfair for rare brand/display moments and use the working
  sans for authenticated headings and operational UI.
- **Do** use gold as a small structural brand accent paired with navy.
- **Do** keep product forms, tables and navigation compact, ruled and easy to
  scan; use cards only when they improve hierarchy.
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
- **Don't** turn every module into a Dashboard command surface or every entity
  into a card.
- **Don't** flatten a Signature Ledger into an anonymous navy block: preserve
  its eyebrow, gold structural rule, inline context and quiet signature zone.
- **Don't** carry excess outer mobile gutters into edge-to-edge operational
  surfaces or stack redundant page/section/control padding.
- **Don't** use an extended text FAB or show the create FAB alongside the
  selection action bar.
- **Don't** hide important workflow information behind a chevron just to make a
  register look simpler.
- **Don't** use generic shadcn-looking layouts, default admin-table composition,
  pill-heavy interfaces, giant rounded wrappers, gradients, glassmorphism,
  decorative animation, rainbow entity avatars or page-level horizontal scroll.
