---
target: current Dashboard in app comptabole/
total_score: 29
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:C:\\Users\\Dhib\\Documents\\GitHub\\camconsult\\app comptabole\\src\\pages\\DashboardPage.tsx"
target_fingerprint: "sha256:7258c7624cbf18d3c3beffbaaa11affa419526000b71e35a59bef2331d735db9"
target_path: "C:\\Users\\Dhib\\Documents\\GitHub\\camconsult\\app comptabole\\src\\pages\\DashboardPage.tsx"
timestamp: 2026-09-21T02-11-21Z
slug: app-comptabole-src-pages-dashboardpage-tsx
---
Method: dual-agent (A: /root/dashboard_design_review · B: /root/dashboard_detector_evidence)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|---|---:|---|
| 1 | Visibility of System Status | 3 | Loading/retry states are clear, but urgency and freshness are not foregrounded on arrival. |
| 2 | Match System / Real World | 4 | Real collection statuses, deadlines and scoped accounting language are used. |
| 3 | User Control and Freedom | 3 | URL tabs/direct routes work; creation-labelled actions only open destination lists. |
| 4 | Consistency and Standards | 4 | Shared cards, badges, separators, icons and tabs are used consistently. |
| 5 | Error Prevention | 3 | Permission-aware actions exist, but creation labels can create a false expectation. |
| 6 | Recognition Rather Than Recall | 3 | Labels help; peer tabs and nested activity tabs create location memory work. |
| 7 | Flexibility and Efficiency | 2 | No visible dashboard shortcuts, saved views, filters or in-context triage actions. |
| 8 | Aesthetic and Minimalist Design | 3 | Calm and compact, but similarly weighted cards dilute the first decision. |
| 9 | Error Recovery | 3 | Collection failure has retry; other freshness/error signals are not surfaced here. |
| 10 | Help and Documentation | 1 | No contextual explanation of priority ordering, statuses or first use. |
| **Total** | | **29/40** | **Good foundation; command-center prioritization needs work.** |

## Design Specificity Verdict

Moderately specific. The role-aware priority and deadline model is genuinely
cabinet-oriented, but the visual presentation is mostly a generic shadcn
dashboard composition. The Trusted Ledger is expressed through restraint rather
than a distinctive operational hierarchy.

The deterministic scan of `app comptabole/src/pages/DashboardPage.tsx` returned
zero findings. Browser rendering could not be verified: a fresh tab to the local
Dashboard failed with `net::ERR_CONNECTION_REFUSED`, and no mutation/injection
surface was available for an overlay.

## What's Working

- The role split gives company employees a genuinely scoped workspace instead of
  a reduced admin dashboard.
- Deadline and attention rules reflect real operations, with labels and badges
  that retain meaning beyond color.
- Compact working cards, separators and modest surfaces fit the Trusted Ledger
  better than a marketing-led dashboard would.

## Critical

No P0 blocking issue was found.

## High value

### P1 — Urgency is not the first visual decision

- **Current issue:** `OverviewTab` gives Priorités and task progress equal visual
  weight. Overdue and today counts become explicit only in Échéances.
- **Why it matters:** An administrator can scan a reassuring task total before
  seeing a deadline that requires immediate action.
- **Recommended change:** Add a compact, direct-action urgency strip from the
  existing attention/deadline data; place task distribution below it.
- **Affected components:** `DashboardKpiGrid`, `KpiCard`, `OverviewTab`,
  `DeadlinesTab`, `AttentionList`.

### P1 — Quick actions promise creation but only open lists

- **Current issue:** Nouvelle tâche, Nouvelle collecte and Nouveau bordereau
  navigate to list routes rather than a verified creation entry point.
- **Why it matters:** The verb creates a false expectation and costs a frequent
  user another interaction.
- **Recommended change:** Either rename the actions to the destination actually
  opened or invoke existing authorized creation entry points only where they
  already exist.
- **Affected components:** `DashboardQuickActions`.

### P2 — Too many competing navigation models

- **Current issue:** Role tabs, nested activity tabs, list arrows and Voir tout
  links each change context differently.
- **Why it matters:** Users must remember where a data type lives rather than
  following a single predictable hierarchy.
- **Recommended change:** Keep URL-addressable tabs, but reduce the nested
  activity dependency: use a compact chronological feed or a clearer persistent
  activity filter.
- **Affected components:** `DashboardTabs`, `ActivityTab`, `OverviewTab`.

### P2 — Relative team bars risk being read as capacity

- **Current issue:** `TeamWorkloadChart` normalizes each bar to the current
  maximum workload without capacity targets.
- **Why it matters:** A full bar means only highest on this page, but can be read
  as overloaded.
- **Recommended change:** State that the bars are relative to the current maximum
  and prioritize the real sorted task counts. Do not invent capacity metrics.
- **Affected components:** `TeamTab`, `TeamWorkloadChart`.

## Polish

### P2 — Empty states reassure without orienting

- **Current issue:** Aucune… and Tout est à jour states do not distinguish a
  healthy empty scope from missing onboarding/data.
- **Why it matters:** First-time users do not know the next legitimate action.
- **Recommended change:** Add one concise, permission-safe explanation and one
  existing authorized route/action where relevant.
- **Affected components:** `DashboardEmptyState`, `ClientOverviewTab`,
  `ClientCollectionsTab`, dashboard charts.

### P3 — Mobile urgency and inactive insights need clearer affordance

- **Current issue:** Deadline status badge disappears below `sm`; inactive client
  insight rows look close to actionable rows.
- **Why it matters:** On a small screen, urgency and actionability are less
  obvious.
- **Recommended change:** Preserve a text urgency cue on mobile and give inactive
  insights a quieter, non-clickable visual treatment.
- **Affected components:** `DeadlineList`, `ClientOverviewTab`.

### P3 — Trusted Ledger expression can be more intentional

- **Current issue:** The Dashboard is clean but remains visually interchangeable
  with a generic AI-SaaS dashboard.
- **Why it matters:** It underuses the public CamConsult identity without needing
  marketing layouts.
- **Recommended change:** Add a restrained navy/gold ledger cue in the compact
  header and use fine-rule hierarchy, not decorative hero treatment or Playfair
  in dense content.
- **Affected components:** `DashboardHeader`, `KpiCard`, `DashboardTabs`.

## Persona Red Flags

- **Alex, power user:** highest-risk work is one tab away; quick actions add a
  navigation hop; no visible shortcut or in-context triage path is offered.
- **Jordan, first-timer:** À traiter, collection flow and attention groups need a
  short explanation of priority and expected action.
- **Company employee:** inactive insights visually resemble available actions,
  inviting repeated unsuccessful taps.
- **Sam, keyboard/screen-reader user:** source shows labels and text-based status
  cues, but live keyboard order, focus visibility and zoom behavior remain
  unverified without a running Dashboard.

## Minor Observations

- Team and online-status dots are very small at dashboard density.
- Warning/success support text can be made more legible without turning brand gold
  into a semantic status color.
- The generic sans heading is right for operations; a restrained header cue is
  safer than spreading Playfair into working UI.

## Questions to Consider

- What is the one item an administrator must act on within five seconds?
- Should a quick action ever say Nouvelle when it cannot start creation?
- Should Activity be a supporting audit trail rather than a peer to Échéances?
