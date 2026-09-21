# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The authenticated product serves three role-aware audiences:

- Cabinet administrators, who oversee the cabinet, its clients, collaborators
  and operations.
- Internal accounting collaborators, who work on assigned client companies and
  operational tasks.
- Employees of client companies, who access the scope of their own company in a
  read-oriented client workspace.

All users need to identify the next meaningful action quickly while working with
accounting information, documents and time-sensitive follow-up.

## Product Purpose

CamConsult combines a public accounting-and-advisory presence with an
authenticated workspace for operating a cabinet and collaborating with its
clients. The workspace supports the daily management of client companies,
documents, tasks, messages, accounting workflows and deadlines.

Success means that each role can safely find, understand and act on the
information in its authorized scope without turning the workspace into an
overwhelming reporting surface.

## Positioning

The product couples cabinet operations with client-company collaboration in one
role-aware workspace. It brings the information needed for accounting work,
follow-up and communication into the same product while maintaining company and
permission boundaries.

## Operating Context

The main product is `app comptabole/`, the authenticated cabinet-management
application. Its core operational workflows are:

- client company and collaborator management;
- accounting document collection, structuration and reminders;
- task management and workload follow-up;
- direct and group messaging;
- stock and accounting workflows;
- financial statements and AFFECTAT-related work;
- bordereaux and audit-journal workflows;
- operational Dashboard views of priorities, deadlines and activity.

The public website in `camconsult/` presents the firm and its advisory offer. It
is not a product workspace and must remain separate from authenticated product
work unless a request explicitly spans both applications.

## Capabilities and Constraints

- The authenticated application has Admin, Collaborateur and
  `societe_employe` contexts. Visibility, actions and data scope are role-aware.
- Client-side visibility is not authorization; backend scope and permission
  checks remain authoritative.
- The Dashboard presents scoped operational data rather than invented metrics.
- Task statuses are `a_faire`, `en_cours` and `termine`; tasks do not currently
  have a deadline or fake percentage-progress field.
- Collection statuses are `brouillon`, `transmis`, `valide`, `a_corriger` and
  `archive`; real collection deadlines and reminder fields drive follow-up.
- The workspace must remain responsive, compact and information-rich without
  becoming visually overwhelming.
- New data access should reuse established scoped stores and avoid N+1 requests,
  especially one specialized request per company for Dashboard aggregation.

## Brand Commitments

CamConsult should feel professional, trustworthy, premium, efficient and easy to
scan. The public website is the established visual authority for the CamConsult
brand identity: colors, font relationship, visual tone, borders, button identity
and accent treatment.

The authenticated app should inherit that identity while remaining a dense,
professional SaaS/accounting workspace. It must not copy the public website's
more spacious editorial/marketing-page layouts into operational screens.

## Evidence on Hand

- Public brand implementation: `camconsult/app/globals.css` and
  `camconsult/app/[lang]/layout.tsx`.
- Brand assets: `camconsult/public/brand/logo-mark-dark.png` and
  `camconsult/public/brand/logo-mark-light.png`.
- Public-site product copy: `camconsult/lib/i18n/fr.ts` and `camconsult/lib/i18n/en.ts`.
- Authenticated architecture and boundaries: `ARCHITECTURE.md`.
- Permissions and scope: `docs/permissions.md`.
- Operational Dashboard: `docs/dashboard.md`.
- Authenticated UI conventions: `docs/design-system.md`.

No testimonials, customer counts, performance benchmarks, pricing claims or
compliance certifications are recorded here; future work must not fabricate them.

## Product Principles

1. Scope before convenience: each role sees and acts only within its real
   authorization boundary.
2. Operational clarity: favor the next relevant action, status and deadline over
   decorative reporting.
3. Dense, calm professionalism: make rich accounting information easy to scan
   without marketing-page whitespace or visual noise.
4. One coherent CamConsult identity: transfer the public brand into the product
   through durable visual relationships, not copied page layouts.
5. Real data earns trust: metrics, statuses, progress and reminders reflect the
   existing model rather than invented UI concepts.

## Accessibility & Inclusion

The workspace should remain usable across desktop and mobile widths, preserve
visible text/status meaning rather than color alone, and keep dense information
scannable for the three account contexts. User-facing copy is French unless a
feature intentionally supports another established language.
