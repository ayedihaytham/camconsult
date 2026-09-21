---
target_identity: "file:C:\\Users\\Dhib\\Documents\\GitHub\\camconsult\\app comptabole\\src\\components\\layout\\AppLayout.tsx"
target_fingerprint: "sha256:41716110cd63a6967f11085b8b0b14f965d5adbe98562ee4a9837c9453799c90"
target_path: "C:\\Users\\Dhib\\Documents\\GitHub\\camconsult\\app comptabole\\src\\components\\layout\\AppLayout.tsx"
timestamp: 2026-09-21T16-04-30Z
slug: app-comptabole-src-components-layout-applayout-tsx
---
### High-value improvements

1. Collapsed navigation hides unread indicators for Messagerie and pending items. Preserve current data, but retain a compact visible dot/count beside the relevant icon in collapsed mode. Affects `SidebarNavigation.tsx` and `ui/sidebar.tsx`.
2. The account avatar always displays a green presence indicator without an authoritative presence source. Remove it unless backed by real state. Affects `Topbar.tsx`.
3. The account trigger lacks a visible desktop disclosure cue and an explicit accessible name when it reduces to initials on mobile. Add a small desktop chevron and descriptive `aria-label`. Affects `Topbar.tsx`.
4. Sidebar group labels consume more vertical rhythm than their hierarchy earns. Tighten label height/group spacing without changing navigation or permissions. Affects `SidebarNavigation.tsx` and `ui/sidebar.tsx`.
5. Primary mobile shell controls are 36px. Preserve desktop density but provide 40–44px mobile hit areas. Affects `Topbar.tsx` and potentially `ui/sidebar.tsx`.

### Polish improvements

1. Align shell control radius with the compact Trusted Ledger language; `rounded-2xl` is visually more generic than the established component radius. Affects `Topbar.tsx` and optionally `ui/dropdown-menu.tsx`.
2. Distinguish the active sidebar item from hover with a restrained structural gold marker, retaining the existing tonal background. Affects `SidebarNavigation.tsx`.
3. Replace the perpetual notification `animate-pulse` with a static semantic badge. Affects `Topbar.tsx`.
4. Localize the collapsed sidebar rail’s English toggle label. Affects `ui/sidebar.tsx`.
5. Slightly strengthen the final breadcrumb’s primary-ink/weight treatment. Affects `AppBreadcrumbs.tsx`.

### Keep as-is

- The navy sidebar, official shadcn sidebar architecture, stable provider placement, persisted desktop state, provider-owned mobile state and 1024px breakpoint.
- Role-filtered navigation data, route-aware breadcrumbs, scoped unread sources, Lucide icon set, icon-only collapsed architecture and compact 64px fine-rule topbar.

### Suggested implementation scope

- `app comptabole/src/components/layout/sidebar/SidebarNavigation.tsx`
- `app comptabole/src/components/layout/sidebar/AppSidebar.tsx`
- `app comptabole/src/components/layout/Topbar.tsx`
- `app comptabole/src/components/layout/AppBreadcrumbs.tsx`
- `app comptabole/src/components/ui/sidebar.tsx`
- `app comptabole/src/components/ui/dropdown-menu.tsx` only if shared radius refinement is approved.
